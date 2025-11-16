import { describe, it, expect } from 'vitest';
import { Provider } from '../index.js';

describe('Provider - Edge cases and errors', () => {
	it('should throw if Provider.get is not initialized', async () => {
		Provider.get = async () => {
			throw new Error('Providers not initialized');
		};

		await expect(Provider.get({ test: 'test' })).rejects.toThrow(
			'Providers not initialized'
		);
	});

	it('should handle async errors in build function', async () => {
		const provider = new Provider({
			key: 'error-build',
			build: async () => {
				throw new Error('Build failed');
			},
		});

		await expect(provider.get()).rejects.toThrow('Build failed');
	});

	it('should not cache failed builds', async () => {
		let attempts = 0;
		const provider = new Provider({
			key: 'flaky',
			build: async () => {
				attempts++;
				if (attempts === 1) throw new Error('First attempt fails');
				return { value: attempts };
			},
		});

		await expect(provider.get('test-1')).rejects.toThrow('First attempt fails');

		const instance = await provider.get('test-1');
		expect(instance.value).toBe(2);
		expect(attempts).toBe(2);
	});

	it('should handle concurrent get calls', async () => {
		let buildCount = 0;
		const provider = new Provider({
			key: 'concurrent',
			build: async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				return { id: ++buildCount };
			},
		});

		const [i1, i2, i3] = await Promise.all([
			provider.get('test-1'),
			provider.get('test-1'),
			provider.get('test-1'),
		]);

		expect(i1).toBe(i2);
		expect(i2).toBe(i3);
		expect(buildCount).toBe(1);
	});

	it('should handle errors in destroy function', async () => {
		const provider = new Provider({
			key: 'error-destroy',
			build: async () => ({ value: 42 }),
			destroy: async () => {
				throw new Error('Destroy failed');
			},
		});

		await provider.get('test-1');
		await expect(provider.dispose('test-1')).rejects.toThrow('Destroy failed');
	});

	it('should handle dispose on non-existent buildId', async () => {
		const provider = new Provider({
			key: 'no-instance',
			build: async () => ({ value: 42 }),
		});

		// Should not throw
		await provider.dispose('does-not-exist');
		expect(true).toBe(true);
	});

	it('should handle empty deps object', async () => {
		const provider = new Provider({
			key: 'no-deps',
			deps: {},
			build: async ({ deps }) => {
				expect(deps).toEqual({});
				return { value: 42 };
			},
		});

		await provider.get();
	});

	it('should handle rapid dispose/get cycles', async () => {
		let buildCount = 0;
		let destroyCount = 0;

		const provider = new Provider({
			key: 'rapid',
			build: async () => ({ id: ++buildCount }),
			destroy: async () => {
				destroyCount++;
			},
		});

		for (let i = 0; i < 5; i++) {
			await provider.get('test-1');
			await provider.dispose('test-1');
		}

		expect(buildCount).toBe(5);
		expect(destroyCount).toBe(5);
	});
});
