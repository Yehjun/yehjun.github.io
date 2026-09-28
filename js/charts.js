// Small SVG charts for the writing pages: hover tooltips, a table view, and
// colors from CSS tokens (--c1 / --c2) so dark mode picks its own steps.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, cls, anchor) {
    const t = el('text', { x, y, class: cls || 'ct', 'text-anchor': anchor || 'middle' }, parent);
    t.textContent = s;
    return t;
  }
  // Bar with 4px rounded data-end, square at the baseline.
  function barPath(x, y0, w, y1) {
    const r = Math.min(4, w / 2, Math.abs(y0 - y1));
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  }

  let tip;
  function showTip(evt, html) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'ctip'; document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.display = 'block';
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + w > innerWidth - 8) x = evt.clientX - w - pad;
    if (y + h > innerHeight - 8) y = evt.clientY - h - pad;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  function hover(node, html) {
    node.addEventListener('mousemove', e => showTip(e, html));
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('touchstart', e => showTip(e.touches[0], html), { passive: true });
  }

  function legend(fig, series) {
    if (!series || series.length < 2) return;
    const l = document.createElement('div'); l.className = 'clegend';
    series.forEach((s, i) => { l.innerHTML += `<span><i class="s${i}"></i>${s}</span>`; });
    fig.insertBefore(l, fig.querySelector('.cbody'));
  }
  function table(fig, head, rows) {
    const d = document.createElement('details'); d.className = 'ctable';
    d.innerHTML = '<summary>Show as table</summary><table><tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr>' +
      rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</table>';
    fig.appendChild(d);
  }
  function body(fig) { let b = fig.querySelector('.cbody'); if (!b) { b = document.createElement('div'); b.className = 'cbody'; fig.insertBefore(b, fig.querySelector('figcaption')); } return b; }

  // Small multiples of two-bar panels. spec: {series:[a,b], panels:[{title, sub, fmt, max, bars:[{label, value, s, tip}]}]}
  function panels(fig, spec) {
    const b = body(fig); b.classList.add('cpanels');
    legend(fig, spec.series);
    const rows = [];
    spec.panels.forEach(p => {
      const wrap = document.createElement('div'); wrap.className = 'cpanel';
      wrap.innerHTML = `<div class="cpt">${p.title}</div>` + (p.sub ? `<div class="cps">${p.sub}</div>` : '');
      const W = 240, H = 190, top = 26, base = H - 30;
      const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': p.title }, null);
      const max = p.max || Math.max(...p.bars.map(d => d.value)) * 1.15;
      const min = p.min || 0;
      const y = v => base - (v - min) / (max - min) * (base - top);
      el('line', { x1: 8, x2: W - 8, y1: base, y2: base, class: 'cbase' }, svg);
      const n = p.bars.length, bw = Math.min(56, (W - 40) / n - 18), gap = (W - n * bw) / (n + 1);
      p.bars.forEach((d, i) => {
        const x = gap + i * (bw + gap);
        el('path', { d: barPath(x, base, bw, y(d.value)), class: 'cbar s' + d.s }, svg);
        txt(svg, x + bw / 2, y(d.value) - 8, (p.fmt || (v => v))(d.value), 'cval');
        txt(svg, x + bw / 2, base + 18, d.label, 'ct');
        const hit = el('rect', { x: x - gap / 2 + 2, y: top - 20, width: bw + gap - 4, height: base - top + 40, class: 'chit' }, svg);
        hover(hit, `<b>${p.title}</b><br>${d.label}: ${(p.fmt || (v => v))(d.value)}${d.tip ? '<br>' + d.tip : ''}`);
        rows.push([p.title, d.label, (p.fmt || (v => v))(d.value)]);
      });
      wrap.appendChild(svg);
      if (p.foot) wrap.insertAdjacentHTML('beforeend', `<div class="cfoot">${p.foot}</div>`);
      b.appendChild(wrap);
    });
    table(fig, ['Panel', 'Group', 'Value'], rows);
  }

  // Coefficient plot. spec: {min, max, ticks, rows:[{label, est, lo, hi, sub, muted}]}
  function forest(fig, spec) {
    const b = body(fig);
    const W = 640, rowH = 44, left = 230, right = 24, top = 10, H = top + spec.rows.length * rowH + 34;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Estimates with 95% intervals' }, b);
    const x = v => left + (v - spec.min) / (spec.max - spec.min) * (W - left - right);
    spec.ticks.forEach(t => {
      el('line', { x1: x(t), x2: x(t), y1: top, y2: H - 28, class: t === 0 ? 'czero' : 'cgrid' }, svg);
      txt(svg, x(t), H - 10, String(t), 'ct');
    });
    const rows = [];
    spec.rows.forEach((r, i) => {
      const cy = top + i * rowH + rowH / 2;
      txt(svg, 8, cy - 2, r.label, 'cl', 'start');
      if (r.sub) txt(svg, 8, cy + 14, r.sub, 'cs', 'start');
      el('line', { x1: x(r.lo), x2: x(r.hi), y1: cy, y2: cy, class: 'cci' + (r.muted ? ' m' : '') }, svg);
      el('circle', { cx: x(r.est), cy, r: 5.5, class: 'cdot' + (r.muted ? ' m' : '') }, svg);
      const hit = el('rect', { x: 0, y: cy - rowH / 2, width: W, height: rowH, class: 'chit' }, svg);
      const s = `${r.est.toFixed(2)} [${r.lo.toFixed(2)}, ${r.hi.toFixed(2)}]`;
      hover(hit, `<b>${r.label}</b><br>estimate ${s}${r.tip ? '<br>' + r.tip : ''}`);
      rows.push([r.label + (r.sub ? ' — ' + r.sub : ''), r.est.toFixed(2), `[${r.lo.toFixed(2)}, ${r.hi.toFixed(2)}]`]);
    });
    table(fig, ['Estimate', 'b', '95% interval'], rows);
  }

  // Line with a confidence band and a crosshair. spec: {xlab, ylab, fmt, pts:[{x, y, lo, hi}], ymin, ymax, xticks, yticks}
  function band(fig, spec) {
    const b = body(fig);
    const W = 640, H = 300, L = 56, R = 20, T = 16, B = 44;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': spec.ylab }, b);
    const xs = spec.pts.map(p => p.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const x = v => L + (v - x0) / (x1 - x0) * (W - L - R), y = v => H - B - (v - spec.ymin) / (spec.ymax - spec.ymin) * (H - T - B);
    spec.yticks.forEach(t => { el('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), class: 'cgrid' }, svg); txt(svg, L - 8, y(t) + 4, spec.fmt(t), 'ct', 'end'); });
    spec.xticks.forEach(t => txt(svg, x(t.v), H - B + 20, t.l, 'ct'));
    txt(svg, (L + W - R) / 2, H - 6, spec.xlab, 'cs');
    const up = spec.pts.map(p => `${x(p.x)},${y(p.hi)}`).join(' L'), dn = spec.pts.slice().reverse().map(p => `${x(p.x)},${y(p.lo)}`).join(' L');
    el('path', { d: `M${up} L${dn}Z`, class: 'cband' }, svg);
    el('path', { d: 'M' + spec.pts.map(p => `${x(p.x)},${y(p.y)}`).join(' L'), class: 'cline' }, svg);
    const cross = el('line', { y1: T, y2: H - B, class: 'ccross', style: 'display:none' }, svg);
    const dot = el('circle', { r: 5, class: 'cdot', style: 'display:none' }, svg);
    const hit = el('rect', { x: L, y: T, width: W - L - R, height: H - T - B, class: 'chit' }, svg);
    function move(e) {
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const lx = pt.matrixTransform(svg.getScreenCTM().inverse()).x;
      let best = spec.pts[0]; spec.pts.forEach(p => { if (Math.abs(x(p.x) - lx) < Math.abs(x(best.x) - lx)) best = p; });
      cross.setAttribute('x1', x(best.x)); cross.setAttribute('x2', x(best.x)); cross.style.display = '';
      dot.setAttribute('cx', x(best.x)); dot.setAttribute('cy', y(best.y)); dot.style.display = '';
      showTip(e, `${spec.xname(best.x)}<br><b>${spec.fmt(best.y)}</b> ${spec.ylab}<br>95% interval ${spec.fmt(best.lo)} – ${spec.fmt(best.hi)}`);
    }
    hit.addEventListener('mousemove', move);
    hit.addEventListener('mouseleave', () => { cross.style.display = 'none'; dot.style.display = 'none'; hideTip(); });
    table(fig, [spec.xlab, spec.ylab, '95% interval'], spec.pts.map(p => [spec.xname(p.x), spec.fmt(p.y), `${spec.fmt(p.lo)} – ${spec.fmt(p.hi)}`]));
  }

  window.Charts = { panels, forest, band };
})();
