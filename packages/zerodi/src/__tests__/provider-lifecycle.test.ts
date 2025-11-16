import { beforeEach, describe, expect, it } from 'vitest';

import { Provider } from '../index.js';

describe('Provider - Lifecycle management', () => {
	beforeEach(() => {
		Provider.get = async () => {
			throw new Error('Providers not initialized');
		};
	});

	it('should call destroy when disposing last reference', async () => {
		let destroyCalled = false;

		const provider = new Provider({
			key: 'lifecycle',
			build: async () => ({ value: 42 }),
			destroy: async () => {
				destroyCalled = true;
			},
		});

		await provider.get('test-1');
		await provider.dispose('test-1');

		expect(destroyCalled).toBe(true);
	});

	it('should use reference counting for dispose', async () => {
		let destroyCount = 0;
		const provider = new Provider({
			key: 'refcount',
			build: async () => ({ value: 42 }),
			destroy: async () => {
				destroyCount++;
			},
		});

		await provider.get('test-1');
		await provider.get('test-1'); // second reference
		await provider.get('test-1'); // third reference

		await provider.dispose('test-1'); // count: 2
		expect(destroyCount).toBe(0);

		await provider.dispose('test-1'); // count: 1
		expect(destroyCount).toBe(0);

		await provider.dispose('test-1'); // count: 0, should destroy
		expect(destroyCount).toBe(1);
	});

	it('should not call destroy if disableDisposeDestroy is true', async () => {
		let destroyCalled = false;
		const provider = new Provider({
			key: 'no-dispose',
			disableDisposeDestroy: true,
			build: async () => ({ value: 42 }),
			destroy: async () => {
				destroyCalled = true;
			},
		});

		await provider.get('test-1');
		await provider.dispose('test-1');

		expect(destroyCalled).toBe(false);
	});

	it('should wait for destroy before creating new instance', async () => {
		let buildCount = 0;
		let isDestroying = false;

		const provider = new Provider({
			key: 'wait-destroy',
			build: async () => {
				expect(isDestroying).toBe(false);
				buildCount++;
				return { id: buildCount };
			},
			destroy: async () => {
				isDestroying = true;
				await new Promise((resolve) => setTimeout(resolve, 100));
				isDestroying = false;
			},
		});

		const instance1 = await provider.get('test-1');
		const destroyPromise = provider.dispose('test-1');

		// Try to get instance while destroying
		const getPromise = provider.get('test-1');

		await destroyPromise;
		const instance2 = await getPromise;

		expect(instance1.id).toBe(1);
		expect(instance2.id).toBe(2);
		expect(buildCount).toBe(2);
	});

	it('use() should automatically dispose after callback', async () => {
		let destroyCalled = false;
		const provider = new Provider({
			key: 'use-test',
			build: async () => ({ value: 42 }),
			destroy: async () => {
				destroyCalled = true;
			},
		});

		const result = await provider.use((instance) => {
			return instance.value * 2;
		}, 'test-1');

		expect(result).toBe(84);
		expect(destroyCalled).toBe(true);
	});

	it('use() should dispose even if callback throws', async () => {
		let destroyCalled = false;
		const provider = new Provider({
			key: 'use-error',
			build: async () => ({ value: 42 }),
			destroy: async () => {
				destroyCalled = true;
			},
		});

		await expect(
			provider.use(() => {
				throw new Error('Test error');
			}, 'test-1')
		).rejects.toThrow('Test error');

		expect(destroyCalled).toBe(true);
	});

	it('should handle manual destroy independently of dispose', async () => {
		let destroyCount = 0;
		const provider = new Provider({
			key: 'manual-destroy',
			build: async () => ({ value: 42 }),
			destroy: async () => {
				destroyCount++;
			},
		});

		await provider.get('test-1');
		await provider.get('test-1'); // count: 2

		await provider.destroy('test-1');

		expect(destroyCount).toBe(1);

		// Dispose should not trigger destroy again since instance is gone
		await provider.dispose('test-1');
		await provider.dispose('test-1');

		expect(destroyCount).toBe(1);
	});
});
