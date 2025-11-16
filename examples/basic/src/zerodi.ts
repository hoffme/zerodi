import { Provider } from 'zerodi';

const providers = {
	'database': async () => (await import('./database')).databaseProvider,
	'logger': async () => (await import('./logger')).loggerProvider,
	'userService': async () => (await import('./user-service')).userServiceProvider
};

declare module 'zerodi' {
	interface ProvidersMap {
		'database': Awaited<ReturnType<(typeof providers)['database']>>;
		'logger': Awaited<ReturnType<(typeof providers)['logger']>>;
		'userService': Awaited<ReturnType<(typeof providers)['userService']>>
	}
}

Provider.get = async (keys) => {
	const results = await Promise.all(
		Object.entries(keys).map(async ([key, providerKey]) => {
			const importFn = providers[providerKey];
			if (!importFn) {
				throw new Error(`Provider '${providerKey}' not found`);
			}

			const provider = await importFn();

			return [key, provider] as const;
		})
	);

	return Object.fromEntries(results) as any;
};

export const startProviders = async () => {
	const providers = await Provider.get({
		'database': 'database',
		'logger': 'logger'
	});

	return Object.fromEntries(
		await Promise.all(
			Object.entries(providers).map(async ([key, provider]) => {
				const instance = await provider.get();
				return [key, instance] as const;
			})
		)
	);
};
