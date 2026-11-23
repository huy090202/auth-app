/** The AuthGate Portal's sign-up page. `VITE_PORTAL_URL` overrides the base; a trailing slash is dropped. */
const base = (import.meta.env.VITE_PORTAL_URL ?? 'https://portal.authgatehq.com').replace(/\/+$/, '');
export const portalSignUpUrl = `${base}/sign-up`;
