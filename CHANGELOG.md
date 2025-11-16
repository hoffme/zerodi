# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive test suite (unit + integration)
- Improved documentation and examples

## [0.1.0] - 2024-11-15

### Added
- Initial release
- Core `Provider` class with lifecycle management
- CLI for code generation (`zerodi generate`)
- Watch mode for development (`zerodi watch`)
- Type-safe provider resolution
- Dependency injection with `deps` option
- Reference counting for automatic cleanup
- `buildId` support for scoped instances
- Singleton provider support
- Eager provider loading
- Hidden providers for internal dependencies
- Helper functions: `getProvider`, `getProviders`, `useProviders`
- Auto-generated TypeScript types

### Features
- Zero runtime overhead (compile-time DI)
- No decorators required
- No `reflect-metadata` dependency
- Async-first architecture
- Tree-shakeable exports
- Full TypeScript IntelliSense support

[Unreleased]: https://github.com/hoffme/zerodi/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/hoffme/zerodi/releases/tag/v0.1.0
