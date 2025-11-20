// biome-ignore lint/suspicious/noEmptyInterface: extends this in generated code
export interface ProvidersMap {}

type ProviderKey = keyof ProvidersMap;

type ProviderValue<K extends ProviderKey> = ProvidersMap[K];

type ProviderInstance<K extends ProviderKey> = Awaited<ReturnType<ProviderValue<K>['get']>>;

interface ProviderConfig<K extends string, D extends Record<string, ProviderKey>, V> {
	readonly key: K;
	readonly deps?: D;
	readonly eager?: boolean;
	readonly hidden?: boolean;
	readonly singleton?: boolean;
	readonly disableDisposeDestroy?: boolean;
	readonly build: (params: {
		buildId: string;
		deps: {
			[K in keyof D]: D[K] extends ProviderKey ? ProviderInstance<D[K]> : never;
		};
	}) => Promise<V>;
	readonly destroy?: (params: {
		buildId: string;
		instance: V;
	}) => Promise<void>;
}

export class Provider<
	K extends string,
	V,
	D extends Record<string, ProviderKey> = Record<string, ProviderKey>,
> {
	// replace this in generated code
	public static get = async <P extends Record<string, ProviderKey>>(
		_: P
	): Promise<{
		[K in keyof P]: ProviderValue<P[K]>;
	}> => {
		throw new Error(
			'Providers not initilized, to resolve this import in main file generated zerodi file'
		);
	};

	private instances = new Map<string, Promise<V>>();
	private destroying = new Map<string, Promise<void>>();
	private counts = new Map<string, number>();

	constructor(public readonly config: ProviderConfig<K, D, V>) {}

	public readonly get = async (buildId?: string): Promise<V> => {
		const bId = this.parseBuildId(buildId);

		const destroyingPromise = this.destroying.get(bId);
		if (destroyingPromise) await destroyingPromise;

		let instance = this.instances.get(bId);
		if (!instance) {
			instance = this.build(bId).catch((err) => {
				this.instances.delete(bId);
				throw err;
			});

			this.instances.set(bId, instance);
		}

		this.counts.set(bId, (this.counts.get(bId) || 0) + 1);

		return await instance;
	};

	public readonly dispose = async (buildId?: string) => {
		const bId = this.parseBuildId(buildId);

		const count = this.counts.get(bId);

		const nextCount = Math.max((count || 0) - 1, 0);

		this.counts.set(bId, nextCount);

		if (nextCount > 0 || this.config.disableDisposeDestroy) return;

		await this.destroy(bId);
	};

	private readonly build = async (buildId: string): Promise<V> => {
		const bId = this.parseBuildId(buildId);

		let deps = {};

		if (this.config.deps && Object.keys(this.config.deps).length > 0) {
			const providers = await getProviders(this.config.deps);

			deps = Object.fromEntries(
				await Promise.all(
					Object.entries(providers).map(async ([key, provider]) => {
						const instance = await provider.get(bId);
						return [key, instance];
					})
				)
			);
		}

		return await this.config.build({
			buildId: bId,
			deps: deps as {
				[K in keyof D]: D[K] extends ProviderKey ? ProviderInstance<D[K]> : never;
			},
		});
	};

	public readonly destroy = async (buildId?: string) => {
		const bId = this.parseBuildId(buildId);

		let promise = this.destroying.get(bId);
		if (!promise) {
			promise = (async () => {
				const instance = this.instances.get(bId);
				if (!instance) return;

				const value = await instance;
				await this.config.destroy?.({ buildId: bId, instance: value });

				if (this.config.deps && Object.keys(this.config.deps).length > 0) {
					const deps = await getProviders(this.config.deps);

					await Promise.all(
						Object.values(deps).map(async (provider) => {
							await provider.dispose(bId);
						})
					);
				}

				this.instances.delete(bId);
				this.counts.delete(bId);
				this.destroying.delete(bId);
			})();

			this.destroying.set(bId, promise);
		}

		await promise;
	};

	public readonly use = async <R>(fn: (instance: V) => R | Promise<R>, buildId?: string) => {
		const bId = this.parseBuildId(buildId);

		const instance = await this.get(bId);

		try {
			return await fn(instance);
		} finally {
			await this.dispose(bId);
		}
	};

	private readonly parseBuildId = (params?: string): string => {
		return this.config.singleton || params === undefined ? 'singleton' : params;
	};
}

export const createProvider = <
	K extends string,
	V,
	D extends Record<string, ProviderKey> = Record<string, ProviderKey>,
>(
	config: ProviderConfig<K, D, V>
) => new Provider(config);

export const getProviders = async <P extends Record<string, ProviderKey>>(keys: P) => {
	return await Provider.get(keys);
};

export const getProvider = async <K extends ProviderKey>(key: K) => {
	const { provider } = await getProviders({ provider: key });
	return provider;
};

export const useProviders = async <P extends Record<string, ProviderKey>, R>(
	keys: P,
	fn: (
		providers: {
			[K in keyof P]: P[K] extends ProviderKey ? ProviderInstance<P[K]> : never;
		}
	) => R | Promise<R>,
	buildId?: string
) => {
	const providers = await getProviders(keys);

	const instances = Object.fromEntries(
		await Promise.all(
			Object.entries(providers).map(async ([key, provider]) => {
				const instance = await provider.get(buildId);
				return [key, instance] as const;
			})
		)
	);

	try {
		return await fn(
			instances as {
				[K in keyof P]: P[K] extends ProviderKey ? ProviderInstance<P[K]> : never;
			}
		);
	} finally {
		await Promise.all(Object.values(providers).map((provider) => provider.dispose(buildId)));
	}
};
