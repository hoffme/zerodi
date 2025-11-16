import { describe, it, expect, beforeEach } from 'vitest';
import { Provider, getProviders, getProvider, useProviders } from '../index.js';

describe('Helper functions', () => {
	beforeEach(() => {
		// Reset
		Provider.get = async () => {
			throw new Error('Providers not initialized');
		};
	});

	describe('getProviders', () => {
		it('should call Provider.get with the keys', async () => {
			const mockProviders = {
				logger: new Provider({
					key: 'logger',
					build: async () => ({ log: () => {} }),
				}),
				db: new Provider({
					key: 'db',
					build: async () => ({ query: () => {} }),
				}),
			};

			Provider.get = async (keys) => {
				expect(keys).toEqual({ logger: 'logger', db: 'db' });
				return mockProviders as any;
			};

			const result = await getProviders({ logger: 'logger', db: 'db' });
			expect(result).toBe(mockProviders);
		});
	});

	describe('getProvider', () => {
		it('should get a single provider', async () => {
			const loggerProvider = new Provider({
				key: 'logger',
				build: async () => ({ log: () => {} }),
			});

			Provider.get = async () => ({ provider: loggerProvider } as any);

			const result = await getProvider('logger');
			expect(result).toBe(loggerProvider);
		});
	});

	describe('useProviders', () => {
		it('should get instances, run callback, and dispose', async () => {
			let loggerDestroyed = false;
			let dbDestroyed = false;

			const loggerProvider = new Provider({
				key: 'logger',
				build: async () => ({ log: (msg: string) => msg }),
				destroy: async () => {
					loggerDestroyed = true;
				},
			});

			const dbProvider = new Provider({
				key: 'db',
				build: async () => ({ query: (sql: string) => sql }),
				destroy: async () => {
					dbDestroyed = true;
				},
			});

			Provider.get = async () =>
				({ logger: loggerProvider, db: dbProvider } as any);

			const result = await useProviders(
				{ logger: 'logger', db: 'db' },
				(providers) => {
					return providers.logger.log(
						providers.db.query('SELECT * FROM users')
					);
				},
				'test-1'
			);

			expect(result).toBe('SELECT * FROM users');
			expect(loggerDestroyed).toBe(true);
			expect(dbDestroyed).toBe(true);
		});

		it('should dispose even if callback throws', async () => {
			let destroyed = false;

			const provider = new Provider({
				key: 'test',
				build: async () => ({ value: 42 }),
				destroy: async () => {
					destroyed = true;
				},
			});

			Provider.get = async () => ({ test: provider } as any);

			await expect(
				useProviders(
					{ test: 'test' },
					() => {
						throw new Error('Test error');
					},
					'test-1'
				)
			).rejects.toThrow('Test error');

			expect(destroyed).toBe(true);
		});

		it('should pass buildId to all providers', async () => {
			const provider = new Provider({
				key: 'test',
				build: async ({ buildId }) => ({ buildId }),
			});

			Provider.get = async () => ({ test: provider } as any);

			await useProviders(
				{ test: 'test' },
				(providers) => {
					expect(providers.test.buildId).toBe('custom-id');
				},
				'custom-id'
			);
		});
	});
});
