/**
 * Lightweight, dependency-free charts.
 *
 * lineChart(el, config)   responsive SVG line/area chart with crosshair tooltip
 *                         and keyboard support (← → when focused)
 * barList(items)          horizontal bars as HTML, direct-labelled
 * stackedBar(segments)    100% bar for part-to-whole (with legend)
 */
import { escapeHtml, html, render } from '../core/dom.js';
import { formatNumber } from '../core/format.js';

function niceMax(value, ticks = 4) {
  const raw = value / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return { max: step * ticks, step };
}

/**
 * @param {HTMLElement} el
 * @param {{ labels: string[], series: {name: string, values: number[], color: string, dashed?: boolean, fill?: boolean}[],
 *           formatLabel: (label: string) => string, formatTooltipLabel?: (label: string) => string,
 *           height?: number, ariaLabel: string }} config
 */
export function lineChart(el, config) {
  const { labels, series, formatLabel, formatTooltipLabel = formatLabel } = config;
  let active = null;

  el.classList.add('chart');
  el.tabIndex = 0;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', config.ariaLabel);

  function draw() {
    const width = el.clientWidth;
    if (!width) return;
    const height = config.height ?? (width < 480 ? 200 : 260);
    const pad = { top: 12, right: 8, bottom: 28, left: 34 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    const n = labels.length;
    const { max, step } = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
    const x = (i) => pad.left + (n <= 1 ? w / 2 : (i * w) / (n - 1));
    const y = (v) => pad.top + h - (v / max) * h;

    const gridLines = [];
    for (let v = 0; v <= max; v += step) gridLines.push(v);
    const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 72))));

    const line = (values) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const ids = `g${Math.random().toString(36).slice(2, 8)}`;

    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <defs><linearGradient id="${ids}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="var(--chart-1)" stop-opacity=".18"/><stop offset="1" stop-color="var(--chart-1)" stop-opacity="0"/>
      </linearGradient></defs>`;
    for (const v of gridLines) {
      svg += `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(v)}" y2="${y(v)}" stroke="var(--chart-grid)" ${v ? 'stroke-dasharray="3 4"' : ''}/>`;
      svg += `<text x="${pad.left - 8}" y="${y(v) + 4}" text-anchor="end">${formatNumber(v)}</text>`;
    }
    labels.forEach((label, i) => {
      if (i % labelEvery === 0 || i === n - 1) {
        if (i !== n - 1 && n - 1 - i < labelEvery * 0.6) return; // avoid collision with last label
        const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
        svg += `<text x="${x(i)}" y="${height - 8}" text-anchor="${anchor}">${escapeHtml(formatLabel(label))}</text>`;
      }
    });
    // Draw secondary series first so the primary sits on top.
    [...series].reverse().forEach((s) => {
      if (s.fill) svg += `<path d="${line(s.values)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="url(#${ids})"/>`;
      svg += `<path d="${line(s.values)}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dashed ? 'stroke-dasharray="4 4"' : ''}/>`;
    });
    if (active !== null) {
      svg += `<line x1="${x(active)}" x2="${x(active)}" y1="${pad.top}" y2="${pad.top + h}" stroke="var(--line-strong)"/>`;
      series.forEach((s) => {
        svg += `<circle cx="${x(active)}" cy="${y(s.values[active])}" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
      });
    }
    svg += `<rect x="${pad.left}" y="0" width="${w}" height="${height}" fill="transparent" data-overlay/></svg>`;
    // Only numbers, fixed tokens and escaped labels are interpolated above.
    el.innerHTML = svg;

    if (active !== null) {
      const tip = document.createElement('div');
      tip.className = 'chart-tip';
      render(tip, html`
        <p class="font-semibold mb-1">${formatTooltipLabel(labels[active])}</p>
        ${series.map((s) => html`
          <p class="flex items-center justify-between gap-4 text-ink-2">
            <span class="flex items-center"><span class="legend-swatch" style="background:${s.color}"></span>${s.name}</span>
            <span class="font-semibold text-ink">${formatNumber(s.values[active])}</span>
          </p>`)}`);
      el.append(tip);
      const left = Math.min(Math.max(0, x(active) - tip.offsetWidth / 2), width - tip.offsetWidth);
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(0, y(Math.max(...series.map((s) => s.values[active]))) - tip.offsetHeight - 14)}px`;
    }

    el._indexAt = (clientX) => {
      const r = el.getBoundingClientRect();
      const i = Math.round(((clientX - r.left - pad.left) / w) * (n - 1));
      return Math.max(0, Math.min(n - 1, i));
    };
  }

  el.addEventListener('pointermove', (e) => {
    const i = el._indexAt(e.clientX);
    if (i !== active) {
      active = i;
      draw();
    }
  });
  el.addEventListener('pointerleave', () => {
    active = null;
    draw();
  });
  el.addEventListener('blur', () => {
    active = null;
    draw();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    active = Math.max(0, Math.min(labels.length - 1, (active ?? labels.length) + (e.key === 'ArrowLeft' ? -1 : 1)));
    draw();
  });

  new ResizeObserver(draw).observe(el);
  draw();
}

/** Horizontal bars, single hue, value labelled at the end. */
export const barList = (items, { format = formatNumber } = {}) => {
  const max = Math.max(1, ...items.map((i) => i.value));
  return html`
    <ul class="space-y-3.5">
      ${items.map((item) => html`
        <li>
          <div class="flex items-baseline justify-between gap-3 mb-1.5 text-[13px]">
            <span class="text-ink-2 truncate">${item.label}</span>
            <span class="font-semibold tabular-nums">${format(item.value)}${item.note ? html`<span class="font-normal text-ink-3"> ${item.note}</span>` : ''}</span>
          </div>
          <div class="bar-track" role="presentation"><div class="bar-fill" style="width:${((item.value / max) * 100).toFixed(1)}%"></div></div>
        </li>`)}
    </ul>`;
};

/** Part-to-whole bar with a 2px gap between segments and a labelled legend. */
export const stackedBar = (segments) => {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return html`
    <div class="flex h-3 gap-0.5 rounded overflow-hidden" role="img" aria-label="${segments.map((s) => `${s.label}: ${s.value}`).join(', ')}">
      ${segments.filter((s) => s.value).map((s) => html`<div style="width:${(s.value / total) * 100}%;background:${s.color}" title="${s.label}: ${formatNumber(s.value)}"></div>`)}
    </div>
    <ul class="grid grid-cols-2 gap-x-4 gap-y-3 mt-5">
      ${segments.map((s) => html`
        <li class="flex items-start gap-2.5">
          <span class="mt-1.5 size-2.5 rounded-sm shrink-0" style="background:${s.color}"></span>
          <span>
            <span class="block text-[13px] text-ink-3">${s.label}</span>
            <span class="font-semibold tabular-nums">${formatNumber(s.value)}</span>
            <span class="text-[12.5px] text-ink-3">${Math.round((s.value / total) * 100)}%</span>
          </span>
        </li>`)}
    </ul>`;
};
