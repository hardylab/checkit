// Client-side root. We disable SSR for the router subtree because
// react-router's HashRouter touches `window.document` during render
// and Next 14 will pre-render the page tree (which would crash with
// "document is not defined").
//
// We use `next/dynamic({ ssr: false })` to load the router subtree
// only on the client. Inside we use react-router's <MemoryRouter>
// because the desktop app is served from a single URL (/) — there's
// no real path navigation, only in-app state changes. MemoryRouter
// gives us routing primitives (Routes, Route, useNavigate, useParams)
// without touching the URL, which fits a SPA that wants URL semantics
// inside the renderer but no path changes from the browser.

'use client';

import dynamic from 'next/dynamic';

const SpApp = dynamic(() => import('./SpApp').then((m) => m.SpApp), {
  ssr: false,
  loading: () => <div style={{ visibility: 'hidden' }} />,
});

export default function Page() {
  return <SpApp />;
}
