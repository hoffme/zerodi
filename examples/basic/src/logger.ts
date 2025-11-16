import { Provider } from 'zerodi';

// Simple logger service
export class Logger {
	private prefix: string;

	constructor(prefix = '[App]') {
		this.prefix = prefix;
	}

	info(message: string) {
		console.log(`${this.prefix} ℹ️  ${message}`);
	}

	error(message: string) {
		console.error(`${this.prefix} ❌ ${message}`);
	}

	success(message: string) {
		console.log(`${this.prefix} ✅ ${message}`);
	}
}

export const loggerProvider = new Provider({
	key: 'logger',
	singleton: true,
	eager: true,
	build: async () => {
		return new Logger('[ZeroDI Example]');
	},
});
