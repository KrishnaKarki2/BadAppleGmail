(() => {
  const REC = false; // true = mp4 starts recording 
  const ROWS = 29; // row count; for best results, I recommend keeping this value 25 or above 
  const SHAPE = '4:3'; // export shape
  const SHAPES = { '4:3': [1080, 810], '3:4': [1080, 1440], '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080] }; // export presets 
  const QP = 20; // export quality, 0 to 51. lower = sharper and bigger file; same value for every frame 
  const FPS = 30; // frames per second 
  const BITRATE = 8e6; // only used if this browser can't do fixed quality (then constant bits/s)
  const PIXEL = .3; // pixel width as a fraction of an email row's height; smaller = sharper vertical edges.
  const MAX_EMAILS = 200; // how many emails to collect by scrolling
  const CLEAN = []; // regexes for text to strip from subjects and previews, e.g. [/Sponsored/gi, /Unsubscribe/gi]; empty = keep everything.

  // easter egg: this also works in Outlook 
  // Gmail: tr.zA. Outlook: [role="option"][data-convid]
  const ROW_SEL = document.querySelector('tr.zA') ? 'tr.zA' : '[role="option"][data-convid]';
  const scroller = el => { for (let p = el && el.parentElement; p; p = p.parentElement) if (/auto|scroll|overlay/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight + 20) return p; return document.scrollingElement; };

  const OUTLOOK = ROW_SEL != 'tr.zA';
  const NOISE = /^(Unread|Read|Flagged|Pinned|Today|Yesterday|Has attachments?|Mentioned|Draft)$/i;
  const WD = '(mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?', MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
  const TM = '\\d{1,2}:\\d{2}(\\s?[ap]m)?', ND = '\\d{1,4}[-/.]\\d{1,2}([-/.]\\d{1,4})?'; // 10:04, 2026-08-14, 09/24
  const DATE = new RegExp(`^(${TM}|${WD}(\\s+(${TM}|${ND}))?|${ND}|${MON}\\s+\\d{1,2}(,?\\s+\\d{4})?|\\d{1,2}\\s+${MON}|yesterday)$`, 'i');
  // strip unwanted text from subjects and previews with the CLEAN regexes at the top.
  const clean = t => CLEAN.reduce((x, re) => x.replace(re, ' '), t).replace(/\s+/g, ' ').trim();

  // format dates into "Oct 23", "Sep 30", etc. format
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatDate = t => {
    if (!t) return '';
    // skip formatting if it's already a time string
    if (/^\d{1,2}:\d{2}/.test(t)) return t;
    
    // check for numeric dates (e.g., 09/24, 2026-08-14, 10/23/2026)
    if (/^\d{1,4}[-/.]\d{1,2}([-/.]\d{1,4})?$/.test(t)) {
      let parts = t.split(/[-/.]/);
      let m, day;
      if (parts.length === 3) {
        if (parts[0].length === 4) { m = parseInt(parts[1], 10); day = parts[2]; }
        else { m = parseInt(parts[0], 10); day = parts[1]; }
      } else if (parts.length === 2) {
        m = parseInt(parts[0], 10); day = parts[1];
      }
      if (m >= 1 && m <= 12 && !isNaN(day)) {
        return `${MONTHS[m - 1]} ${parseInt(day, 10)}`;
      }
    }

    // try parsing standard date strings
    let d = new Date(t);
    if (!isNaN(d.getTime())) {
      return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    }
    return t;
  };

  const parse = r => {
    let l = r.innerText.split(/[\n\t]+/).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const id = r.dataset.convid || r.innerText.slice(0, 60);
    if (!OUTLOOK) { const date = l.length > 2 ? formatDate(l.pop()) : ''; return { from: l.shift() || '', what: clean(l.join(' ')), date, id }; }
    l = l.filter(t => !NOISE.test(t));
    if (l.length > 2 && /^[A-Z]{1,3}$/.test(l[0]) && l[1][0].toUpperCase() == l[0][0]) l.shift(); 
    const di = l.findLastIndex(t => DATE.test(t)), date = di > 0 ? formatDate(l.splice(di, 1)[0]) : '';
    const [from = '', subj = '', ...rest] = l, pv = clean(rest.join(' '));
    return { from, what: clean(subj) + (pv ? ' - ' + pv : ''), date, id };
  };

  const status = document.createElement('div');
  status.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;background:#1a73e8;color:#fff;font:14px Arial;padding:10px 16px;border-radius:8px';

  // small panel on the blue badge: rows, record or not, export shape or your own width x height
  const ask = () => new Promise(res => {
    const mk = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text) e.textContent = text; return e; };
    const line = (label, ...els) => { const d = mk('div', 'display:flex;justify-content:space-between;align-items:center;gap:14px;margin:7px 0'); const r = mk('span', 'display:flex;align-items:center;gap:6px'); r.append(...els); d.append(mk('span', '', label), r); return d; };
    const rows = mk('input', 'width:64px'), rec = mk('input'), shape = mk('select'), go = mk('button', 'width:100%;margin-top:8px;padding:7px;font:14px Arial;cursor:pointer', 'Start');
    const cw = mk('input', 'width:64px'), ch = mk('input', 'width:64px'), err = mk('div', 'display:none;margin-top:6px;font-size:12px;background:#fff;color:#b00020;padding:4px 6px;border-radius:4px');
    for (const el of [rows, cw, ch]) el.type = 'number';
    rows.min = 5; rows.max = 100; rows.value = ROWS;
    cw.min = ch.min = 240; cw.max = ch.max = 4096; [cw.value, ch.value] = SHAPES[SHAPE] || [1080, 810];
    rec.type = 'checkbox'; rec.checked = REC;
    for (const name in SHAPES) { const o = mk('option', '', `${name}  (${SHAPES[name].join('\u00d7')})`); o.value = name; shape.append(o); }
    const oc = mk('option', '', 'Custom\u2026'); oc.value = 'custom'; shape.append(oc);
    shape.value = SHAPE;
    const size = line('Width \u00d7 height', cw, mk('span', '', '\u00d7'), ch);
    const sync = () => { shape.disabled = !rec.checked; size.style.display = rec.checked && shape.value == 'custom' ? 'flex' : 'none'; };
    rec.onchange = shape.onchange = sync; sync();
    status.textContent = '';
    status.append(mk('b', '', 'Bad Apple'), line('Rows (emails tall in the picture)', rows), line('Record mp4', rec), line('Export shape', shape), size, err, go);
    go.onclick = () => {
      let sz = SHAPES[shape.value];
      if (rec.checked && shape.value == 'custom') {
        const even = x => Math.round(x / 2) * 2, W = even(+cw.value), H = even(+ch.value);
        const bad = !(W >= 240 && W <= 4096 && H >= 240 && H <= 4096) ? 'Width and height: 240 to 4096.' : W * H > 4096 * 2304 ? 'Too many pixels. Keep width \u00d7 height under 4096 \u00d7 2304.' : '';
        if (bad) { err.textContent = bad; err.style.display = 'block'; return; }
        sz = [W, H];
      }
      res({ rows: Math.min(100, Math.max(5, Math.round(+rows.value) || ROWS)), rec: rec.checked, size: sz || SHAPES[SHAPE] });
    };
  });

  const collect = () => new Promise(res => {
    const seen = new Map(), snap = () => document.querySelectorAll(ROW_SEL).forEach(r => { const m = parse(r); if (!seen.has(m.id)) seen.set(m.id, m); });
    snap();
    const box = scroller(document.querySelector(ROW_SEL)), top0 = box.scrollTop;
    const done = () => { box.scrollTop = top0; res([...seen.values()]); };
    let last = -1, idles = 0;
    const tick = () => {
      snap();
      status.textContent = `Bad Apple: collecting emails\u2026 ${seen.size}`;
      if (seen.size >= MAX_EMAILS) return done();
      if (seen.size === last) { if (++idles >= 8) return done(); } // 8 quiet rounds = end of list
      else { idles = 0; last = seen.size; }
      box.scrollTop += box.clientHeight * .8; // overlap so no row is skipped
      setTimeout(tick, 400);
    };
    tick();
  });

  const f = document.createElement('input');
  f.type = 'file'; f.accept = 'video/*';
  f.onchange = async () => {
    document.body.append(status);
    const mails = await collect();
    if (!mails.length) { status.textContent = 'No emails found. Open the inbox first.'; return; }
    const opt = await ask(); // { rows, rec, size }
    status.textContent = 'Bad Apple: loading video\u2026';
    const v = document.createElement('video');
    v.src = URL.createObjectURL(f.files[0]);
    v.onerror = () => alert('video blocked or unreadable');
    await new Promise(r => v.onloadedmetadata = r);
    const [W, H] = opt.rec ? opt.size : [innerWidth, innerHeight], k = opt.rec ? 1 : devicePixelRatio, w = Math.round(W * k) & ~1, h = Math.round(H * k) & ~1;
    const ph = Math.min(h, w * v.videoHeight / v.videoWidth), pw = ph * v.videoWidth / v.videoHeight; // picture size in px, kept in shape
    const rowPx = ph / opt.rows, rows = Math.round(h / rowPx), R = Math.round(rowPx), Dw = Math.round(4.8 * R); // rows = whole canvas height, R = email text scale
    const cols = Math.round(w / (PIXEL * rowPx)), cw = w / cols;
    const xs = Array.from({ length: cols + 1 }, (_, c) => Math.round(c * w / cols)); // pixel column edges
    const ys = Array.from({ length: rows + 1 }, (_, r) => Math.round(r * h / rows)); // email row edges: copied 1:1, never scaled
    const Rd = Math.ceil(h / rows); // strip height, enough for the tallest row
    let on = true;

    let ex = null;
    if (opt.rec) try {
      if (!window.VideoEncoder) throw 'this browser has no WebCodecs';
      status.textContent = 'Bad Apple: preparing export\u2026';
      let vcfg;
      pick: for (const codec of ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42001f', 'vp09.00.51.08'])
        for (const bitrateMode of ['quantizer', 'constant']) { // fixed quality first, constant bitrate if not supported
          const c0 = { codec, width: w, height: h, bitrate: BITRATE, bitrateMode, latencyMode: 'quality', framerate: FPS, ...(codec[0] == 'a' && { avc: { format: 'avc' } }) };
          if ((await VideoEncoder.isConfigSupported(c0)).supported) { vcfg = c0; break pick; }
        }
      if (!vcfg) throw 'no video codec';
      let buf; // audio of the file, decoded once, encoded after playback
      try { const ac = new AudioContext(); buf = await ac.decodeAudioData(await f.files[0].arrayBuffer()); ac.close(); } catch (e) { console.warn('export will have no sound:', e); }
      const nc = buf ? Math.min(2, buf.numberOfChannels) : 0;
      let acfg;
      if (buf) for (const codec of ['mp4a.40.2', 'opus']) {
        const c0 = { codec, sampleRate: buf.sampleRate, numberOfChannels: nc, bitrate: 160000 };
        if ((await AudioEncoder.isConfigSupported(c0)).supported) { acfg = c0; break; }
      }
      const M = lib(), mux = new M.Muxer({
        target: new M.ArrayBufferTarget(),
        video: { codec: vcfg.codec[0] == 'a' ? 'avc' : 'vp9', width: w, height: h, frameRate: FPS },
        ...(acfg && { audio: { codec: acfg.codec == 'opus' ? 'opus' : 'aac', numberOfChannels: nc, sampleRate: buf.sampleRate } }),
        fastStart: 'in-memory', firstTimestampBehavior: 'cross-track-offset',
      });
      const ve = new VideoEncoder({ output: (c, m) => mux.addVideoChunk(c, m), error: e => console.warn('video encoder:', e) });
      ve.configure(vcfg);
      let ae;
      if (acfg) { ae = new AudioEncoder({ output: (c, m) => mux.addAudioChunk(c, m), error: e => console.warn('audio encoder:', e) }); ae.configure(acfg); }
      ex = { ve, ae, buf, nc, mux, q: vcfg.bitrateMode == 'quantizer' ? (vcfg.codec[0] == 'a' ? 'avc' : 'vp9') : '' };
      console.log('export:', vcfg.codec, vcfg.bitrateMode, acfg ? acfg.codec : 'no sound');
    } catch (e) { console.warn('no export:', e); }

    // one email as a full-width strip, light or dark 
    const cache = {};
    const strip = (e, dark) => cache[e + (dark ? 'd' : 'l')] ??= (() => {
      const m = mails[e], c = document.createElement('canvas'), g = c.getContext('2d');
      c.width = w; c.height = Rd;
      const bg = dark ? '#000' : '#fff', fg = dark ? '#e8eaed' : '#202124', dim = dark ? '#9aa0a6' : '#5f6368', ln = dark ? '#2a2a2a' : '#e8e8e8';
      const B = `bold ${R * .6}px Roboto,Arial,sans-serif`, N = `${R * .6}px Roboto,Arial,sans-serif`, my = R / 2, xj = R * 13.5, dw = R * 4.8;
      g.fillStyle = bg; g.fillRect(0, 0, w, Rd);
      g.fillStyle = ln; g.fillRect(0, R - 1, w, 1);
      g.textBaseline = 'middle';
      const put = (t, x, wd, font, color) => { g.save(); g.beginPath(); g.rect(x, 0, wd, R); g.clip(); g.font = font; g.fillStyle = color; g.fillText(t, x, my); g.restore(); };
      g.strokeStyle = dim; g.strokeRect(R * .4 + .5, my - R * .22, R * .45, R * .45); // checkbox
      put('\u2606', R * 1.2, R, `${R * .8}px Arial`, dim); // star
      put(m.from, R * 3.2, R * 10, B, fg);
      const j = m.what.indexOf(' - '), s = j < 0 ? m.what : m.what.slice(0, j);
      put(s, xj, w - dw - xj, B, fg);
      g.font = B; const sw = g.measureText(s).width;
      if (j >= 0) put(' - ' + m.what.slice(j + 3), xj + sw, w - dw - xj - sw, N, dim);
      g.font = B; let dt = m.date;
      while (dt.length > 1 && g.measureText(dt).width > dw - R * .6) dt = dt.slice(0, -1); // date can never spill into the subject
      put(dt, w - R * .5 - g.measureText(dt).width, dw, B, fg);
      return c;
    })();

    // mask: one cell per pixel (cw wide, one email row tall
    const mc = document.createElement('canvas'), mg = mc.getContext('2d', { willReadFrequently: true });
    mc.width = cols; mc.height = rows; mg.imageSmoothingQuality = 'high';
    mg.fillStyle = '#000'; mg.fillRect(0, 0, cols, rows);
    const rh = h / rows;
    const vc = pw / cw, vr = ph / rh, vx = (cols - vc) / 2, vy = (rows - vr) / 2; // in mask cells, centered
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.style.cssText = opt.rec
      ? `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(100vw,calc(100vh*${W}/${H}));aspect-ratio:${W}/${H};box-shadow:0 0 0 200vmax #000;z-index:2147483647` // export shape, scaled to fit the window
      : 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483647'; // fullscreen
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const prev = Array.from({ length: rows }, () => []);
    const gid = (() => { const m = new Map(); return mails.map(x => { const k = [x.from, x.what, x.date].join('\u0001'); if (!m.has(k)) m.set(k, m.size); return m.get(k); }); })(); // same text = same email
    const pick = bad => { let e, t = 0; do e = Math.random() * mails.length | 0; while (bad.has(gid[e]) && ++t < 40); return e; }; // random email that none of its neighbors show

    const finish = async save => {
      if (!on) return; on = false; c.remove(); removeEventListener('keydown', key, true);
      if (!ex) return;
      if (!save) { try { ex.ve.close(); ex.ae && ex.ae.close(); } catch (e) { } return; }
      document.body.append(status); status.textContent = 'Bad Apple: saving mp4\u2026';
      await ex.ve.flush();
      if (ex.ae) { // sound: encoded from the file itself, so it is exact whatever the screen did
        const { buf, nc, ae } = ex, sr = buf.sampleRate, ch = Array.from({ length: nc }, (_, i) => buf.getChannelData(i));
        for (let s = 0; s < buf.length; s += sr) {
          const n = Math.min(sr, buf.length - s), d = new Float32Array(n * nc);
          ch.forEach((x, i) => d.set(x.subarray(s, s + n), i * n));
          ae.encode(new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: nc, timestamp: Math.round(s / sr * 1e6), data: d }));
          while (ae.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 10));
        }
        await ae.flush();
      }
      ex.mux.finalize();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ex.mux.target.buffer], { type: 'video/mp4' })); a.download = 'bad-apple-mail.mp4'; a.click();
      status.textContent = 'Bad Apple: saved bad-apple-mail.mp4'; setTimeout(() => status.remove(), 5000);
    };
    const key = e => { e.stopImmediatePropagation(); if (e.key == 'Escape') { v.pause(); finish(false); } }; // also blocks Gmail shortcuts while open
    v.onended = () => finish(true);
    addEventListener('keydown', key, true);
    status.remove();
    document.body.append(c);

    let lastN = -1, lastP = 0;
    const pc = document.createElement('canvas'); pc.width = w; pc.height = h; 
    const pg = pc.getContext('2d');
    const put = (src, n) => { // frame n goes at exactly n/FPS
      const fr = new VideoFrame(src, { timestamp: Math.round(n * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      const o = { keyFrame: n % (2 * FPS) == 0 };
      if (ex.q) o[ex.q] = { quantizer: ex.q == 'vp9' ? Math.round(QP * 63 / 51) : QP };
      ex.ve.encode(fr, o);
      fr.close();
    };
    const frame = meta => {
      mg.drawImage(v, vx, vy, vc, vr);
      const d = mg.getImageData(0, 0, cols, rows).data;
      for (let r = 0; r < rows; r++) {
        const runs = [], used = new Set(), y = ys[r], hs = ys[r + 1] - y, px = i => d[(r * cols + i) * 4] > 127;
        for (let a = 0, i = 1; i <= cols; i++)
          if (i == cols || px(i) != px(a)) { runs.push({ a, b: i, c: px(a) }); a = i; }
        const above = r ? prev[r - 1] : []; 
        let left;
        for (const u of runs) {
          let best, ov = 0; 
          for (const p of prev[r]) { const o = Math.min(u.b, p.b) - Math.max(u.a, p.a); if (p.c == u.c && !used.has(p) && o > ov) { best = p; ov = o; } }
          if (best) used.add(best);
          const bad = new Set(above.filter(p => Math.min(u.b, p.b) > Math.max(u.a, p.a)).map(p => gid[p.e])); // emails touching above
          if (left) bad.add(gid[left.e]); // and to the left
          u.e = best && !bad.has(gid[best.e]) ? best.e : pick(bad); // keeps its email unless a neighbor now shows the same one
          left = u;
          const x0 = xs[u.a], x1 = xs[u.b], wd = x1 - x0, s = strip(u.e, !u.c), lw = wd > 5 * Dw ? wd - Dw : wd;
          g.drawImage(s, 0, 0, lw, hs, x0, y, lw, hs); // white run = light email, black run = dark email
          if (lw < wd) g.drawImage(s, w - Dw, 0, Dw, hs, x1 - Dw, y, Dw, hs);
        }
        prev[r] = runs;
      }
      if (ex) {
        const n = Math.round(meta.mediaTime * FPS); 
        if (n > lastN) { 
          for (let m = lastN + 1; m < n; m++) put(pc, m);
          put(c, n); lastN = n; pg.drawImage(c, 0, 0);
          if (ex.ve.encodeQueueSize > 6) { 
            v.pause();
            ex.ve.ondequeue = () => { if (ex.ve.encodeQueueSize < 2) { ex.ve.ondequeue = null; on && v.play(); } };
          }
        }
      }
      if (ex && meta.presentedFrames - lastP > 1) v.playbackRate = Math.max(.25, v.playbackRate * .9); // page too slow: slow down, never skip a frame
      lastP = meta.presentedFrames;
    };
    const loop = (_, meta) => { if (!on) return; frame(meta); v.requestVideoFrameCallback(loop); };
    if (v.readyState < 2) await new Promise(r => v.onloadeddata = r);
    frame({ mediaTime: 0, presentedFrames: 0 }); // first frame stamped exactly 0, so picture and sound start together
    v.play().catch(() => (v.muted = true, v.play())).then(() => v.requestVideoFrameCallback(loop));
  };
  f.click();

"use strict";var Mp4Muxer=(()=>{var we=Object.defineProperty,at=Object.getOwnPropertyDescriptor,nt=Object.getOwnPropertyNames,ot=Object.prototype.hasOwnProperty,ht=(e,t)=>{for(var s in t)we(e,s,{get:t[s],enumerable:!0})},lt=(e,t,s,r)=>{if(t&&typeof t=="object"||typeof t=="function")for(let a of nt(t))!ot.call(e,a)&&a!==s&&we(e,a,{get:()=>t[a],enumerable:!(r=at(t,a))||r.enumerable});return e},ft=e=>lt(we({},"__esModule",{value:!0}),e),ve=(e,t,s)=>{if(!t.has(e))throw TypeError("Cannot "+s)},i=(e,t,s)=>(ve(e,t,"read from private field"),s?s.call(e):t.get(e)),d=(e,t,s)=>{if(t.has(e))throw TypeError("Cannot add the same private member more than once");t instanceof WeakSet?t.add(e):t.set(e,s)},C=(e,t,s,r)=>(ve(e,t,"write to private field"),r?r.call(e,s):t.set(e,s),s),ut=(e,t,s,r)=>({set _(a){C(e,t,a,s)},get _(){return i(e,t,r)}}),m=(e,t,s)=>(ve(e,t,"access private method"),s),Re={};ht(Re,{ArrayBufferTarget:()=>qe,FileSystemWritableFileStreamTarget:()=>Xe,Muxer:()=>vi,StreamTarget:()=>Te});var p=new Uint8Array(8),z=new DataView(p.buffer),y=e=>[(e%256+256)%256],c=e=>(z.setUint16(0,e,!1),[p[0],p[1]]),dt=e=>(z.setInt16(0,e,!1),[p[0],p[1]]),Pe=e=>(z.setUint32(0,e,!1),[p[1],p[2],p[3]]),n=e=>(z.setUint32(0,e,!1),[p[0],p[1],p[2],p[3]]),mt=e=>(z.setInt32(0,e,!1),[p[0],p[1],p[2],p[3]]),x=e=>(z.setUint32(0,Math.floor(e/2**32),!1),z.setUint32(4,e,!1),[p[0],p[1],p[2],p[3],p[4],p[5],p[6],p[7]]),ge=e=>(z.setInt16(0,2**8*e,!1),[p[0],p[1]]),A=e=>(z.setInt32(0,2**16*e,!1),[p[0],p[1],p[2],p[3]]),ye=e=>(z.setInt32(0,2**30*e,!1),[p[0],p[1],p[2],p[3]]),E=(e,t=!1)=>{let s=Array(e.length).fill(null).map((r,a)=>e.charCodeAt(a));return t&&s.push(0),s},se=e=>e&&e[e.length-1],Ce=e=>{let t;for(let s of e)(!t||s.presentationTimestamp>t.presentationTimestamp)&&(t=s);return t},O=(e,t,s=!0)=>{let r=e*t;return s?Math.round(r):r},Le=e=>{let t=e*(Math.PI/180),s=Math.cos(t),r=Math.sin(t);return[s,r,0,-r,s,0,0,0,1]},Ve=Le(0),je=e=>[A(e[0]),A(e[1]),ye(e[2]),A(e[3]),A(e[4]),ye(e[5]),A(e[6]),A(e[7]),ye(e[8])],X=e=>!e||typeof e!="object"?e:Array.isArray(e)?e.map(X):Object.fromEntries(Object.entries(e).map(([t,s])=>[t,X(s)])),V=e=>e>=0&&e<2**32,v=(e,t,s)=>({type:e,contents:t&&new Uint8Array(t.flat(10)),children:s}),w=(e,t,s,r,a)=>v(e,[y(t),Pe(s),r??[]],a),pt=e=>{let t=512;return e.fragmented?v("ftyp",[E("iso5"),n(t),E("iso5"),E("iso6"),E("mp41")]):v("ftyp",[E("isom"),n(t),E("isom"),e.holdsAvc?E("avc1"):[],E("mp41")])},Se=e=>({type:"mdat",largeSize:e}),ct=e=>({type:"free",size:e}),re=(e,t,s=!1)=>v("moov",null,[wt(t,e),...e.map(r=>vt(r,t)),s?Gt(e):null]),wt=(e,t)=>{let s=O(Math.max(0,...t.filter(l=>l.samples.length>0).map(l=>{const u=Ce(l.samples);return u.presentationTimestamp+u.duration})),Ae),r=Math.max(...t.map(l=>l.id))+1,a=!V(e)||!V(s),o=a?x:n;return w("mvhd",+a,0,[o(e),o(e),n(Ae),o(s),A(1),ge(1),Array(10).fill(0),je(Ve),Array(24).fill(0),n(r)])},vt=(e,t)=>v("trak",null,[gt(e,t),yt(e,t)]),gt=(e,t)=>{let s=Ce(e.samples),r=O(s?s.presentationTimestamp+s.duration:0,Ae),a=!V(t)||!V(r),o=a?x:n,l;return e.info.type==="video"?l=typeof e.info.rotation=="number"?Le(e.info.rotation):e.info.rotation:l=Ve,w("tkhd",+a,3,[o(t),o(t),n(e.id),n(0),o(r),Array(8).fill(0),c(0),c(0),ge(e.info.type==="audio"?1:0),c(0),je(l),A(e.info.type==="video"?e.info.width:0),A(e.info.type==="video"?e.info.height:0)])},yt=(e,t)=>v("mdia",null,[Ct(e,t),St(e.info.type==="video"?"vide":"soun"),Tt(e)]),Ct=(e,t)=>{let s=Ce(e.samples),r=O(s?s.presentationTimestamp+s.duration:0,e.timescale),a=!V(t)||!V(r),o=a?x:n;return w("mdhd",+a,0,[o(t),o(t),n(e.timescale),o(r),c(21956),c(0)])},St=e=>w("hdlr",0,0,[E("mhlr"),E(e),n(0),n(0),n(0),E("mp4-muxer-hdlr",!0)]),Tt=e=>v("minf",null,[e.info.type==="video"?bt():_t(),kt(),At(e)]),bt=()=>w("vmhd",0,1,[c(0),c(0),c(0),c(0)]),_t=()=>w("smhd",0,0,[c(0),c(0)]),kt=()=>v("dinf",null,[Et()]),Et=()=>w("dref",0,0,[n(1)],[zt()]),zt=()=>w("url ",0,1),At=e=>{const t=e.compositionTimeOffsetTable.length>1||e.compositionTimeOffsetTable.some(s=>s.sampleCompositionTimeOffset!==0);return v("stbl",null,[Ot(e),Vt(e),jt(e),$t(e),Ht(e),qt(e),t?Xt(e):null])},Ot=e=>w("stsd",0,0,[n(1)],[e.info.type==="video"?Mt(ri[e.info.codec],e):Rt(ni[e.info.codec],e)]),Mt=(e,t)=>v(e,[Array(6).fill(0),c(1),c(0),c(0),Array(12).fill(0),c(t.info.width),c(t.info.height),n(4718592),n(4718592),n(0),c(1),Array(32).fill(0),c(24),dt(65535)],[ai[t.info.codec](t),t.info.decoderConfig.colorSpace?Ut(t):null]),Bt={bt709:1,bt470bg:5,smpte170m:6},It={bt709:1,smpte170m:6,"iec61966-2-1":13},Dt={rgb:0,bt709:1,bt470bg:5,smpte170m:6},Ut=e=>v("colr",[E("nclx"),c(Bt[e.info.decoderConfig.colorSpace.primaries]),c(It[e.info.decoderConfig.colorSpace.transfer]),c(Dt[e.info.decoderConfig.colorSpace.matrix]),y((e.info.decoderConfig.colorSpace.fullRange?1:0)<<7)]),xt=e=>e.info.decoderConfig&&v("avcC",[...new Uint8Array(e.info.decoderConfig.description)]),Wt=e=>e.info.decoderConfig&&v("hvcC",[...new Uint8Array(e.info.decoderConfig.description)]),Ft=e=>{if(!e.info.decoderConfig)return null;let t=e.info.decoderConfig;if(!t.colorSpace)throw new Error("'colorSpace' is required in the decoder config for VP9.");let s=t.codec.split("."),r=Number(s[1]),a=Number(s[2]),u=(Number(s[3])<<4)+(0<<1)+Number(t.colorSpace.fullRange);return w("vpcC",1,0,[y(r),y(a),y(u),y(2),y(2),y(2),c(0)])},Nt=()=>{let s=(1<<7)+1;return v("av1C",[s,0,0,0])},Rt=(e,t)=>v(e,[Array(6).fill(0),c(1),c(0),c(0),n(0),c(t.info.numberOfChannels),c(16),c(0),c(0),A(t.info.sampleRate)],[oi[t.info.codec](t)]),Pt=e=>{let t=new Uint8Array(e.info.decoderConfig.description);return w("esds",0,0,[n(58753152),y(32+t.byteLength),c(1),y(0),n(75530368),y(18+t.byteLength),y(64),y(21),Pe(0),n(130071),n(130071),n(92307584),y(t.byteLength),...t,n(109084800),y(1),y(2)])},Lt=e=>{let t=3840,s=0;const r=e.info.decoderConfig?.description;if(r){if(r.byteLength<18)throw new TypeError("Invalid decoder description provided for Opus; must be at least 18 bytes long.");const a=ArrayBuffer.isView(r)?new DataView(r.buffer,r.byteOffset,r.byteLength):new DataView(r);t=a.getUint16(10,!0),s=a.getInt16(14,!0)}return v("dOps",[y(0),y(e.info.numberOfChannels),c(t),n(e.info.sampleRate),ge(s),y(0)])},Vt=e=>w("stts",0,0,[n(e.timeToSampleTable.length),e.timeToSampleTable.map(t=>[n(t.sampleCount),n(t.sampleDelta)])]),jt=e=>{if(e.samples.every(s=>s.type==="key"))return null;let t=[...e.samples.entries()].filter(([,s])=>s.type==="key");return w("stss",0,0,[n(t.length),t.map(([s])=>n(s+1))])},$t=e=>w("stsc",0,0,[n(e.compactlyCodedChunkTable.length),e.compactlyCodedChunkTable.map(t=>[n(t.firstChunk),n(t.samplesPerChunk),n(1)])]),Ht=e=>w("stsz",0,0,[n(0),n(e.samples.length),e.samples.map(t=>n(t.size))]),qt=e=>e.finalizedChunks.length>0&&se(e.finalizedChunks).offset>=2**32?w("co64",0,0,[n(e.finalizedChunks.length),e.finalizedChunks.map(t=>x(t.offset))]):w("stco",0,0,[n(e.finalizedChunks.length),e.finalizedChunks.map(t=>n(t.offset))]),Xt=e=>w("ctts",0,0,[n(e.compositionTimeOffsetTable.length),e.compositionTimeOffsetTable.map(t=>[n(t.sampleCount),n(t.sampleCompositionTimeOffset)])]),Gt=e=>v("mvex",null,e.map(Zt)),Zt=e=>w("trex",0,0,[n(e.id),n(1),n(0),n(0),n(0)]),$e=(e,t)=>v("moof",null,[Kt(e),...t.map(Qt)]),Kt=e=>w("mfhd",0,0,[n(e)]),He=e=>{let t=0,s=0,r=0,a=0,o=e.type==="delta";return s|=+o,o?t|=1:t|=2,t<<24|s<<16|r<<8|a},Qt=e=>v("traf",null,[Jt(e),Yt(e),ei(e)]),Jt=e=>{let t=0;t|=8,t|=16,t|=32,t|=131072;let s=e.currentChunk.samples[1]??e.currentChunk.samples[0],r={duration:s.timescaleUnitsToNextSample,size:s.size,flags:He(s)};return w("tfhd",0,t,[n(e.id),n(r.duration),n(r.size),n(r.flags)])},Yt=e=>w("tfdt",1,0,[x(O(e.currentChunk.startTimestamp,e.timescale))]),ei=e=>{let t=e.currentChunk.samples.map(D=>D.timescaleUnitsToNextSample),s=e.currentChunk.samples.map(D=>D.size),r=e.currentChunk.samples.map(He),a=e.currentChunk.samples.map(D=>O(D.presentationTimestamp-D.decodeTimestamp,e.timescale)),o=new Set(t),l=new Set(s),u=new Set(r),g=new Set(a),b=u.size===2&&r[0]!==r[1],U=o.size>1,ie=l.size>1,st=!b&&u.size>1,rt=g.size>1||[...g].some(D=>D!==0),L=0;return L|=1,L|=4*+b,L|=256*+U,L|=512*+ie,L|=1024*+st,L|=2048*+rt,w("trun",1,L,[n(e.currentChunk.samples.length),n(e.currentChunk.offset-e.currentChunk.moofOffset||0),b?n(r[0]):[],e.currentChunk.samples.map((D,ce)=>[U?n(t[ce]):[],ie?n(s[ce]):[],st?n(r[ce]):[],rt?mt(a[ce]):[]])])},ti=e=>v("mfra",null,[...e.map(ii),si()]),ii=(e,t)=>w("tfra",1,0,[n(e.id),n(63),n(e.finalizedChunks.length),e.finalizedChunks.map(r=>[x(O(r.startTimestamp,e.timescale)),x(r.moofOffset),n(t+1),n(1),n(1)])]),si=()=>w("mfro",0,0,[n(0)]),ri={avc:"avc1",hevc:"hvc1",vp9:"vp09",av1:"av01"},ai={avc:xt,hevc:Wt,vp9:Ft,av1:Nt},ni={aac:"mp4a",opus:"Opus"},oi={aac:Pt,opus:Lt},hi=Symbol("isTarget"),ae=class{},qe=class extends ae{constructor(){super(...arguments),this.buffer=null}},Te=class extends ae{constructor(e){if(super(),this.options=e,typeof e!="object")throw new TypeError("StreamTarget requires an options object to be passed to its constructor.");if(e.onData){if(typeof e.onData!="function")throw new TypeError("options.onData, when provided, must be a function.");if(e.onData.length<2)throw new TypeError("options.onData, when provided, must be a function that takes in at least two arguments (data and position). Ignoring the position argument, which specifies the byte offset at which the data is to be written, can lead to broken outputs.")}if(e.chunked!==void 0&&typeof e.chunked!="boolean")throw new TypeError("options.chunked, when provided, must be a boolean.");if(e.chunkSize!==void 0&&(!Number.isInteger(e.chunkSize)||e.chunkSize<1024))throw new TypeError("options.chunkSize, when provided, must be an integer and not smaller than 1024.")}},Xe=class extends ae{constructor(e,t){if(super(),this.stream=e,this.options=t,!(e instanceof FileSystemWritableFileStream))throw new TypeError("FileSystemWritableFileStreamTarget requires a FileSystemWritableFileStream instance.");if(t!==void 0&&typeof t!="object")throw new TypeError("FileSystemWritableFileStreamTarget's options, when provided, must be an object.");if(t&&t.chunkSize!==void 0&&(!Number.isInteger(t.chunkSize)||t.chunkSize<=0))throw new TypeError("options.chunkSize, when provided, must be a positive integer")}},W,j,Ge=class{constructor(){this.pos=0,d(this,W,new Uint8Array(8)),d(this,j,new DataView(i(this,W).buffer)),this.offsets=new WeakMap}seek(e){this.pos=e}writeU32(e){i(this,j).setUint32(0,e,!1),this.write(i(this,W).subarray(0,4))}writeU64(e){i(this,j).setUint32(0,Math.floor(e/2**32),!1),i(this,j).setUint32(4,e,!1),this.write(i(this,W).subarray(0,8))}writeAscii(e){for(let t=0;t<e.length;t++)i(this,j).setUint8(t%8,e.charCodeAt(t)),t%8===7&&this.write(i(this,W));e.length%8!==0&&this.write(i(this,W).subarray(0,e.length%8))}writeBox(e){if(this.offsets.set(e,this.pos),e.contents&&!e.children)this.writeBoxHeader(e,e.size??e.contents.byteLength+8),this.write(e.contents);else{let t=this.pos;if(this.writeBoxHeader(e,0),e.contents&&this.write(e.contents),e.children)for(let a of e.children)a&&this.writeBox(a);let s=this.pos,r=e.size??s-t;this.seek(t),this.writeBoxHeader(e,r),this.seek(s)}}writeBoxHeader(e,t){this.writeU32(e.largeSize?1:t),this.writeAscii(e.type),e.largeSize&&this.writeU64(t)}measureBoxHeader(e){return 8+(e.largeSize?8:0)}patchBox(e){let t=this.pos;this.seek(this.offsets.get(e)),this.writeBox(e),this.seek(t)}measureBox(e){if(e.contents&&!e.children)return this.measureBoxHeader(e)+e.contents.byteLength;{let t=this.measureBoxHeader(e);if(e.contents&&(t+=e.contents.byteLength),e.children)for(let s of e.children)s&&(t+=this.measureBox(s));return t}}};W=new WeakMap,j=new WeakMap;var ne,F,G,Z,oe,be,li=class extends Ge{constructor(e){super(),d(this,oe),d(this,ne,void 0),d(this,F,new ArrayBuffer(2**16)),d(this,G,new Uint8Array(i(this,F))),d(this,Z,0),C(this,ne,e)}write(e){m(this,oe,be).call(this,this.pos+e.byteLength),i(this,G).set(e,this.pos),this.pos+=e.byteLength,C(this,Z,Math.max(i(this,Z),this.pos))}finalize(){m(this,oe,be).call(this,this.pos),i(this,ne).buffer=i(this,F).slice(0,Math.max(i(this,Z),this.pos))}};ne=new WeakMap,F=new WeakMap,G=new WeakMap,Z=new WeakMap,oe=new WeakSet,be=function(e){let t=i(this,F).byteLength;for(;t<e;)t*=2;if(t===i(this,F).byteLength)return;let s=new ArrayBuffer(t),r=new Uint8Array(s);r.set(i(this,G),0),C(this,F,s),C(this,G,r)};var fi=2**24,ui=2,K,N,Q,B,_,he,_e,ke,Ze,Ee,Ke,J,le,ze=class extends Ge{constructor(e){super(),d(this,he),d(this,ke),d(this,Ee),d(this,J),d(this,K,void 0),d(this,N,[]),d(this,Q,void 0),d(this,B,void 0),d(this,_,[]),C(this,K,e),C(this,Q,e.options?.chunked??!1),C(this,B,e.options?.chunkSize??fi)}write(e){i(this,N).push({data:e.slice(),start:this.pos}),this.pos+=e.byteLength}flush(){if(i(this,N).length===0)return;let e=[],t=[...i(this,N)].sort((s,r)=>s.start-r.start);e.push({start:t[0].start,size:t[0].data.byteLength});for(let s=1;s<t.length;s++){let r=e[e.length-1],a=t[s];a.start<=r.start+r.size?r.size=Math.max(r.size,a.start+a.data.byteLength-r.start):e.push({start:a.start,size:a.data.byteLength})}for(let s of e){s.data=new Uint8Array(s.size);for(let r of i(this,N))s.start<=r.start&&r.start<s.start+s.size&&s.data.set(r.data,r.start-s.start);i(this,Q)?(m(this,he,_e).call(this,s.data,s.start),m(this,J,le).call(this)):i(this,K).options.onData?.(s.data,s.start)}i(this,N).length=0}finalize(){i(this,Q)&&m(this,J,le).call(this,!0)}};K=new WeakMap,N=new WeakMap,Q=new WeakMap,B=new WeakMap,_=new WeakMap,he=new WeakSet,_e=function(e,t){let s=i(this,_).findIndex(u=>u.start<=t&&t<u.start+i(this,B));s===-1&&(s=m(this,Ee,Ke).call(this,t));let r=i(this,_)[s],a=t-r.start,o=e.subarray(0,Math.min(i(this,B)-a,e.byteLength));r.data.set(o,a);let l={start:a,end:a+o.byteLength};if(m(this,ke,Ze).call(this,r,l),r.written[0].start===0&&r.written[0].end===i(this,B)&&(r.shouldFlush=!0),i(this,_).length>ui){for(let u=0;u<i(this,_).length-1;u++)i(this,_)[u].shouldFlush=!0;m(this,J,le).call(this)}o.byteLength<e.byteLength&&m(this,he,_e).call(this,e.subarray(o.byteLength),t+o.byteLength)},ke=new WeakSet,Ze=function(e,t){let s=0,r=e.written.length-1,a=-1;for(;s<=r;){let o=Math.floor(s+(r-s+1)/2);e.written[o].start<=t.start?(s=o+1,a=o):r=o-1}for(e.written.splice(a+1,0,t),(a===-1||e.written[a].end<t.start)&&a++;a<e.written.length-1&&e.written[a].end>=e.written[a+1].start;)e.written[a].end=Math.max(e.written[a].end,e.written[a+1].end),e.written.splice(a+1,1)},Ee=new WeakSet,Ke=function(e){let s={start:Math.floor(e/i(this,B))*i(this,B),data:new Uint8Array(i(this,B)),written:[],shouldFlush:!1};return i(this,_).push(s),i(this,_).sort((r,a)=>r.start-a.start),i(this,_).indexOf(s)},J=new WeakSet,le=function(e=!1){for(let t=0;t<i(this,_).length;t++){let s=i(this,_)[t];if(!(!s.shouldFlush&&!e)){for(let r of s.written)i(this,K).options.onData?.(s.data.subarray(r.start,r.end),s.start+r.start);i(this,_).splice(t--,1)}}};var di=class extends ze{constructor(e){super(new Te({onData:(t,s)=>e.stream.write({type:"write",data:t,position:s}),chunked:!0,chunkSize:e.options?.chunkSize}))}},Ae=1e3,mi=["avc","hevc","vp9","av1"],pi=["aac","opus"],ci=2082844800,wi=["strict","offset","cross-track-offset"],h,f,fe,k,T,S,$,H,Oe,R,P,Y,Me,Qe,Be,Je,Ie,Ye,De,et,Ue,tt,ue,xe,M,I,We,it,ee,de,me,Fe,q,te,pe,Ne,vi=class{constructor(e){if(d(this,Me),d(this,Be),d(this,Ie),d(this,De),d(this,Ue),d(this,ue),d(this,M),d(this,We),d(this,ee),d(this,me),d(this,q),d(this,pe),d(this,h,void 0),d(this,f,void 0),d(this,fe,void 0),d(this,k,void 0),d(this,T,null),d(this,S,null),d(this,$,Math.floor(Date.now()/1e3)+ci),d(this,H,[]),d(this,Oe,1),d(this,R,[]),d(this,P,[]),d(this,Y,!1),m(this,Me,Qe).call(this,e),e.video=X(e.video),e.audio=X(e.audio),e.fastStart=X(e.fastStart),this.target=e.target,C(this,h,{firstTimestampBehavior:"strict",...e}),e.target instanceof qe)C(this,f,new li(e.target));else if(e.target instanceof Te)C(this,f,new ze(e.target));else if(e.target instanceof Xe)C(this,f,new di(e.target));else throw new Error(`Invalid target: ${e.target}`);m(this,De,et).call(this),m(this,Be,Je).call(this)}addVideoChunk(e,t,s,r){if(!(e instanceof EncodedVideoChunk))throw new TypeError("addVideoChunk's first argument (sample) must be of type EncodedVideoChunk.");if(t&&typeof t!="object")throw new TypeError("addVideoChunk's second argument (meta), when provided, must be an object.");if(s!==void 0&&(!Number.isFinite(s)||s<0))throw new TypeError("addVideoChunk's third argument (timestamp), when provided, must be a non-negative real number.");if(r!==void 0&&!Number.isFinite(r))throw new TypeError("addVideoChunk's fourth argument (compositionTimeOffset), when provided, must be a real number.");let a=new Uint8Array(e.byteLength);e.copyTo(a),this.addVideoChunkRaw(a,e.type,s??e.timestamp,e.duration,t,r)}addVideoChunkRaw(e,t,s,r,a,o){if(!(e instanceof Uint8Array))throw new TypeError("addVideoChunkRaw's first argument (data) must be an instance of Uint8Array.");if(t!=="key"&&t!=="delta")throw new TypeError("addVideoChunkRaw's second argument (type) must be either 'key' or 'delta'.");if(!Number.isFinite(s)||s<0)throw new TypeError("addVideoChunkRaw's third argument (timestamp) must be a non-negative real number.");if(!Number.isFinite(r)||r<0)throw new TypeError("addVideoChunkRaw's fourth argument (duration) must be a non-negative real number.");if(a&&typeof a!="object")throw new TypeError("addVideoChunkRaw's fifth argument (meta), when provided, must be an object.");if(o!==void 0&&!Number.isFinite(o))throw new TypeError("addVideoChunkRaw's sixth argument (compositionTimeOffset), when provided, must be a real number.");if(m(this,pe,Ne).call(this),!i(this,h).video)throw new Error("No video track declared.");if(typeof i(this,h).fastStart=="object"&&i(this,T).samples.length===i(this,h).fastStart.expectedVideoChunks)throw new Error(`Cannot add more video chunks than specified in 'fastStart' (${i(this,h).fastStart.expectedVideoChunks}).`);let l=m(this,ue,xe).call(this,i(this,T),e,t,s,r,a,o);if(i(this,h).fastStart==="fragmented"&&i(this,S)){for(;i(this,P).length>0&&i(this,P)[0].decodeTimestamp<=l.decodeTimestamp;){let u=i(this,P).shift();m(this,M,I).call(this,i(this,S),u)}l.decodeTimestamp<=i(this,S).lastDecodeTimestamp?m(this,M,I).call(this,i(this,T),l):i(this,R).push(l)}else m(this,M,I).call(this,i(this,T),l)}addAudioChunk(e,t,s){if(!(e instanceof EncodedAudioChunk))throw new TypeError("addAudioChunk's first argument (sample) must be of type EncodedAudioChunk.");if(t&&typeof t!="object")throw new TypeError("addAudioChunk's second argument (meta), when provided, must be an object.");if(s!==void 0&&(!Number.isFinite(s)||s<0))throw new TypeError("addAudioChunk's third argument (timestamp), when provided, must be a non-negative real number.");let r=new Uint8Array(e.byteLength);e.copyTo(r),this.addAudioChunkRaw(r,e.type,s??e.timestamp,e.duration,t)}addAudioChunkRaw(e,t,s,r,a){if(!(e instanceof Uint8Array))throw new TypeError("addAudioChunkRaw's first argument (data) must be an instance of Uint8Array.");if(t!=="key"&&t!=="delta")throw new TypeError("addAudioChunkRaw's second argument (type) must be either 'key' or 'delta'.");if(!Number.isFinite(s)||s<0)throw new TypeError("addAudioChunkRaw's third argument (timestamp) must be a non-negative real number.");if(!Number.isFinite(r)||r<0)throw new TypeError("addAudioChunkRaw's fourth argument (duration) must be a non-negative real number.");if(a&&typeof a!="object")throw new TypeError("addAudioChunkRaw's fifth argument (meta), when provided, must be an object.");if(m(this,pe,Ne).call(this),!i(this,h).audio)throw new Error("No audio track declared.");if(typeof i(this,h).fastStart=="object"&&i(this,S).samples.length===i(this,h).fastStart.expectedAudioChunks)throw new Error(`Cannot add more audio chunks than specified in 'fastStart' (${i(this,h).fastStart.expectedAudioChunks}).`);let o=m(this,ue,xe).call(this,i(this,S),e,t,s,r,a);if(i(this,h).fastStart==="fragmented"&&i(this,T)){for(;i(this,R).length>0&&i(this,R)[0].decodeTimestamp<=o.decodeTimestamp;){let l=i(this,R).shift();m(this,M,I).call(this,i(this,T),l)}o.decodeTimestamp<=i(this,T).lastDecodeTimestamp?m(this,M,I).call(this,i(this,S),o):i(this,P).push(o)}else m(this,M,I).call(this,i(this,S),o)}finalize(){if(i(this,Y))throw new Error("Cannot finalize a muxer more than once.");if(i(this,h).fastStart==="fragmented"){for(let t of i(this,R))m(this,M,I).call(this,i(this,T),t);for(let t of i(this,P))m(this,M,I).call(this,i(this,S),t);m(this,me,Fe).call(this,!1)}else i(this,T)&&m(this,ee,de).call(this,i(this,T)),i(this,S)&&m(this,ee,de).call(this,i(this,S));let e=[i(this,T),i(this,S)].filter(Boolean);if(i(this,h).fastStart==="in-memory"){let t;for(let r=0;r<2;r++){let a=re(e,i(this,$)),o=i(this,f).measureBox(a);t=i(this,f).measureBox(i(this,k));let l=i(this,f).pos+o+t;for(let u of i(this,H)){u.offset=l;for(let{data:g}of u.samples)l+=g.byteLength,t+=g.byteLength}if(l<2**32)break;t>=2**32&&(i(this,k).largeSize=!0)}let s=re(e,i(this,$));i(this,f).writeBox(s),i(this,k).size=t,i(this,f).writeBox(i(this,k));for(let r of i(this,H))for(let a of r.samples)i(this,f).write(a.data),a.data=null}else if(i(this,h).fastStart==="fragmented"){let t=i(this,f).pos,s=ti(e);i(this,f).writeBox(s);let r=i(this,f).pos-t;i(this,f).seek(i(this,f).pos-4),i(this,f).writeU32(r)}else{let t=i(this,f).offsets.get(i(this,k)),s=i(this,f).pos-t;i(this,k).size=s,i(this,k).largeSize=s>=2**32,i(this,f).patchBox(i(this,k));let r=re(e,i(this,$));if(typeof i(this,h).fastStart=="object"){i(this,f).seek(i(this,fe)),i(this,f).writeBox(r);let a=t-i(this,f).pos;i(this,f).writeBox(ct(a))}else i(this,f).writeBox(r)}m(this,q,te).call(this),i(this,f).finalize(),C(this,Y,!0)}};return h=new WeakMap,f=new WeakMap,fe=new WeakMap,k=new WeakMap,T=new WeakMap,S=new WeakMap,$=new WeakMap,H=new WeakMap,Oe=new WeakMap,R=new WeakMap,P=new WeakMap,Y=new WeakMap,Me=new WeakSet,Qe=function(e){if(typeof e!="object")throw new TypeError("The muxer requires an options object to be passed to its constructor.");if(!(e.target instanceof ae))throw new TypeError("The target must be provided and an instance of Target.");if(e.video){if(!mi.includes(e.video.codec))throw new TypeError(`Unsupported video codec: ${e.video.codec}`);if(!Number.isInteger(e.video.width)||e.video.width<=0)throw new TypeError(`Invalid video width: ${e.video.width}. Must be a positive integer.`);if(!Number.isInteger(e.video.height)||e.video.height<=0)throw new TypeError(`Invalid video height: ${e.video.height}. Must be a positive integer.`);const t=e.video.rotation;if(typeof t=="number"&&![0,90,180,270].includes(t))throw new TypeError(`Invalid video rotation: ${t}. Has to be 0, 90, 180 or 270.`);if(Array.isArray(t)&&(t.length!==9||t.some(s=>typeof s!="number")))throw new TypeError(`Invalid video transformation matrix: ${t.join()}`);if(e.video.frameRate!==void 0&&(!Number.isInteger(e.video.frameRate)||e.video.frameRate<=0))throw new TypeError(`Invalid video frame rate: ${e.video.frameRate}. Must be a positive integer.`)}if(e.audio){if(!pi.includes(e.audio.codec))throw new TypeError(`Unsupported audio codec: ${e.audio.codec}`);if(!Number.isInteger(e.audio.numberOfChannels)||e.audio.numberOfChannels<=0)throw new TypeError(`Invalid number of audio channels: ${e.audio.numberOfChannels}. Must be a positive integer.`);if(!Number.isInteger(e.audio.sampleRate)||e.audio.sampleRate<=0)throw new TypeError(`Invalid audio sample rate: ${e.audio.sampleRate}. Must be a positive integer.`)}if(e.firstTimestampBehavior&&!wi.includes(e.firstTimestampBehavior))throw new TypeError(`Invalid first timestamp behavior: ${e.firstTimestampBehavior}`);if(typeof e.fastStart=="object"){if(e.video){if(e.fastStart.expectedVideoChunks===void 0)throw new TypeError("'fastStart' is an object but is missing property 'expectedVideoChunks'.");if(!Number.isInteger(e.fastStart.expectedVideoChunks)||e.fastStart.expectedVideoChunks<0)throw new TypeError("'expectedVideoChunks' must be a non-negative integer.")}if(e.audio){if(e.fastStart.expectedAudioChunks===void 0)throw new TypeError("'fastStart' is an object but is missing property 'expectedAudioChunks'.");if(!Number.isInteger(e.fastStart.expectedAudioChunks)||e.fastStart.expectedAudioChunks<0)throw new TypeError("'expectedAudioChunks' must be a non-negative integer.")}}else if(![!1,"in-memory","fragmented"].includes(e.fastStart))throw new TypeError("'fastStart' option must be false, 'in-memory', 'fragmented' or an object.");if(e.minFragmentDuration!==void 0&&(!Number.isFinite(e.minFragmentDuration)||e.minFragmentDuration<0))throw new TypeError("'minFragmentDuration' must be a non-negative number.")},Be=new WeakSet,Je=function(){if(i(this,f).writeBox(pt({holdsAvc:i(this,h).video?.codec==="avc",fragmented:i(this,h).fastStart==="fragmented"})),C(this,fe,i(this,f).pos),i(this,h).fastStart==="in-memory")C(this,k,Se(!1));else if(i(this,h).fastStart!=="fragmented"){if(typeof i(this,h).fastStart=="object"){let e=m(this,Ie,Ye).call(this);i(this,f).seek(i(this,f).pos+e)}C(this,k,Se(!0)),i(this,f).writeBox(i(this,k))}m(this,q,te).call(this)},Ie=new WeakSet,Ye=function(){if(typeof i(this,h).fastStart!="object")return;let e=0,t=[i(this,h).fastStart.expectedVideoChunks,i(this,h).fastStart.expectedAudioChunks];for(let s of t)s&&(e+=8*Math.ceil(.6666666666666666*s),e+=4*s,e+=12*Math.ceil(.6666666666666666*s),e+=4*s,e+=8*s);return e+=4096,e},De=new WeakSet,et=function(){if(i(this,h).video&&C(this,T,{id:1,info:{type:"video",codec:i(this,h).video.codec,width:i(this,h).video.width,height:i(this,h).video.height,rotation:i(this,h).video.rotation??0,decoderConfig:null},timescale:i(this,h).video.frameRate??57600,samples:[],finalizedChunks:[],currentChunk:null,firstDecodeTimestamp:void 0,lastDecodeTimestamp:-1,timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,compactlyCodedChunkTable:[]}),i(this,h).audio&&(C(this,S,{id:i(this,h).video?2:1,info:{type:"audio",codec:i(this,h).audio.codec,numberOfChannels:i(this,h).audio.numberOfChannels,sampleRate:i(this,h).audio.sampleRate,decoderConfig:null},timescale:i(this,h).audio.sampleRate,samples:[],finalizedChunks:[],currentChunk:null,firstDecodeTimestamp:void 0,lastDecodeTimestamp:-1,timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,compactlyCodedChunkTable:[]}),i(this,h).audio.codec==="aac")){let e=m(this,Ue,tt).call(this,2,i(this,h).audio.sampleRate,i(this,h).audio.numberOfChannels);i(this,S).info.decoderConfig={codec:i(this,h).audio.codec,description:e,numberOfChannels:i(this,h).audio.numberOfChannels,sampleRate:i(this,h).audio.sampleRate}}},Ue=new WeakSet,tt=function(e,t,s){let a=[96e3,88200,64e3,48e3,44100,32e3,24e3,22050,16e3,12e3,11025,8e3,7350].indexOf(t),o=s,l="";l+=e.toString(2).padStart(5,"0"),l+=a.toString(2).padStart(4,"0"),a===15&&(l+=t.toString(2).padStart(24,"0")),l+=o.toString(2).padStart(4,"0");let u=Math.ceil(l.length/8)*8;l=l.padEnd(u,"0");let g=new Uint8Array(l.length/8);for(let b=0;b<l.length;b+=8)g[b/8]=parseInt(l.slice(b,b+8),2);return g},ue=new WeakSet,xe=function(e,t,s,r,a,o,l){let u=r/1e6,g=(r-(l??0))/1e6,b=a/1e6,U=m(this,We,it).call(this,u,g,e);return u=U.presentationTimestamp,g=U.decodeTimestamp,o?.decoderConfig&&(e.info.decoderConfig===null?e.info.decoderConfig=o.decoderConfig:Object.assign(e.info.decoderConfig,o.decoderConfig)),{presentationTimestamp:u,decodeTimestamp:g,duration:b,data:t,size:t.byteLength,type:s,timescaleUnitsToNextSample:O(b,e.timescale)}},M=new WeakSet,I=function(e,t){i(this,h).fastStart!=="fragmented"&&e.samples.push(t);const s=O(t.presentationTimestamp-t.decodeTimestamp,e.timescale);if(e.lastTimescaleUnits!==null){let a=O(t.decodeTimestamp,e.timescale,!1),o=Math.round(a-e.lastTimescaleUnits);if(e.lastTimescaleUnits+=o,e.lastSample.timescaleUnitsToNextSample=o,i(this,h).fastStart!=="fragmented"){let l=se(e.timeToSampleTable);l.sampleCount===1?(l.sampleDelta=o,l.sampleCount++):l.sampleDelta===o?l.sampleCount++:(l.sampleCount--,e.timeToSampleTable.push({sampleCount:2,sampleDelta:o}));const u=se(e.compositionTimeOffsetTable);u.sampleCompositionTimeOffset===s?u.sampleCount++:e.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:s})}}else e.lastTimescaleUnits=0,i(this,h).fastStart!=="fragmented"&&(e.timeToSampleTable.push({sampleCount:1,sampleDelta:O(t.duration,e.timescale)}),e.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:s}));e.lastSample=t;let r=!1;if(!e.currentChunk)r=!0;else{let a=t.presentationTimestamp-e.currentChunk.startTimestamp;if(i(this,h).fastStart==="fragmented"){let o=i(this,T)??i(this,S);const l=i(this,h).minFragmentDuration??1;e===o&&t.type==="key"&&a>=l&&(r=!0,m(this,me,Fe).call(this))}else r=a>=.5}r&&(e.currentChunk&&m(this,ee,de).call(this,e),e.currentChunk={startTimestamp:t.presentationTimestamp,samples:[]}),e.currentChunk.samples.push(t)},We=new WeakSet,it=function(e,t,s){const r=i(this,h).firstTimestampBehavior==="strict",a=s.lastDecodeTimestamp===-1;if(r&&a&&t!==0)throw new Error(`The first chunk for your media track must have a timestamp of 0 (received DTS=${t}).Non-zero first timestamps are often caused by directly piping frames or audio data from a MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of thedocument, which is probably what you want.

If you want to offset all timestamps of a track such that the first one is zero, set firstTimestampBehavior: 'offset' in the options.
`);if(i(this,h).firstTimestampBehavior==="offset"||i(this,h).firstTimestampBehavior==="cross-track-offset"){s.firstDecodeTimestamp===void 0&&(s.firstDecodeTimestamp=t);let l;i(this,h).firstTimestampBehavior==="offset"?l=s.firstDecodeTimestamp:l=Math.min(i(this,T)?.firstDecodeTimestamp??1/0,i(this,S)?.firstDecodeTimestamp??1/0),t-=l,e-=l}if(t<s.lastDecodeTimestamp)throw new Error(`Timestamps must be monotonically increasing (DTS went from ${s.lastDecodeTimestamp*1e6} to ${t*1e6}).`);return s.lastDecodeTimestamp=t,{presentationTimestamp:e,decodeTimestamp:t}},ee=new WeakSet,de=function(e){if(i(this,h).fastStart==="fragmented")throw new Error("Can't finalize individual chunks if 'fastStart' is set to 'fragmented'.");if(e.currentChunk){if(e.finalizedChunks.push(e.currentChunk),i(this,H).push(e.currentChunk),(e.compactlyCodedChunkTable.length===0||se(e.compactlyCodedChunkTable).samplesPerChunk!==e.currentChunk.samples.length)&&e.compactlyCodedChunkTable.push({firstChunk:e.finalizedChunks.length,samplesPerChunk:e.currentChunk.samples.length}),i(this,h).fastStart==="in-memory"){e.currentChunk.offset=0;return}e.currentChunk.offset=i(this,f).pos;for(let t of e.currentChunk.samples)i(this,f).write(t.data),t.data=null;m(this,q,te).call(this)}},me=new WeakSet,Fe=function(e=!0){if(i(this,h).fastStart!=="fragmented")throw new Error("Can't finalize a fragment unless 'fastStart' is set to 'fragmented'.");let t=[i(this,T),i(this,S)].filter(u=>u&&u.currentChunk);if(t.length===0)return;let s=ut(this,Oe)._++;if(s===1){let u=re(t,i(this,$),!0);i(this,f).writeBox(u)}let r=i(this,f).pos,a=$e(s,t);i(this,f).writeBox(a);{let u=Se(!1),g=0;for(let U of t)for(let ie of U.currentChunk.samples)g+=ie.size;let b=i(this,f).measureBox(u)+g;b>=4294967296&&(u.largeSize=!0,b=i(this,f).measureBox(u)+g),u.size=b,i(this,f).writeBox(u)}for(let u of t){u.currentChunk.offset=i(this,f).pos,u.currentChunk.moofOffset=r;for(let g of u.currentChunk.samples)i(this,f).write(g.data),g.data=null}let o=i(this,f).pos;i(this,f).seek(i(this,f).offsets.get(a));let l=$e(s,t);i(this,f).writeBox(l),i(this,f).seek(o);for(let u of t)u.finalizedChunks.push(u.currentChunk),i(this,H).push(u.currentChunk),u.currentChunk=null;e&&m(this,q,te).call(this)},q=new WeakSet,te=function(){i(this,f)instanceof ze&&i(this,f).flush()},pe=new WeakSet,Ne=function(){if(i(this,Y))throw new Error("Cannot add new video or audio chunks after the file has been finalized.")},ft(Re)})();typeof module=="object"&&typeof module.exports=="object"&&Object.assign(module.exports,Mp4Muxer);

  return Mp4Muxer;
  }
)();
