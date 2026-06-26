// Client-side root. We disable SSR for the router subtree because
// react-router's BrowserRouter touches `window.document` during render
// and Next 14 will pre-render the page tree (which would crash with
// "document is not defined").
//
// We use `next/dynamic({ ssr: false })` to load the router subtree
// only on the client. BrowserRouter takes over once mounted and reads
// `window.location.pathname` to render the right view.
//
// Deep links (e.g. `/rules/no-console-log`) hit the `[...slug]` catch-all
// which re-exports this same Page component, so the SPA loads at any path.

'use client';

import dynamic from 'next/dynamic';

const SpApp = dynamic(() => import('./SpApp').then((m) => m.SpApp), {
  ssr: false,
  loading: () => <div style={{ visibility: 'hidden' }} />,
});

export default function Page() {
  return <SpApp />;
}
