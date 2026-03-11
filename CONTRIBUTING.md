# Contributing to Mavibase

Thank you for your interest in contributing to Mavibase! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

---

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in all interactions.

### Our Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

---

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 20+
- pnpm 8+
- PostgreSQL 14+
- Redis 6+
- Git

### Finding Issues

- Look for issues labeled `good first issue` for beginner-friendly tasks
- Check `help wanted` labels for issues where we need community input
- Feel free to ask questions on any issue before starting work

---

## Development Setup

1. **Fork the repository**

   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/mavibase.git
   cd mavibase
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/mavibase/mavibase.git
   ```

4. **Install dependencies**

   ```bash
   pnpm install
   ```

5. **Set up environment**

   ```bash
   cp .env.example .env
   # Edit .env with your local database credentials
   ```

6. **Run migrations**

   ```bash
   pnpm migrate
   ```

7. **Start development servers**

   ```bash
   pnpm dev:all
   ```

---

## Making Changes

### Branch Naming

Create a branch with a descriptive name:

```bash
git checkout -b type/description
```

**Branch types:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests
- `chore/` - Maintenance tasks

**Examples:**
- `feature/add-webhook-support`
- `fix/query-parser-null-handling`
- `docs/update-api-reference`

### Keep Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, semicolons, etc.) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or dependencies |
| `ci` | CI/CD configuration |
| `chore` | Other changes |

### Scopes

- `api` - API package changes
- `database` - Database package changes
- `platform` - Platform package changes
- `core` - Core package changes
- `console` - Web console changes
- `server` - Server app changes
- `docs` - Documentation

### Examples

```bash
feat(api): add bulk document creation endpoint

fix(database): handle null values in query parser

docs(api): update authentication examples

refactor(platform): simplify session management logic
```

---

## Pull Request Process

1. **Ensure your code is ready**
   - All tests pass (`pnpm test`)
   - Code is linted (`pnpm lint`)
   - Documentation is updated if needed

2. **Create the Pull Request**
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe your changes in detail

3. **PR Title Format**
   
   Follow the same format as commits:
   ```
   feat(api): add bulk document creation endpoint
   ```

4. **PR Description Template**

   ```markdown
   ## Description
   Brief description of changes.

   ## Related Issues
   Fixes #123

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Checklist
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] Code follows style guidelines
   ```

5. **Review Process**
   - A maintainer will review your PR
   - Address any requested changes
   - Once approved, your PR will be merged

---

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Enable strict mode
- Define explicit types (avoid `any`)
- Use interfaces for object shapes
- Document public APIs with JSDoc

### Style Guide

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas
- Use semicolons
- Maximum line length: 100 characters

### File Organization

```typescript
// 1. Imports (external, then internal)
import express from 'express';
import { Router } from 'express';

import { DatabaseService } from '@mavibase/database';
import { ApiError } from '@mavibase/core';

// 2. Types/Interfaces
interface RequestBody {
  name: string;
}

// 3. Constants
const MAX_LIMIT = 100;

// 4. Main code
export class Controller {
  // ...
}
```

### Error Handling

- Use custom error classes from `@mavibase/core`
- Always include meaningful error messages
- Log errors appropriately
- Return consistent error responses

---

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm test --filter @mavibase/api

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Writing Tests

- Place tests in `__tests__` directories or `*.test.ts` files
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies

### Test Structure

```typescript
describe('DatabaseService', () => {
  describe('create', () => {
    it('should create a new database', async () => {
      // Arrange
      const input = { name: 'test-db' };
      
      // Act
      const result = await service.create(input);
      
      // Assert
      expect(result.name).toBe('test-db');
    });

    it('should throw error for duplicate name', async () => {
      // ...
    });
  });
});
```

---

## Documentation

### When to Update Docs

- Adding new features
- Changing API behavior
- Fixing bugs that affect documented behavior
- Improving existing documentation

### Documentation Style

- Use clear, concise language
- Include code examples
- Document all parameters and return values
- Keep examples up to date

### Doc Locations

| Type | Location |
|------|----------|
| API Reference | `docs/api/` |
| Guides | `docs/guides/` |
| Concepts | `docs/concepts/` |
| Architecture | `docs/architecture/` |

---

## Areas for Contribution

### High Priority

- Bug fixes and stability improvements
- Performance optimizations
- Test coverage improvements
- Documentation improvements

### Feature Development

- New query operators
- SDK development (JavaScript, Python, Go)
- Webhook system
- File storage integration

### Community

- Answering questions in Discussions
- Reviewing pull requests
- Writing tutorials and blog posts
- Reporting bugs

---

## Community

### Getting Help

- **GitHub Discussions** - Ask questions and share ideas
- **Telegram** - Join our community chat
- **GitHub Issues** - Report bugs or request features

### Recognition

All contributors are recognized in our release notes and on our website. We appreciate every contribution, no matter how small!

---

## License

By contributing to Mavibase, you agree that your contributions will be licensed under the Apache License 2.0.

---

Thank you for contributing to Mavibase!
