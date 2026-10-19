/**
 * Tiny, safe templating.
 *
 * `html` is a tagged template: every interpolated value is HTML-escaped unless
 * it is itself the result of `html` / `raw`. Use `render()` to write a template
 * into the page — it refuses plain strings, so user input can never reach
 * innerHTML unescaped by accident.
 */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

/** Mark a string as trusted markup. Only use with markup you wrote yourself. */
export const raw = (markup) => new SafeHtml(markup);

const format = (value) => {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(format).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(value);
};

export const html = (strings, ...values) =>
  raw(strings.reduce((out, str, i) => out + str + (i < values.length ? format(values[i]) : ''), ''));

export function render(el, template) {
  if (!(template instanceof SafeHtml)) throw new TypeError('render() expects an html`` template');
  el.innerHTML = template.value;
  return el;
}

/** Append a template's markup to the end of `el` (same safety rules as render). */
export function appendHtml(el, template) {
  if (!(template instanceof SafeHtml)) throw new TypeError('appendHtml() expects an html`` template');
  el.insertAdjacentHTML('beforeend', template.value);
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Delegated event listener: handler(event, matchedElement). */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(event, target);
  });
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
