// Mobile (Capacitor) build is a pure client-rendered SPA: VITE_MOBILE=true is set
// by `npm run build:mobile`, which disables SSR app-wide so adapter-static emits a
// single index.html fallback. The web build leaves SSR on (default) — unchanged.
export const ssr = import.meta.env.VITE_MOBILE !== 'true';
