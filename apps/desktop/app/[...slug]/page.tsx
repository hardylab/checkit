// Catch-all route — Next.js renders this for any path under /.
// Required so deep links like `/rules/no-console-log` or `/ai-fix/foo.json/0`
// resolve to the SPA instead of 404. BrowserRouter takes over once the SPA
// mounts and parses `window.location.pathname` to render the right view.
//
// Without this catch-all, deep links 404 on the server before the SPA ever
// loads — defeats the purpose of a SPA.

import Page from '../page';

export default Page;