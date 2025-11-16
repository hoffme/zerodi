import { Provider } from 'zerodi';
import type { Database, User } from './database';
import type { Logger } from './logger';

export class UserService {
	constructor(
		private db: Database,
		private logger: Logger
	) {}

	async createUser(name: string, email: string): Promise<User> {
		this.logger.info(`Creating user: ${name}`);

		const user: User = {
			id: crypto.randomUUID(),
			name,
			email,
		};

		await this.db.createUser(user);
		this.logger.success(`User created: ${user.id}`);

		return user;
	}

	async getUser(id: string): Promise<User | undefined> {
		this.logger.info(`Fetching user: ${id}`);
		const user = await this.db.findUser(id);

		if (!user) {
			this.logger.error(`User not found: ${id}`);
		}

		return user;
	}

	async listAllUsers(): Promise<User[]> {
		this.logger.info('Fetching all users');
		return await this.db.listUsers();
	}
}

export const userServiceProvider = new Provider({
	key: 'userService',
	deps: {
		db: 'database',
		logger: 'logger',
	},
	build: async ({ deps }) => {
		return new UserService(deps.db, deps.logger);
	},
});
