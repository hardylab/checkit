// Server component wrapper. The actual SPA shell lives in SpApp (client).
// Server wrapper exists so Next renders a stable HTML tree on first paint
// (and so the root page is never treated as "not found" — an empty Client
// Component tree at the root triggers Next's 404 fallback).
import { SpApp } from './SpApp';

export default function Page() {
  return <SpApp />;
}
