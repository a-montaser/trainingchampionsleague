/**
 * `server-only` throws unless it is resolved under React's `react-server`
 * condition, which Vitest does not set. Aliasing it to this empty module lets
 * the tests import server modules directly; it changes nothing about how Next
 * builds them, where the real package still guards against client imports.
 */
export {};
