// Is a newer stable release out? One check per launch, silent when offline: the tool often runs
// on customer networks without Internet access. NO_UPDATE_CHECK=1 turns it off.
import { version as current } from '../package.json';

export const REPO = 'Exe64/ultimate-ntnx-asbuilt';
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;
export const TIMEOUT_MS = 5000;

/** Nothing to show: up to date, offline, disabled, or an answer we could not read. */
export const NONE = { available: false };

/** `a` newer than `b`, both `x.y.z` (a leading `v` is ignored). */
export function isNewer(a, b) {
  const parse = (v) => String(v).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

/** A promise that gives up after `ms`, so a silent network never holds the page. */
export function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })])
    .finally(() => clearTimeout(timer));
}

/**
 * Portable executables: the latest GitHub release, by its tag. `/releases/latest` skips
 * pre-releases and drafts, so only stable versions are offered.
 */
export async function checkGithub({ url = LATEST_API, installed = current, timeoutMs = TIMEOUT_MS } = {}) {
  try {
    const res = await withTimeout(fetch(url, { headers: { accept: 'application/vnd.github+json' } }), timeoutMs);
    if (!res.ok) return NONE;
    const { tag_name: tag, html_url: page } = await res.json();
    if (!tag || !isNewer(tag, installed)) return NONE;
    return { available: true, version: tag.replace(/^v/, ''), url: page || RELEASES_URL, canApply: false };
  } catch { return NONE; }
}

/**
 * The update source the server reports. `check` resolves to what `/api/update` answers;
 * `apply` (desktop only) prepares the update and resolves to the function that restarts on it.
 * Disabled: nothing is ever fetched.
 */
export function updateSource({ check = () => checkGithub(), apply = null, env = process.env } = {}) {
  if (env.NO_UPDATE_CHECK === '1') return { result: Promise.resolve(NONE), apply: null };
  // Started now, once: the page asks later, and gets the same answer however often it asks.
  const result = Promise.resolve().then(check).catch(() => NONE);
  return { result, apply };
}
