# Contributing to ZeroDI

Thank you for considering contributing to ZeroDI! 🎉

## Getting Started

```bash
# Fork and clone the repo
git clone https://github.com/your-username/zerodi.git
cd zerodi

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Run in watch mode during development
pnpm dev
```

## Project Structure

```
zerodi/
├── packages/
│   └── zerodi/
│       ├── src/
│       │   ├── index.ts      # Provider runtime
│       │   ├── cli.ts        # Code generation CLI
│       │   └── __tests__/    # Unit tests
│       └── tests/            # Integration tests
├── examples/                 # Usage examples
└── README.md
```

## Development Workflow

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Write code following existing patterns
   - Add tests for new features
   - Update documentation if needed

3. **Test your changes**
   ```bash
   pnpm test           # Run tests
   pnpm lint           # Check code style
   pnpm build          # Ensure it builds
   ```

4. **Commit using conventional commits**
   ```bash
   git commit -m "feat: add circular dependency detection"
   git commit -m "fix: resolve buildId isolation bug"
   git commit -m "docs: improve quickstart guide"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Adding/updating tests
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `chore:` Maintenance tasks

## Testing Guidelines

- Write unit tests for Provider logic (`src/__tests__/`)
- Write integration tests for CLI (`tests/`)
- Aim for >80% coverage
- Test edge cases and error scenarios

```typescript
// Example test structure
describe('Provider - Feature', () => {
  it('should handle specific case', async () => {
    const provider = new Provider({
      key: 'test',
      build: async () => ({ value: 42 }),
    });
    
    const instance = await provider.get();
    expect(instance.value).toBe(42);
  });
});
```

## Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Run `pnpm lint:fix` before committing
- Keep functions small and focused
- Add JSDoc for public APIs

## Documentation

- Update README.md for user-facing changes
- Add inline comments for complex logic
- Include examples in `/examples` for new features
- Keep CHANGELOG.md updated

## Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add changeset if needed: `pnpm changeset`
4. Reference related issues
5. Wait for review

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Changeset added
- [ ] Follows code style
```

## Reporting Issues

### Bug Reports

Include:
- ZeroDI version
- TypeScript version
- Minimal reproduction
- Expected vs actual behavior
- Error messages/stack traces

### Feature Requests

Describe:
- Use case and motivation
- Proposed API (if applicable)
- Alternative solutions considered
- Impact on existing features

## Questions?

- GitHub Discussions: Ask questions
- Issues: Report bugs or request features
- Discord: [Coming soon]

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
