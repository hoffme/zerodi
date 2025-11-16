import { Provider } from 'zerodi';

// Simple in-memory database simulation
export interface User {
	id: string;
	name: string;
	email: string;
}

export class Database {
	private users: Map<string, User> = new Map();
	private connected = false;

	async connect() {
		// Simulate connection delay
		await new Promise((resolve) => setTimeout(resolve, 100));
		this.connected = true;
		console.log('📦 Database connected');
	}

	async disconnect() {
		this.connected = false;
		console.log('📦 Database disconnected');
	}

	async createUser(user: User): Promise<User> {
		if (!this.connected) throw new Error('Database not connected');
		this.users.set(user.id, user);
		return user;
	}

	async findUser(id: string): Promise<User | undefined> {
		if (!this.connected) throw new Error('Database not connected');
		return this.users.get(id);
	}

	async listUsers(): Promise<User[]> {
		if (!this.connected) throw new Error('Database not connected');
		return Array.from(this.users.values());
	}
}

export const databaseProvider = new Provider({
	key: 'database',
	singleton: true,
	eager: true,
	build: async () => {
		const db = new Database();
		await db.connect();
		return db;
	},
	destroy: async ({ instance }) => {
		await instance.disconnect();
	},
});
