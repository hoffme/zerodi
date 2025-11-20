import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Provider } from '../../src/index.js';

describe('Provider', () => {
	beforeEach(() => {
		Provider.get = vi.fn();
	});

	describe('Basic instantiation', () => {
		it('should create provider without calling build', async () => {
			const build = vi.fn();
			new Provider({ key: 'test', build });
			expect(build).not.toHaveBeenCalled();
		});
	});

	describe('get() - Instance retrieval', () => {
		it('should call build once on first get', async () => {
			const build = vi.fn().mockResolvedValue('instance');
			const provider = new Provider({ key: 'test', build });

			await provider.get();

			expect(build).toHaveBeenCalledTimes(1);
		});

		it('should call build once even with multiple concurrent gets', async () => {
			const build = vi.fn().mockResolvedValue('instance');
			const provider = new Provider({ key: 'test', build });

			await Promise.all([provider.get(), provider.get(), provider.get()]);

			expect(build).toHaveBeenCalledTimes(1);
		});

		it('should return the built instance', async () => {
			const instance = { value: 42 };
			const provider = new Provider({
				key: 'test',
				build: async () => instance,
			});

			const result = await provider.get();

			expect(result).toBe(instance);
		});

		it('should return same instance on multiple gets with same buildId', async () => {
			const provider = new Provider({
				key: 'test',
				build: async () => ({ random: Math.random() }),
			});

			const [r1, r2, r3] = await Promise.all([
				provider.get('id1'),
				provider.get('id1'),
				provider.get('id1'),
			]);

			expect(r1).toBe(r2);
			expect(r2).toBe(r3);
		});

		it('should return different instances for different buildIds', async () => {
			const provider = new Provider({
				key: 'test',
				build: async () => ({ random: Math.random() }),
			});

			const r1 = await provider.get('id1');
			const r2 = await provider.get('id2');

			expect(r1).not.toBe(r2);
		});

		it('should pass buildId to build function', async () => {
			const build = vi.fn().mockResolvedValue('instance');
			const provider = new Provider({ key: 'test', build });

			await provider.get('custom-id');

			expect(build).toHaveBeenCalledWith({
				buildId: 'custom-id',
				deps: {},
			});
		});

		it('should use singleton buildId when no buildId provided', async () => {
			const build = vi.fn().mockResolvedValue('instance');
			const provider = new Provider({ key: 'test', build });

			await provider.get();

			expect(build).toHaveBeenCalledWith({
				buildId: 'singleton',
				deps: {},
			});
		});
	});

	describe('singleton config', () => {
		it('should use singleton buildId when singleton=true regardless of provided buildId', async () => {
			const build = vi.fn().mockResolvedValue('instance');
			const provider = new Provider({
				key: 'test',
				singleton: true,
				build,
			});

			await provider.get('custom-id');

			expect(build).toHaveBeenCalledWith({
				buildId: 'singleton',
				deps: {},
			});
		});

		it('should return same instance for different buildIds when singleton=true', async () => {
			const provider = new Provider({
				key: 'test',
				singleton: true,
				build: async () => ({ random: Math.random() }),
			});

			const r1 = await provider.get('id1');
			const r2 = await provider.get('id2');

			expect(r1).toBe(r2);
		});
	});

	describe('Error handling', () => {
		it('should throw error if build fails', async () => {
			const error = new Error('Build failed');
			const provider = new Provider({
				key: 'test',
				build: async () => {
					throw error;
				},
			});

			await expect(provider.get()).rejects.toThrow('Build failed');
		});

		it('should allow retry after build failure', async () => {
			const build = vi
				.fn()
				.mockRejectedValueOnce(new Error('Failed'))
				.mockResolvedValueOnce('success');

			const provider = new Provider({ key: 'test', build });

			await expect(provider.get()).rejects.toThrow('Failed');
			await expect(provider.get()).resolves.toBe('success');

			expect(build).toHaveBeenCalledTimes(2);
		});

		it('should not cache failed build attempts', async () => {
			let attempt = 0;
			const provider = new Provider({
				key: 'test',
				build: async () => {
					attempt++;
					if (attempt === 1) throw new Error('Fail');
					return 'success';
				},
			});

			await expect(provider.get()).rejects.toThrow();
			const result = await provider.get();

			expect(result).toBe('success');
		});
	});

	describe('Reference counting', () => {
		it('should track reference count', async () => {
			const destroy = vi.fn();
			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
				destroy,
			});

			await provider.get();
			await provider.get();
			await provider.get();

			await provider.dispose();
			await provider.dispose();

			expect(destroy).not.toHaveBeenCalled();
		});

		it('should call destroy when ref count reaches zero', async () => {
			const destroy = vi.fn();
			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
				destroy,
			});

			await provider.get();
			await provider.get();
			await provider.dispose();
			await provider.dispose();

			expect(destroy).toHaveBeenCalledTimes(1);
		});

		it('should handle separate ref counts for different buildIds', async () => {
			const destroy = vi.fn();
			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
				destroy,
			});

			await provider.get('id1');
			await provider.get('id1');
			await provider.get('id2');

			await provider.dispose('id1');
			await provider.dispose('id2');

			expect(destroy).toHaveBeenCalledTimes(1); // Only id2
			expect(destroy).toHaveBeenCalledWith({
				buildId: 'id2',
				instance: 'instance',
			});
		});

		it('should not allow ref count to go below zero', async () => {
			const destroy = vi.fn();
			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
				destroy,
			});

			await provider.get();
			await provider.dispose();
			await provider.dispose();
			await provider.dispose();

			expect(destroy).toHaveBeenCalledTimes(1);
		});
	});

	describe('dispose()', () => {
		it('should not throw if disposing non-existent instance', async () => {
			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
			});

			await provider.dispose('non-existent');
		});

		it('should not call destroy if disableDisposeDestroy=true', async () => {
			const destroy = vi.fn();
			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
				destroy,
				disableDisposeDestroy: true,
			});

			await provider.get();
			await provider.dispose();

			expect(destroy).not.toHaveBeenCalled();
		});
	});

	describe('destroy()', () => {
		it('should call destroy callback with instance', async () => {
			const instance = { value: 42 };
			const destroy = vi.fn();
			const provider = new Provider({
				key: 'test',
				build: async () => instance,
				destroy,
			});

			await provider.get();
			await provider.destroy();

			expect(destroy).toHaveBeenCalledWith({
				buildId: 'singleton',
				instance,
			});
		});

		it('should remove instance after destroy', async () => {
			const build = vi.fn().mockResolvedValue('instance');
			const provider = new Provider({
				key: 'test',
				build,
			});

			await provider.get();
			await provider.destroy();
			await provider.get();

			expect(build).toHaveBeenCalledTimes(2);
		});

		it('should clear reference count after destroy', async () => {
			const destroy = vi.fn();
			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
				destroy,
			});

			await provider.get();
			await provider.get();
			await provider.destroy();

			await provider.get();
			await provider.dispose();

			expect(destroy).toHaveBeenCalledTimes(2);
		});

		it('should not call destroy multiple times concurrently', async () => {
			const destroy = vi.fn();
			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
				destroy,
			});

			await provider.get();
			await Promise.all([provider.destroy(), provider.destroy(), provider.destroy()]);

			expect(destroy).toHaveBeenCalledTimes(1);
		});

		it('should wait for ongoing destroy before creating new instance', async () => {
			let destroyResolve: () => void;
			const destroyPromise = new Promise<void>((resolve) => {
				destroyResolve = resolve;
			});

			const destroy = vi.fn().mockReturnValue(destroyPromise);
			const build = vi.fn().mockResolvedValue('instance');

			const provider = new Provider({
				key: 'test',
				build,
				destroy,
			});

			await provider.get();

			const destroyCall = provider.destroy();
			const getCall = provider.get();

			expect(build).toHaveBeenCalledTimes(1);

			destroyResolve!();
			await destroyCall;
			await getCall;

			expect(build).toHaveBeenCalledTimes(2);
		});
	});

	describe('use()', () => {
		it('should provide instance to callback', async () => {
			const instance = { value: 42 };
			const provider = new Provider({
				key: 'test',
				build: async () => instance,
			});

			const result = await provider.use((inst) => inst.value);

			expect(result).toBe(42);
		});

		it('should dispose instance after callback completes', async () => {
			const destroy = vi.fn();
			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
				destroy,
			});

			await provider.use(() => 'result');

			expect(destroy).toHaveBeenCalledTimes(1);
		});

		it('should dispose even if callback throws', async () => {
			const destroy = vi.fn();
			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
				destroy,
			});

			await expect(
				provider.use(() => {
					throw new Error('Callback error');
				})
			).rejects.toThrow('Callback error');

			expect(destroy).toHaveBeenCalledTimes(1);
		});

		it('should support async callbacks', async () => {
			const provider = new Provider({
				key: 'test',
				build: async () => ({ value: 42 }),
			});

			const result = await provider.use(async (inst) => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return inst.value * 2;
			});

			expect(result).toBe(84);
		});

		it('should use provided buildId', async () => {
			const build = vi.fn().mockResolvedValue('instance');
			const provider = new Provider({ key: 'test', build });

			await provider.use(() => {}, 'custom-id');

			expect(build).toHaveBeenCalledWith({
				buildId: 'custom-id',
				deps: {},
			});
		});
	});

	describe('Dependencies', () => {
		it('should resolve dependencies before build', async () => {
			const depProvider = new Provider({
				key: 'dep',
				build: async () => 'dep-instance',
			});

			Provider.get = vi.fn().mockResolvedValue({ dep: depProvider });

			const build = vi.fn().mockResolvedValue('instance');
			const provider = new Provider({
				key: 'test',
				deps: { dep: 'dep' as any },
				build,
			});

			await provider.get();

			expect(build).toHaveBeenCalledWith({
				buildId: 'singleton',
				deps: { dep: 'dep-instance' },
			});
		});

		it('should dispose dependencies on destroy', async () => {
			const depDispose = vi.fn();
			const depProvider = new Provider({
				key: 'dep',
				build: async () => 'dep-instance',
			});
			depProvider.dispose = depDispose;

			Provider.get = vi.fn().mockResolvedValue({ dep: depProvider });

			const provider = new Provider({
				key: 'test',
				deps: { dep: 'dep' as any },
				build: async () => 'instance',
			});

			await provider.get();
			await provider.destroy();

			expect(depDispose).toHaveBeenCalledWith('singleton');
		});

		it('should pass buildId to dependencies', async () => {
			const depGet = vi.fn().mockResolvedValue('dep-instance');
			const depProvider = new Provider({
				key: 'dep',
				build: async () => 'dep-instance',
			});
			depProvider.get = depGet;

			Provider.get = vi.fn().mockResolvedValue({ dep: depProvider });

			const provider = new Provider({
				key: 'test',
				deps: { dep: 'dep' as any },
				build: async () => 'instance',
			});

			await provider.get('custom-id');

			expect(depGet).toHaveBeenCalledWith('custom-id');
		});

		it('should handle multiple dependencies', async () => {
			const dep1Provider = new Provider({
				key: 'dep1',
				build: async () => 'dep1',
			});
			const dep2Provider = new Provider({
				key: 'dep2',
				build: async () => 'dep2',
			});

			Provider.get = vi.fn().mockResolvedValue({ dep1: dep1Provider, dep2: dep2Provider });

			const build = vi.fn().mockResolvedValue('instance');
			const provider = new Provider({
				key: 'test',
				deps: { dep1: 'dep1' as any, dep2: 'dep2' as any },
				build,
			});

			await provider.get();

			expect(build).toHaveBeenCalledWith({
				buildId: 'singleton',
				deps: { dep1: 'dep1', dep2: 'dep2' },
			});
		});

		it('should not fetch dependencies if deps is empty', async () => {
			Provider.get = vi.fn();

			const provider = new Provider({
				key: 'test',
				deps: {},
				build: async () => 'instance',
			});

			await provider.get();

			expect(Provider.get).not.toHaveBeenCalled();
		});

		it('should not fetch dependencies if deps is undefined', async () => {
			Provider.get = vi.fn();

			const provider = new Provider({
				key: 'test',
				build: async () => 'instance',
			});

			await provider.get();

			expect(Provider.get).not.toHaveBeenCalled();
		});
	});
});
