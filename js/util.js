// Small helpers: text, dates, codes (QR / number / barcode), CSV, dialogs, camera scanner.
(function () {
  const C = window.CONFIG;
  const U = {};

  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.money = (n) => '$' + Number(n || 0).toLocaleString('en-AU');
  U.plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');

  // ---- dates (always Melbourne time) ----
  const TZ = 'Australia/Melbourne';
  U.date = (iso) => {                // "2026-11-14" -> "Sat 14 Nov"
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  U.time = (t) => {                  // "18:30" -> "6:30pm"
    if (!t) return '';
    let [h, mi] = String(t).split(':').map(Number);
    const ap = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return h + (mi ? ':' + String(mi).padStart(2, '0') : '') + ap;
  };
  U.when = (ts) => {                 // timestamp -> "Sat 7 Nov, 6:42pm"
    if (!ts) return '';
    const d = new Date(ts);
    const day = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
    const tm = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ }).replace(/\s/g, '').toLowerCase();
    return day.replace(',', '') + ', ' + tm;
  };
  U.today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });   // "2026-10-29"

  // ---- stamps ----
  U.stampTotal = (s) => Object.values(s.stamps || {}).reduce((a, b) => a + Number(b), 0);
  U.stampsAt = (s, shopId) => Number((s.stamps || {})[shopId] || 0);
  U.rewardsLeft = (s, shopId) =>
    Math.floor(U.stampsAt(s, shopId) / C.stampsForReward) - Number((s.rewards_used || {})[shopId] || 0);

  // "1234" or "cms-1234" -> "CMS-1234"
  U.normCode = (v) => {
    let c = String(v || '').trim().toUpperCase();
    if (c && !c.startsWith('CMS-')) c = 'CMS-' + c;
    return c;
  };

  // ---- colours ----
  U.textOn = (hex) => {
    const h = String(hex || '#000000').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? '#1E0B45' : '#FFFFFF';
  };

  // ---- codes ----
  U.qrSvg = (text, cell) => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: cell || 4, margin: 0, scalable: true });
  };
  U.barcodeSvg = (text) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(svg, text, { format: 'CODE128', width: 2, height: 64, displayValue: false, background: '#FFFFFF', lineColor: '#1E0B45', margin: 10 });
    } catch (e) { return ''; }
    return svg.outerHTML;
  };
  // How the customer's code looks: QR code, number or barcode.
  U.codeBlock = (code, style) => {
    const e = U.esc(code);
    if (style === 'number') {
      return `<div class="pass-num">${U.esc(String(code).replace(/^CMS-/, ''))}</div><div class="pass-code">Your number</div>`;
    }
    if (style === 'barcode') {
      return `<div class="qr" role="img" aria-label="Barcode for ${e}">${U.barcodeSvg(code)}</div><div class="pass-code">${e}</div>`;
    }
    return `<div class="qr" role="img" aria-label="QR code for ${e}">${U.qrSvg(code, 4)}</div><div class="pass-code">${e}</div>`;
  };
  U.styleName = (s) => ({ qr: 'QR code', number: 'Number', barcode: 'Barcode' }[s] || 'QR code');

  // ---- CSV (opens in Excel or Google Sheets) ----
  // Cells that start with = + - @ are made safe so a spreadsheet won't run them as formulas.
  U.csv = (columns, rows) => {
    const cell = (v) => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const lines = [columns.map((c) => cell(c.label)).join(',')];
    rows.forEach((r) => lines.push(columns.map((c) => cell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(',')));
    return '﻿' + lines.join('\r\n');
  };
  U.download = (filename, text) => {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  // ---- toast ----
  let toastTimer;
  U.toast = (msg, bad) => {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.toggle('bad', !!bad);
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 3500);
  };

  // ---- dialog ----
  const dlg = () => document.getElementById('dlg');
  let onClose = null;
  U.closeDialog = () => { const d = dlg(); if (d.open) d.close(); };
  U.openDialog = (html, closeCb) => {
    const d = dlg();
    d.innerHTML = html;
    onClose = closeCb || null;
    if (!d.open) d.showModal();
    return d;
  };
  document.addEventListener('close', (e) => {
    if (e.target.id === 'dlg' && onClose) { const f = onClose; onClose = null; f(); }
  }, true);

  // ---- camera scanner ----
  // opts: {title, onCode(code) -> returns error text or '', list: [{label, code}] (optional), after()}
  U.openScanner = (opts) => {
    const pick = (opts.list || [])
      .map((p, i) => `<button type="button" class="btn ghost" data-i="${i}">${U.esc(p.label)}</button>`)
      .join('');
    const d = U.openDialog(
      `<h2>${U.esc(opts.title)}</h2>
       ${opts.list ? `<p class="muted">Demo: pick someone from the list.</p>
         <div class="picklist">${pick || '<p>No one is waiting. Fill out the form on a phone first.</p>'}</div>` : ''}
       <div id="camwrap" hidden><video class="cam" playsinline muted></video><canvas hidden></canvas></div>
       <p class="err" id="camerr" role="alert"></p>
       <div class="row">
         <button type="button" class="btn" id="camstart">Use the camera</button>
         <button type="button" class="btn ghost" id="camclose">Close</button>
       </div>`, stop);
    let stream = null, running = false;
    const video = d.querySelector('video'), canvas = d.querySelector('canvas');
    const err = d.querySelector('#camerr');

    function stop() {
      running = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    async function got(code) {
      const msg = await opts.onCode(code);
      if (msg) { err.textContent = msg; return false; }
      U.closeDialog();
      if (opts.after) opts.after();
      return true;
    }
    d.querySelector('#camclose').onclick = U.closeDialog;
    d.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => got(opts.list[Number(b.dataset.i)].code)));

    d.querySelector('#camstart').onclick = async () => {
      err.textContent = '';
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        err.textContent = 'This phone cannot open the camera here. Use the scanner box instead.';
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch (e) {
        err.textContent = 'The camera is blocked. Allow it, or use the scanner box instead.';
        return;
      }
      d.querySelector('#camwrap').hidden = false;
      video.srcObject = stream;
      await video.play();
      running = true;
      const detector = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code', 'code_128'] }) : null;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let busy = false;
      const tick = async () => {
        if (!running) return;
        if (!busy && video.readyState >= 2) {
          busy = true;
          let text = '';
          try {
            if (detector) {
              const r = await detector.detect(video);
              if (r.length) text = r[0].rawValue;
            } else {
              canvas.width = video.videoWidth; canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const r = jsQR(img.data, img.width, img.height);
              if (r) text = r.data;
            }
          } catch (e) { /* keep trying */ }
          if (text) {
            running = false;
            const ok = await got(text);
            if (!ok) { running = true; setTimeout(() => (busy = false), 1500); requestAnimationFrame(tick); return; }
            return;
          }
          busy = false;
        }
        requestAnimationFrame(tick);
      };
      tick();
    };
  };

  window.U = U;
})();
