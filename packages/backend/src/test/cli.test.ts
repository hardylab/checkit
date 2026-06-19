import { describe, it, expect, vi } from 'vitest';
import { runCLI, handleFatalError } from '../cli';

vi.mock('glob');
vi.mock('fs');
vi.mock('process');

describe('cli', () => {
  it('should exist', () => {
    expect(runCLI).toBeDefined();
    expect(handleFatalError).toBeDefined();
  });
});
