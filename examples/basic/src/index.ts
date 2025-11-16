import { startProviders } from './zerodi';

import { getProvider } from 'zerodi';

async function main() {
	console.log('🚀 Starting ZeroDI Basic Example\n');

	// Start eager providers (logger, database)
	await startProviders();

	console.log('\n--- Example 1: Using getProvider ---\n');

	// Get the user service
	const userService = await getProvider('userService');

	// Create some users
	const alice = await userService.get();
	await alice.createUser('Alice', 'alice@example.com');
	await alice.createUser('Bob', 'bob@example.com');

	// List all users
	const users = await alice.listAllUsers();
	console.log('\nAll users:', users);

	// Dispose the instance
	await userService.dispose();

	console.log('\n--- Example 2: Using provider.use() with auto-cleanup ---\n');

	// Use pattern automatically handles cleanup
	await userService.use(async (service) => {
		const charlie = await service.createUser('Charlie', 'charlie@example.com');
		console.log('\nCreated:', charlie);

		const found = await service.getUser(charlie.id);
		console.log('Found:', found);
	});

	console.log('\n--- Example 3: Scoped instances ---\n');

	// Different build IDs create separate instances
	const instance1 = await userService.get('request-1');
	const instance2 = await userService.get('request-2');

	await instance1.createUser('User from Request 1', 'user1@example.com');
	await instance2.createUser('User from Request 2', 'user2@example.com');

	await userService.dispose('request-1');
	await userService.dispose('request-2');

	console.log('\n--- Cleanup ---\n');

	// Clean up database connection
	const db = await getProvider('database');
	await db.destroy();

	console.log('\n✅ Example completed!');
}

main().catch(console.error);
