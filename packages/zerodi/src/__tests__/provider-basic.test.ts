import { beforeEach, describe, expect, it } from 'vitest';

import { Provider } from '../index.js';

describe('Provider - Basic functionality', () => {
	beforeEach(() => {
		Provider.get = async () => {
			throw new Error('Providers not initialized');
		};
	});

	it('should create a provider with simple build function', async () => {
		const provider = new Provider({
			key: 'test',
			build: async () => ({ value: 42 }),
		});

		const instance = await provider.get();

		expect(instance).toEqual({ value: 42 });
	});

	it('should return same instance for singleton (default)', async () => {
		let callCount = 0;

		const provider = new Provider({
			key: 'singleton',
			singleton: true,
			build: async () => ({ id: ++callCount }),
		});

		const instance1 = await provider.get();
		const instance2 = await provider.get();

		expect(instance1).toBe(instance2);
		expect(callCount).toBe(1);
	});

	it('should return different instances for different buildIds', async () => {
		let callCount = 0;

		const provider = new Provider({
			key: 'scoped',
			build: async () => ({ id: ++callCount }),
		});

		const instance1 = await provider.get('user-1');
		const instance2 = await provider.get('user-2');

		expect(instance1).not.toBe(instance2);
		expect(callCount).toBe(2);
	});

	it('should return same instance for same buildId', async () => {
		let callCount = 0;

		const provider = new Provider({
			key: 'scoped',
			build: async () => ({ id: ++callCount }),
		});

		const instance1 = await provider.get('user-1');
		const instance2 = await provider.get('user-1');

		expect(instance1).toBe(instance2);
		expect(callCount).toBe(1);
	});
});
