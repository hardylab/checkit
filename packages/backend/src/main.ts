// spec:[spec](/specs/backend/main.md)
import { runCLI, handleFatalError } from './cli';

// Force UTF-8 stdout. On Windows, Node's stdout defaults to the active
// console code page (e.g. GBK / cp936), which mojibakes non-ASCII output
// when read by a parent process expecting UTF-8 (e.g. desktop apps spawn
// `lintany chat --no-tui --json` and pipe the result to fetch's response).
// Node 18+ supports setDefaultEncoding; this is a no-op on POSIX.
if (typeof process.stdout.setDefaultEncoding === 'function') {
  process.stdout.setDefaultEncoding('utf-8');
}
if (typeof process.stderr.setDefaultEncoding === 'function') {
  process.stderr.setDefaultEncoding('utf-8');
}

runCLI().catch(handleFatalError);
