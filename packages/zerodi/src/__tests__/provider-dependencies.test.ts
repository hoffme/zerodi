import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { Provider } from '../index.js';

describe('Provider - Dependencies', () => {
	beforeEach(() => {
		// Mock Provider.get to simulate generated code
		Provider.get = vi.fn();
	});

	it('should inject dependencies into build function', async () => {
		const loggerProvider = new Provider({
			key: 'logger',
			build: async () => ({
				log: (msg: string) => msg,
			}),
		});

		const dbProvider = new Provider({
			key: 'db',
			build: async () => ({
				query: (sql: string) => sql,
			}),
		});

		// Mock Provider.get for dependencies
		(Provider.get as Mock<typeof Provider.get>).mockResolvedValue({
			logger: loggerProvider,
			db: dbProvider,
		});

		let receivedDeps = {};

		const serviceProvider = new Provider({
			key: 'service',
			deps: { logger: 'logger', db: 'db' },
			build: async ({ deps }) => {
				receivedDeps = deps;

				return {
					doSomething: () => deps.logger.log(deps.db.query('SELECT * FROM users')),
				};
			},
		});

		await serviceProvider.get();

		expect(receivedDeps).toBeDefined();
		expect(receivedDeps.logger).toBeDefined();
		expect(receivedDeps.db).toBeDefined();
	});

	it('should pass buildId to dependencies', async () => {
		const depProvider = new Provider({
			key: 'dep',
			build: async ({ buildId }) => ({ buildId }),
		});

		(Provider.get as Mock<typeof Provider.get>).mockResolvedValue({
			dep: depProvider,
		});

		const parentProvider = new Provider({
			key: 'parent',
			deps: { dep: 'dep' },
			build: async ({ deps, buildId }) => ({
				parentId: buildId,
				depId: deps.dep.buildId,
			}),
		});

		const instance = await parentProvider.get('test-123');

		expect(instance.parentId).toBe('test-123');
		expect(instance.depId).toBe('test-123');
	});

	it('should dispose dependencies when parent is disposed', async () => {
		let depDisposed = false;
		const depProvider = new Provider({
			key: 'dep',
			build: async () => ({ value: 1 }),
			destroy: async () => {
				depDisposed = true;
			},
		});

		(Provider.get as Mock<typeof Provider.get>).mockResolvedValue({
			dep: depProvider,
		});

		const parentProvider = new Provider({
			key: 'parent',
			deps: { dep: 'dep' },
			build: async ({ deps }) => ({ dep: deps.dep }),
		});

		await parentProvider.get('test-1');
		await parentProvider.dispose('test-1');

		expect(depDisposed).toBe(true);
	});

	it('should handle nested dependencies', async () => {
		const configProvider = new Provider({
			key: 'config',
			build: async () => ({ port: 3000 }),
		});

		const loggerProvider = new Provider({
			key: 'logger',
			deps: { config: 'config' },
			build: async ({ deps }) => ({
				log: (msg: string) => `[${deps.config.port}] ${msg}`,
			}),
		});

		const dbProvider = new Provider({
			key: 'db',
			deps: { logger: 'logger' },
			build: async ({ deps }) => ({
				query: (sql: string) => deps.logger.log(`Query: ${sql}`),
			}),
		});

		// Mock for each level
		(Provider.get as Mock<typeof Provider.get>)
			.mockResolvedValueOnce({ logger: loggerProvider })
			.mockResolvedValueOnce({ config: configProvider });

		const instance = await dbProvider.get();
		const result = instance.query('SELECT 1');

		expect(result).toBe('[3000] Query: SELECT 1');
	});

	it('should share dependency instances within same buildId', async () => {
		let depBuildCount = 0;
		const depProvider = new Provider({
			key: 'shared-dep',
			build: async () => ({ id: ++depBuildCount }),
		});

		(Provider.get as Mock<typeof Provider.get>).mockResolvedValue({
			dep: depProvider,
		});

		const service1Provider = new Provider({
			key: 'service1',
			deps: { dep: 'shared-dep' },
			build: async ({ deps }) => ({ depId: deps.dep.id }),
		});

		const service2Provider = new Provider({
			key: 'service2',
			deps: { dep: 'shared-dep' },
			build: async ({ deps }) => ({ depId: deps.dep.id }),
		});

		const [s1, s2] = await Promise.all([
			service1Provider.get('build-1'),
			service2Provider.get('build-1'),
		]);

		expect(s1.depId).toBe(s2.depId);
		expect(depBuildCount).toBe(1);
	});

	it('should handle dependencies with different buildIds', async () => {
		let depBuildCount = 0;
		const depProvider = new Provider({
			key: 'scoped-dep',
			build: async ({ buildId }) => ({
				id: ++depBuildCount,
				buildId,
			}),
		});

		(Provider.get as Mock<typeof Provider.get>).mockResolvedValue({
			dep: depProvider,
		});

		const parentProvider = new Provider({
			key: 'parent',
			deps: { dep: 'scoped-dep' },
			build: async ({ deps }) => ({ depId: deps.dep.id }),
		});

		const instance1 = await parentProvider.get('build-1');
		const instance2 = await parentProvider.get('build-2');

		expect(instance1.depId).not.toBe(instance2.depId);
		expect(depBuildCount).toBe(2);
	});
});
