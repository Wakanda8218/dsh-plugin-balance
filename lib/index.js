/**
 * Host loader entry for the browser-only balance plugin.
 *
 * The visible part is the browser bundle under `dsh.client` (`lib/client.js`),
 * which the client module system serves from `/plugins`; this host half has no
 * behavior of its own, exactly like the shipped browser-only client packages.
 */
export function apply() {}
