// Intentionally broken — 5 issues for CheckIt to fix.
// Run `pnpm review` to see them. Then run `pnpm ai-fix` to let AI repair them.

export function greet(name: string): string {
  console.log('should not be in production');      // issue: console.log
  const value: any = name;                         // issue: any type
  return `hello, ${value}`;
}

export function twice(n: number): number {
  console.debug('debug call');                     // issue: console.log (catches debug too)
  return n * 2;
}

export const data = {
  foo: 'bar',
  baz: 42,
};
console.log(data);                                 // issue: console.log at top level