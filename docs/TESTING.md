# Testing Guide

This document describes the testing infrastructure and best practices for the miki project.

## Overview

The project uses [Vitest](https://vitest.dev/) as the testing framework. Vitest is a fast, modern testing framework that works seamlessly with TypeScript and provides a Jest-compatible API.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with UI (opens a browser-based interface)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

### Location
Tests are located alongside their source files with a `.test.ts` extension:
- `src/core/python-bridge.test.ts` - Tests for Python bridge communication
- `src/adk/tools/macos-tool-suite.test.ts` - Tests for macOS tool suite
- `src/adk/orchestrator.test.ts` - Tests for agent orchestrator

### Organization
Each test file follows this structure:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('ComponentName', () => {
  describe('feature group', () => {
    it('should do something specific', () => {
      // Arrange
      const input = setupTestData();
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expectedValue);
    });
  });
});
```

## Test Coverage

Current test coverage includes:

### PythonBridge (`src/core/python-bridge.test.ts`)
- ✓ Coordinate normalization logic
- ✓ JSON parsing and error handling
- ✓ Retry mechanism with exponential backoff
- ✓ Timeout calculation

### MacOSToolSuite (`src/adk/tools/macos-tool-suite.test.ts`)
- ✓ Coordinate normalization for different screen sizes
- ✓ Tool types and structure validation
- ✓ Wait tool duration calculations
- ✓ Tool response formatting
- ✓ Screenshot data handling

### MacOSAgentOrchestrator (`src/adk/orchestrator.test.ts`)
- ✓ Event type structures
- ✓ Phase label mappings (Japanese)
- ✓ Screen size and browser state management
- ✓ Session state management
- ✓ Error message formatting
- ✓ Step counting and stop request handling

## Writing Tests

### Basic Test
```typescript
import { describe, it, expect } from 'vitest';

describe('MyFunction', () => {
  it('should return expected result', () => {
    const result = myFunction(input);
    expect(result).toBe(expectedOutput);
  });
});
```

### Testing with Mocks
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyComponent', () => {
  it('should call dependency with correct args', () => {
    const mockFn = vi.fn();
    myComponent(mockFn);
    
    expect(mockFn).toHaveBeenCalledWith(expectedArgs);
  });
});
```

### Async Tests
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

## Best Practices

1. **Keep tests simple and focused**: Each test should verify one specific behavior
2. **Use descriptive test names**: Test names should clearly state what is being tested
3. **Follow the Arrange-Act-Assert pattern**: Organize test code into setup, execution, and verification
4. **Avoid testing implementation details**: Focus on testing behavior and outputs
5. **Keep tests independent**: Tests should not rely on the execution order or state from other tests
6. **Use appropriate assertions**: Choose the most specific assertion for what you're testing

## Test Categories

### Unit Tests
Test individual functions and classes in isolation. Most of our current tests are unit tests.

Example: Testing coordinate normalization logic in `MacOSToolSuite`

### Integration Tests
*(Not yet implemented)* Would test how multiple components work together.

### End-to-End Tests
*(Not yet implemented)* Would test the full application flow.

## Continuous Integration

Tests are automatically run on:
- Pull request creation/update
- Push to main branches
- Manual workflow dispatch

## Troubleshooting

### Tests not found
Make sure your test files:
- Are in the `src/` directory
- Have the `.test.ts` or `.spec.ts` extension
- Are properly imported

### Mocking issues
When mocking external dependencies:
- Use `vi.mock()` at the top of your test file
- Avoid using module-level variables in mock factories
- Use `vi.fn()` for function mocks

### Timeout errors
If tests timeout:
- Check for unresolved promises
- Increase timeout with `it('test', async () => {...}, 10000)` (10 seconds)
- Use `await` properly with async code

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://vitest.dev/guide/features.html)
- [Vitest API Reference](https://vitest.dev/api/)
