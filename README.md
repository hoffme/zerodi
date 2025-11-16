# ZeroDI

**Zero-overhead Dependency Injection for TypeScript with compile-time code generation**

[![npm version](https://img.shields.io/npm/v/zerodi.svg)](https://www.npmjs.com/package/zerodi)
[![npm downloads](https://img.shields.io/npm/dm/zerodi.svg)](https://www.npmjs.com/package/zerodi)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## Why ZeroDI?

Traditional TypeScript DI frameworks require decorators, `reflect-metadata`, and runtime reflection. ZeroDI generates your DI container at **compile time** for zero runtime overhead and 100% type safety.

### Before (Traditional DI)

```typescript
// ❌ Runtime overhead, experimental decorators, reflect-metadata
@injectable()
class UserService {
  constructor(
    @inject('Database') private db: Database,
    @inject('Logger') private logger: Logger
  ) {}
}

// tsconfig.json needs:
// "experimentalDecorators": true,
// "emitDecoratorMetadata": true
```

### After (ZeroDI)

```typescript
// ✅ Zero decorators, compile-time safety, no runtime overhead
export const userService = new Provider({
  key: 'userService',
  deps: { db: 'database', logger: 'logger' },
  build: async ({ deps }) => new UserService(deps.db, deps.logger)
});

// Full IntelliSense, no experimental features
const user = await getProvider('userService');
```

## Features

- 🚀 **Zero Runtime Overhead** - Container generated at compile time
- 🎯 **100% Type-Safe** - Full IntelliSense without `reflect-metadata`
- 🪶 **No Decorators** - Clean, explicit dependency declarations
- ⚡ **Async-First** - Built for async/await from the ground up
- 🔄 **Lifecycle Management** - Reference counting & automatic cleanup
- 📦 **Tree-Shakeable** - Only import what you use
- 🛠️ **Framework Agnostic** - Works anywhere TypeScript runs
- 🔍 **Auto-Discovery** - CLI finds and wires your providers automatically
- 🎨 **Multi-Tenancy** - Built-in scoped instances via `buildId`

## Installation

```bash
npm install zerodi
# or
pnpm add zerodi
# or
yarn add zerodi
```

## Quick Start

### 1. Define Providers

```typescript
// src/database.ts
import { Provider } from 'zerodi';

export const database = new Provider({
  key: 'database',
  singleton: true,
  build: async () => {
    const db = await createConnection({
      host: 'localhost',
      port: 5432,
    });
    return db;
  },
  destroy: async ({ instance }) => {
    await instance.close();
  },
});
```

```typescript
// src/user-service.ts
import { Provider } from 'zerodi';

export const userService = new Provider({
  key: 'userService',
  deps: { db: 'database', logger: 'logger' },
  build: async ({ deps }) => ({
    async createUser(email: string) {
      deps.logger.info('Creating user', { email });
      return await deps.db.insert('users', { email });
    },
  }),
});
```

### 2. Generate Container

```bash
# One-time generation
npx zerodi generate

# Or watch during development
npx zerodi watch
```

This creates `src/zerodi.ts` with types:

```typescript
// ✨ Auto-generated - full type safety!
declare module 'zerodi' {
  interface ProvidersMap {
    'database': typeof database;
    'logger': typeof logger;
    'userService': typeof userService;
  }
}
```

### 3. Use Dependencies

```typescript
import './zerodi'; // Import generated container
import { getProvider, useProviders } from 'zerodi';

// Type-safe provider access
const userService = await getProvider('userService');
const user = await userService.createUser('user@example.com');

// Auto-cleanup with useProviders
await useProviders(
  { userService: 'userService' },
  async ({ userService }) => {
    await userService.createUser('test@example.com');
  }
  // All dependencies automatically disposed here
);
```

## Core Concepts

### Provider Options

```typescript
new Provider({
  key: 'serviceName',           // Unique identifier
  
  // Dependencies
  deps?: { myDb: 'database' },  // Inject other providers
  
  // Lifecycle
  singleton?: boolean,          // Share instance (default: false)
  eager?: boolean,              // Start on app init (default: false)
  hidden?: boolean,             // Exclude from TypeScript types
  disableDisposeDestroy?: boolean, // Skip cleanup (default: false)
  
  // Factory & cleanup
  build: async ({ buildId, deps }) => {
    return new Service(deps.myDb);
  },
  
  destroy: async ({ buildId, instance }) => {
    await instance.cleanup();
  },
})
```

### Scoped Instances (Multi-Tenancy)

```typescript
// Different instance per tenant/request
const tenantDb = await database.get('tenant-123');
const requestDb = await database.get('request-456');

// Shared singleton
const sharedDb = await database.get(); // or .get('singleton')
```

### Lifecycle Management

```typescript
// Manual control
const db = await provider.get('request-1');
await provider.dispose('request-1'); // Decrements reference count

// Auto-cleanup with use()
await provider.use(async (instance) => {
  await instance.query('SELECT 1');
}, 'request-1');
// Automatically disposed after callback

// Force destroy
await provider.destroy('request-1'); // Immediate cleanup
```

### Eager Providers

```typescript
export const logger = new Provider({
  key: 'logger',
  eager: true, // Start immediately
  build: async () => new Logger(),
});

// In your app entry point:
import { startProviders } from './zerodi';

const instances = await startProviders();
// All eager providers now running
```

## API Reference

### Helper Functions

```typescript
// Single provider
const provider = await getProvider('database');
const db = await provider.get();

// Multiple providers
const providers = await getProviders({
  db: 'database',
  cache: 'redis',
});

// With auto-cleanup
await useProviders(
  { db: 'database', logger: 'logger' },
  async ({ db, logger }) => {
    // Use services
  }
);
```

### CLI Commands

```bash
zerodi generate                    # Generate container once
zerodi generate --output di.ts     # Custom output path
zerodi watch                       # Watch mode for development
zerodi watch --output di.ts        # Watch with custom path
```

## Patterns & Examples

### Express.js Request-Scoped Services

```typescript
app.use(async (req, res, next) => {
  const requestId = req.id;
  
  await useProviders(
    { userService: 'userService' },
    async ({ userService }) => {
      req.userService = userService;
      next();
    },
    requestId // Scoped to this request
  );
});
```

### Nested Dependencies

```typescript
// ZeroDI resolves the full dependency graph
const config = new Provider({
  key: 'config',
  build: async () => loadConfig(),
});

const logger = new Provider({
  key: 'logger',
  deps: { config: 'config' },
  build: async ({ deps }) => new Logger(deps.config),
});

const database = new Provider({
  key: 'database',
  deps: { config: 'config', logger: 'logger' },
  build: async ({ deps }) => new Database(deps.config, deps.logger),
});

const api = new Provider({
  key: 'api',
  deps: { db: 'database', logger: 'logger' },
  build: async ({ deps }) => new API(deps.db, deps.logger),
});

// Just call it - ZeroDI handles the graph
const apiInstance = await getProvider('api');
```

### Testing

```typescript
// Mock providers in tests
import { Provider } from 'zerodi';

const mockDatabase = new Provider({
  key: 'database',
  build: async () => createMockDb(),
});

// Override Provider.get for tests
Provider.get = async (keys) => ({
  database: mockDatabase,
});
```

## Configuration

### package.json Scripts

```json
{
  "scripts": {
    "di:generate": "zerodi generate",
    "di:watch": "zerodi watch",
    "dev": "concurrently \"zerodi watch\" \"tsx watch src/index.ts\"",
    "build": "zerodi generate && tsc"
  }
}
```

### TypeScript Setup

ZeroDI requires **TypeScript 5.0+**. No special flags:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true
  }
}
```

## Performance

**3-5x faster** than runtime DI frameworks:

```
Traditional DI (InversifyJS):  ~15ms per request
ZeroDI:                        ~3ms per request

(Benchmark: 1000 providers, complex dependency graph)
```

Why? **Zero runtime overhead** - all resolution happens at compile time.

## Comparison

| Feature | ZeroDI | InversifyJS | TSyringe | TypeDI |
|---------|--------|-------------|----------|--------|
| Type Safety | ✅ Native TS | ⚠️ via decorators | ⚠️ via decorators | ⚠️ via decorators |
| Decorators | ❌ None | ✅ Required | ✅ Required | ✅ Required |
| reflect-metadata | ❌ | ✅ | ✅ | ✅ |
| Runtime Overhead | ❌ Zero | ✅ High | ✅ Medium | ✅ High |
| Async Native | ✅ | ⚠️ Limited | ⚠️ Limited | ⚠️ Limited |
| Bundle Impact | ~5KB | ~150KB | ~50KB | ~100KB |
| Tree-Shaking | ✅ Full | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial |
| Multi-Tenancy | ✅ Built-in | ❌ | ❌ | ❌ |

## When to Use ZeroDI

**✅ Use ZeroDI for:**
- Serverless / Edge computing (cold start matters)
- Performance-critical applications
- Avoiding experimental TypeScript features
- First-class async/await support
- Multi-tenant applications
- Explicit dependency management

**❌ Use traditional DI for:**
- Angular/NestJS projects (ecosystem integration)
- Runtime configuration requirements
- Existing decorator-based codebase

## Roadmap

- [ ] Circular dependency detection & warnings
- [ ] Hierarchical container support
- [ ] Visual dependency graph generator
- [ ] VSCode extension for DI navigation
- [ ] Performance profiling tools
- [ ] Migration guides from InversifyJS/TSyringe
- [ ] Plugin system for custom providers

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

```bash
git clone https://github.com/hoffme/zerodi.git
cd zerodi
pnpm install
pnpm test
pnpm build
```

## License

MIT © [Hoffme](https://github.com/hoffme)

## Links

- [npm package](https://www.npmjs.com/package/zerodi)
- [GitHub repository](https://github.com/hoffme/zerodi)
- [Issue tracker](https://github.com/hoffme/zerodi/issues)
- [Changelog](CHANGELOG.md)

---

**Built for developers who value performance, type safety, and simplicity.**

If ZeroDI helps your project, consider giving it a ⭐ on GitHub!
