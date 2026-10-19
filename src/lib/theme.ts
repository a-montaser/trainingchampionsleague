/**
 * Shared by the root layout (server) and the theme toggle (client).
 *
 * It must live outside the `'use client'` toggle module: a server component
 * that imports a plain value from a client module receives a client reference,
 * not the value, so the layout would look up the wrong cookie and always
 * render dark.
 */
export const THEME_COOKIE_KEY = 'tcl-theme';

export type Theme = 'dark' | 'light';
