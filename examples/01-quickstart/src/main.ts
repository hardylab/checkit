// Deliberately bad code — checkit should flag every line below.
// After running `pnpm review`, you'll see issues for: console.log,
// any type, missing index.ts barrel.

export function greet(name: string): string {
  // 1. console.log (removed — avoid side effects in pure functions)
  const value: any = name; // 2. any type
  return `hello, ${value}`;
}
