const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const COL = new Intl.Collator('it');
const MAX_MSG = 400;

const CATS = [];
const FACET = {
  disney: 'Film', anime: 'Serie', storici: 'Ambito', famosi: 'Ambito',
  animali: 'Classe', mestieri: 'Settore', giochi: 'Genere', citta: 'Paese',
  paesi: 'Continente', film: 'Genere', serie: 'Genere', calcio: 'Nazione',
  musica: 'Nazione', cibi: 'Tipo', natura: 'Tipo', luoghi: 'Paese',
  trasporti: 'Tipo', sport: 'Tipo', oggetti: 'Tipo', vestiti: 'Tipo',
  supereroi: 'Universo'
};
const WIKI_CACHE = {};

const facet = c => FACET[c.k] || (c.custom || c.tmp ? 'Gruppo' : 'Filtro');

function lst(c) {
  if (!c) return [];
  if (!c.list) {
    const seen = new Map();
    const l = [];
    for (const s of (c.raw || []).join(';').split(';')) {
      const p = s.indexOf(' ');
      if (p < 1) continue;
      let n = s.slice(p + 1);
      let g = '';
      const k = n.lastIndexOf('|');
      if (k > 0) {
        g = n.slice(k + 1);
        n = n.slice(0, k);
      }
      const x = norm(n).replace(/[^a-z0-9]+/g, '');
      if (!n || !x) continue;
      const o = seen.get(x);
      if (o) {
        if (!o.g && g) o.g = g;
        continue;
      }
      const it = { e: s.slice(0, p), n, s: norm(n), g };
      seen.set(x, it);
      l.push(it);
    }
    c.list = l.sort((a, b) => COL.compare(a.n, b.n));
  }
  return c.list;
}

function groups(c) {
  if (!c) return [];
  if (!c.gl) {
    const m = new Map();
    for (const i of lst(c)) if (i.g) m.set(i.g, (m.get(i.g) || 0) + 1);
    c.gl = m.size > 1 ? [...m].sort((a, b) => b[1] - a[1] || COL.compare(a[0], b[0])) : [];
  }
  return c.gl;
}

const cnt = c => (!c.loaded && c.json && c.jcount) ? c.jcount : lst(c).length;

async function loadIndex() {
  try {
    const r = await fetch('data/index.json');
    if (!r.ok) return;
    const d = await r.json();
    for (const c of d.categories || []) {
      const ex = CATS.find(x => x.k === c.id);
      if (ex) {
        ex.n = c.n;
        ex.e = c.e;
        ex.json = 1;
        ex.jcount = c.count;
      } else {
        CATS.push({ k: c.id, n: c.n, e: c.e, raw: [], json: 1, jcount: c.count });
      }
    }
    ui.idxLoaded = true;
    if (app.dataset.s === 'home') render();
    else if (st) ensureCat(cat());
  } catch (e) {
    ui.idxErr = 'Impossibile caricare data/index.json';
    if (app.dataset.s === 'home') render();
  }
}

async function ensureCat(c) {
  if (!c || !c.json || c.loaded || c.loading) return;
  c.loading = 1;
  if (app.dataset.s === 'lobby') drawList();
  try {
    const r = await fetch(`data/${c.k}.json`);
    if (r.ok) {
      const d = await r.json();
      const rows = [];
      for (const [g, names] of Object.entries(d.g || {})) {
        for (const nm of names) rows.push(`${d.e} ${nm}|${g}`);
      }
      if (rows.length) c.raw = [rows.join(';')];
      c.list = null;
      c.gl = null;
    }
  } catch (e) {}
  c.loading = 0;
  c.loaded = 1;
  if (app.dataset.s === 'lobby') {
    const gfr = $('#gfr');
    if (gfr) gfr.innerHTML = gbtn();
    drawList();
  }
}

const SEQ = new Set(['go', 'ask', 'ans', 're', 'cat']);
let me = Math.random().toString(36).slice(2, 9);
let name = '';
let code = location.hash.slice(1).toLowerCase();
let host = false;
let st = null;
let secret = null;
let crossed = {};
let notes = '';
let R = null;
let connSeq = 0;
const seenChat = new Set();
let synced = false;
let view = [];
let lastAct = '';
let hbT = 0;
let lastTy = 0;
let flashT = 0;
let audioCtx = null;

const ui = { q: '', g: '', dr: null, dx: '', asc: true, mode: 'q', err: '', conn: false, on: true, idxLoaded: false, idxErr: '' };
try { name = localStorage.getItem('nm') || ''; } catch (e) {}

const cat = () => CATS.find(c => c.k === st.cat) || (st.cn ? { k: st.cat, n: st.cn.n, e: st.cn.e, raw: [''], list: [], tmp: 1, wait: 1 } : { k: st.cat, n: st.cat, e: '🎯', raw: [], json: 1 });
const cbuf = {};
try {
  JSON.parse(localStorage.getItem('ind-cc') || '[]').forEach(c => {
    CATS.push({ k: c.k, n: c.n, e: c.e, raw: [c.i], custom: 1 });
  });
} catch (e) {}

const pn = id => (st.pl[id] && st.pl[id].n) || '?';
const who = f => f === me ? 'Tu' : pn(f);
const other = () => st.order.find(i => i !== me);
const wins = id => (st.sc && st.sc[id]) || 0;
const need = () => Math.floor((st.bo || 0) / 2) + 1;
const serie = () => st.bo && st.order.find(i => wins(i) >= need());

function toast(t) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = t;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2400);
}

const TH = { t: 'auto', a: 0, s: true };
try { Object.assign(TH, JSON.parse(localStorage.getItem('ind-th') || '{}')); } catch (e) {}
const ACC = [
  ['Corallo', '#ff6b4a', '#ffb347'],
  ['Viola', '#7c5cff', '#c08bff'],
  ['Mare', '#0098d9', '#3fd6c7'],
  ['Verde', '#25a56f', '#9be23c'],
  ['Rosa', '#f0408a', '#ff9ac1'],
  ['Oro', '#d99a00', '#ffd24a']
];

function applyTheme() {
  const r = document.documentElement;
  const a = ACC[TH.a] || ACC[0];
  if (TH.t === 'auto') r.removeAttribute('data-theme');
  else r.dataset.theme = TH.t;
  r.style.setProperty('--pri', a[1]);
  r.style.setProperty('--pri2', a[2]);
  try { localStorage.setItem('ind-th', JSON.stringify(TH)); } catch (e) {}
}

function playChime() {
  if (!TH.s) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const playTone = (freq, start, dur) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.001, start);
      g.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(start);
      o.stop(start + dur);
    };
    playTone(587.33, now, 0.14);
    playTone(880, now + 0.11, 0.22);
  } catch (e) {}
}

function stopTitleFlash() {
  if (flashT) {
    clearInterval(flashT);
    flashT = 0;
  }
  document.title = 'Indovina!';
}

function notifyTurn(label) {
  playChime();
  try { if (navigator.vibrate) navigator.vibrate([70, 40, 70]); } catch (e) {}
  if (document.hidden && !flashT) {
    let on = true;
    document.title = '🔔 ' + label;
    flashT = setInterval(() => {
      on = !on;
      document.title = on ? ('🔔 ' + label) : 'Indovina!';
    }, 1000);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) stopTitleFlash();
});
addEventListener('focus', stopTitleFlash);

function settings() {
  const o = document.createElement('div');
  o.className = 'ov';
  const draw = () => {
    o.innerHTML = `<div class="card">
      <b>Aspetto e suoni</b>
      <div class="row" style="margin:10px 0">${[['auto', 'Auto'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([k, n]) => `<button class="ghost ${TH.t === k ? 'on' : ''}" style="flex:1" data-s="t" data-k="${k}">${n}</button>`).join('')}</div>
      <div class="row" style="flex-wrap:wrap;gap:10px;margin-bottom:12px">${ACC.map((a, i) => `<button data-s="a" data-k="${i}" title="${a[0]}" style="width:38px;height:38px;border-radius:50%;border:3px solid ${TH.a === i ? 'var(--ink)' : 'transparent'};background:linear-gradient(135deg,${a[1]},${a[2]});cursor:pointer"></button>`).join('')}</div>
      <button class="ghost ${TH.s ? 'on' : ''}" style="width:100%" data-s="snd">${TH.s ? '🔊 Suoni e notifiche: Attivi' : '🔇 Suoni e notifiche: Disattivati'}</button>
      <button class="btn big" style="margin-top:14px" data-s="x">Fatto</button>
    </div>`;
  };
  o.onclick = e => {
    const b = e.target.closest('[data-s]');
    if (!b) return;
    const d = b.dataset;
    if (d.s === 'x') { o.remove(); return; }
    if (d.s === 't') TH.t = d.k;
    else if (d.s === 'a') TH.a = +d.k;
    else if (d.s === 'snd') { TH.s = !TH.s; if (TH.s) playChime(); }
    applyTheme();
    draw();
  };
  draw();
  document.body.appendChild(o);
}
applyTheme();

function buildSnapLog(log) {
  const qa = [];
  const chat = [];
  log.forEach((entry, idx) => {
    if (entry.k === 'c') chat.push([idx, entry]);
    else qa.push([idx, entry]);
  });
  const keepChat = chat.slice(-20);
  return qa.concat(keepChat).sort((a, b) => a[0] - b[0]).map(x => x[1]);
}

function send(m) {
  m.f = me;
  if (R) R.emit('g', m).catch(() => {});
}

function act(m) {
  m.f = me;
  apply(m);
  if (SEQ.has(m.t)) m.n = st.q;
  send(m);
}

function net() {
  document.body.classList.toggle('offl', !!st && !ui.on);
}

function resync() {
  if (!st) {
    if (!host) send({ t: 'hi', n: name });
    return;
  }
  if (catLost()) send({ t: 'cq' });
  send({ t: 'sy', v: st.q || 0 });
  if (st.ph === 'lobby' && st.pl[me]) send({ t: 'rd', v: st.pl[me].r });
}
window.resync = resync;

function onMsg(m) {
  const d = m.data;
  if (m.sameTab || !d || d.f === me) return;
  if (d.t === 'ty') { typing(); return; }
  if (d.t === 'cc') { gotChunk(d); return; }
  if (d.t === 'cq') { if (host) shareCat(); return; }
  if (SEQ.has(d.t) && st) {
    const q = st.q || 0;
    if (d.n <= q) return;
    if (d.n > q + 1) { send({ t: 'sy', v: q }); return; }
  }
  apply(d);
}

const catLost = () => st && !host && !CATS.some(c => c.k === st.cat);

function shareCat() {
  const c = st && CATS.find(k => k.k === st.cat);
  if (!c || !c.custom) return;
  const s = c.raw.join(';');
  const ps = [];
  for (let i = 0; i < s.length; i += 1400) ps.push(s.slice(i, i + 1400));
  ps.forEach((x, i) => setTimeout(() => send({ t: 'cc', k: c.k, i, of: ps.length, x }), i * 150));
}

function gotChunk(d) {
  if (!st || d.k !== st.cat || CATS.some(c => c.k === d.k)) return;
  const b = cbuf[d.k] = cbuf[d.k] || [];
  b[d.i] = d.x;
  if (b.filter(x => x !== undefined).length === d.of) {
    CATS.push({ k: d.k, n: st.cn.n, e: st.cn.e, raw: [b.join('')], tmp: 1 });
    delete cbuf[d.k];
    if (app.dataset.s === 'lobby') drawList();
    render();
  }
}

function typing() {
  if (!st || !st.pl) return;
  const e = $('#ty');
  if (e) e.textContent = '✍️ ' + pn(other()) + ' sta scrivendo…';
  clearTimeout(ui.tt);
  ui.tt = setTimeout(() => {
    const el = $('#ty');
    if (el) el.textContent = '';
  }, 3000);
}

async function connect() {
  if (!window.IndovinaNet || typeof mqtt === 'undefined') {
    ui.err = 'Impossibile avviare la rete MQTT. Ricarica la pagina o controlla la connessione.';
    return render();
  }
  const seq = ++connSeq;
  if (R) {
    try { R.leave(); } catch (e) {}
    R = null;
  }
  const retry = () => setTimeout(() => { if (code && !R && seq === connSeq) connect(); }, 2500);
  try {
    const joined = await window.IndovinaNet.join('g-' + code);
    if (seq !== connSeq || !code) {
      try { joined.leave(); } catch (e) {}
      return;
    }
    R = joined;
    R.on('g', onMsg);
    ui.on = R.connected();
    R.onConnection(c => {
      if (seq !== connSeq) return;
      ui.on = c;
      net();
      if (c) resync();
    });
  } catch (e) {
    R = null;
    if (!st) {
      ui.err = 'Connessione ai server MQTT non riuscita. Riprova.';
      return render();
    }
    ui.on = false;
    net();
    return retry();
  }
  net();
  resync();
  if (!hbT) {
    hbT = setInterval(() => {
      if (!R || !st) return;
      send({ t: 'sy', v: st.q || 0 });
      if (catLost()) send({ t: 'cq' });
      if (st.ph === 'lobby') {
        if (st.pl[me]) send({ t: 'rd', v: st.pl[me].r });
        if (host) send({ t: 'md', m: st.mode, bo: st.bo });
      }
    }, 5000);
  }
  if (!host && !synced) {
    const hi = () => send({ t: 'hi', n: name });
    hi();
    const t = setInterval(() => synced ? clearInterval(t) : hi(), 1500);
    setTimeout(() => {
      if (!st) {
        ui.err = 'Nessuno risponde: controlla il codice e che l’amico abbia la partita aperta.';
        render();
      }
    }, 12000);
  }
}

const snap = () => send({ t: 'snap', st: { ...st, log: buildSnapLog(st.log) } });

function apply(m) {
  const f = m.f;
  if (!st && m.t !== 'snap') return;
  switch (m.t) {
    case 'hi':
      if (!host || !st) return;
      if (!st.pl[f]) {
        if (st.order.length >= 2) return;
        st.pl[f] = { n: m.n, r: 0 };
        st.order.push(f);
      }
      snap();
      shareCat();
      break;
    case 'snap':
      if (st && (m.st.q || 0) <= (st.q || 0)) return;
      st = m.st;
      synced = true;
      if (catLost()) send({ t: 'cq' });
      else ensureCat(cat());
      break;
    case 'sy':
      if ((st.q || 0) > (m.v || 0)) snap();
      return;
    case 'md':
      if (f !== st.order[0] || st.ph !== 'lobby') return;
      st.mode = m.m;
      st.bo = m.bo;
      break;
    case 'cat':
      if (f !== st.order[0] || st.ph !== 'lobby') return;
      st.cat = m.k;
      st.cn = m.cn || null;
      secret = null;
      crossed = {};
      notes = '';
      ui.q = '';
      ui.g = '';
      st.order.forEach(i => { if (st.pl[i]) st.pl[i].r = 0; });
      if (catLost()) send({ t: 'cq' });
      else ensureCat(cat());
      if (f !== me) toast('Categoria cambiata: ' + cat().n);
      app.dataset.s = '';
      break;
    case 'bye':
      if (!host && f === st.order[0]) {
        toast('L’host ha chiuso la partita');
        setTimeout(leave, 1200);
        return;
      }
      toast(pn(f) + ' è uscito dalla partita');
      if (st.ph === 'lobby') {
        st.order = st.order.filter(i => i !== f);
        delete st.pl[f];
      }
      break;
    case 'rd':
      if (st.ph !== 'lobby' || !st.pl[f]) return;
      st.pl[f].r = m.v;
      if (host && st.order.length === 2 && st.order.every(i => st.pl[i].r)) {
        act({ t: 'go', turn: Math.random() < 0.5 ? 0 : 1 });
      }
      break;
    case 'go':
      st.ph = 'play';
      st.turn = m.turn;
      st.rd = 1;
      st.log = [];
      st.pend = null;
      notes = '';
      if (st.order[st.turn] === me) notifyTurn('Inizia! Tocca a te');
      break;
    case 'ask':
      st.pend = { k: m.k, x: m.x, f };
      st.log.push({ k: m.k, f, x: m.x });
      if (f !== me) notifyTurn(m.k === 'g' ? 'Tentativo!' : 'Nuova domanda!');
      break;
    case 'ans':
      st.log.push({ k: 'a', f, x: m.x, ok: m.ok });
      if (st.pend && st.pend.k === 'g' && m.ok) {
        st.ph = 'end';
        st.win = st.pend.f;
        st.sc = st.sc || {};
        st.sc[st.win] = wins(st.win) + 1;
        if (secret) act({ t: 'rv', s: secret });
        if (f !== me) notifyTurn(st.win === me ? 'Hai vinto!' : 'Partita finita!');
      } else {
        st.pend = null;
        st.turn = 1 - st.turn;
        if (st.turn === 0) st.rd++;
        if (st.order[st.turn] === me) notifyTurn('Tocca a te!');
      }
      break;
    case 'c':
      if (m.id) {
        if (seenChat.has(m.id)) return;
        seenChat.add(m.id);
      }
      st.log.push({ k: 'c', f, x: m.x, id: m.id });
      break;
    case 'rv':
      st.rv[f] = m.s;
      break;
    case 're':
      st.ph = 'lobby';
      st.log = [];
      st.rv = {};
      st.win = null;
      st.pend = null;
      secret = null;
      crossed = {};
      notes = '';
      if (m.rs) st.sc = {};
      st.order.forEach(i => { if (st.pl[i]) st.pl[i].r = 0; });
      break;
  }
  if (SEQ.has(m.t)) st.q = (st.q || 0) + 1;
  render();
  refreshScratchpad();
}

function newGame(k) {
  name = ($('#nm') || {}).value.trim() || 'Giocatore';
  try { localStorage.setItem('nm', name); } catch (e) {}
  code = Math.random().toString(36).slice(2, 10);
  host = true;
  synced = true;
  location.hash = code;
  crossed = {};
  notes = '';
  ui.q = '';
  ui.g = '';
  ui.dr = null;
  ui.dx = '';
  const cc = CATS.find(c => c.k === k);
  st = {
    cat: k,
    cn: cc && cc.custom ? { n: cc.n, e: cc.e } : null,
    ph: 'lobby',
    pl: { [me]: { n: name, r: 0 } },
    order: [me],
    turn: 0,
    rd: 1,
    log: [],
    pend: null,
    win: null,
    rv: {},
    q: 0,
    mode: 'n',
    bo: 0,
    sc: {}
  };
  ensureCat(cc);
  connect();
  render();
}

function joinGame() {
  const el = $('#nm');
  if (el) name = el.value.trim() || 'Giocatore';
  try { localStorage.setItem('nm', name); } catch (e) {}
  host = false;
  ui.g = '';
  ui.conn = true;
  ui.err = '';
  connect();
  render();
}

function getQaPairs() {
  const pairs = [];
  for (const l of (st && st.log) || []) {
    if (l.k === 'q' || l.k === 'g') {
      pairs.push({ k: l.k, f: l.f, q: l.x, a: null });
    } else if (l.k === 'a') {
      const target = [...pairs].reverse().find(x => !x.a);
      if (target) target.a = l;
    }
  }
  return pairs;
}

function refreshScratchpad() {
  const sp = $('#sp-qa');
  if (!sp) return;
  const flt = sp.dataset.f || 'all';
  const pairs = getQaPairs().filter(p => flt === 'all' || (flt === 'me' ? p.f === me : p.f !== me));
  if (!pairs.length) {
    sp.innerHTML = '<p class="wt">Nessuna domanda registrata ancora.</p>';
    return;
  }
  sp.innerHTML = pairs.map((p, idx) => {
    const aTxt = p.a ? p.a.x : 'In attesa…';
    const cls = p.a ? (p.a.ok === true || /^s[iì]\b/i.test(p.a.x) ? 'yes' : (p.a.ok === false || /^no\b/i.test(p.a.x) ? 'no' : '')) : '';
    return `<div class="sp-row">
      <div class="sp-q"><small style="color:var(--mut)">#${idx + 1} · ${esc(who(p.f))} (${p.k === 'g' ? '🎯' : '❓'})</small><br>${esc(p.q)}</div>
      <div class="sp-a ${cls}">↳ ${esc(aTxt)}</div>
    </div>`;
  }).join('');
}

function openScratchpad() {
  const o = document.createElement('div');
  o.className = 'bd';
  o.innerHTML = `<div class="top">
      <button class="ghost sm" data-x="c">✕</button>
      <b>📝 Appunti e Q&amp;A</b>
      <button class="ghost sm" data-x="cp">📋 Copia</button>
    </div>
    <div class="page" style="display:flex;flex-direction:column;gap:10px">
      <div class="row">
        <button class="ghost sm on" data-x="f" data-v="all" style="flex:1">Tutte</button>
        <button class="ghost sm" data-x="f" data-v="me" style="flex:1">Le mie</button>
        <button class="ghost sm" data-x="f" data-v="you" style="flex:1">Avversario</button>
      </div>
      <div id="sp-qa" class="sp-list" data-f="all"></div>
      <div>
        <label for="sp-notes">Le tue deduzioni (salvate in locale)</label>
        <textarea id="sp-notes" rows="5" placeholder="Scrivi qui indizi, ipotesi o nomi da escludere…">${esc(notes)}</textarea>
      </div>
    </div>`;
  document.body.appendChild(o);
  refreshScratchpad();
  o.addEventListener('click', async e => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    if (b.dataset.x === 'c') { o.remove(); return; }
    if (b.dataset.x === 'f') {
      o.querySelectorAll('[data-x="f"]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      const sp = o.querySelector('#sp-qa');
      sp.dataset.f = b.dataset.v;
      refreshScratchpad();
    } else if (b.dataset.x === 'cp') {
      const txt = getQaPairs().map((p, i) => `${i + 1}. [${who(p.f)}] ${p.q} -> ${p.a ? p.a.x : '...'}`).join('\n') + (notes ? '\n\nNote:\n' + notes : '');
      try {
        await navigator.clipboard.writeText(txt);
        toast('Appunti copiati!');
      } catch (err) {}
    }
  });
  o.addEventListener('input', e => {
    if (e.target.id === 'sp-notes') {
      notes = e.target.value;
      save();
    }
  });
}

async function showWikiInfo(title) {
  const o = document.createElement('div');
  o.className = 'ov';
  o.innerHTML = `<div class="card">
    <div class="row" style="justify-content:space-between"><b>ℹ️ ${esc(title)}</b><button class="ghost sm" data-w="x">✕</button></div>
    <div id="wk-body"><p class="wt" style="margin:16px 0">⏳ Cerco su Wikipedia…</p></div>
  </div>`;
  o.onclick = e => {
    if (e.target === o || e.target.closest('[data-w="x"]')) o.remove();
  };
  document.body.appendChild(o);

  const renderWiki = data => {
    const body = o.querySelector('#wk-body');
    if (!body) return;
    if (!data) {
      body.innerHTML = '<p class="wt" style="margin:14px 0">Nessuna descrizione trovata su Wikipedia.</p>';
      return;
    }
    const img = data.thumbnail && data.thumbnail.source ? `<img class="wiki-img" src="${esc(data.thumbnail.source)}" alt="">` : '';
    const link = data.content_urls && data.content_urls.desktop ? `<a class="wiki-link" href="${esc(data.content_urls.desktop.page)}" target="_blank" rel="noopener">Apri su Wikipedia ↗</a>` : '';
    body.innerHTML = `${img}<p class="wiki-text">${esc(data.extract || 'Nessun riassunto disponibile.')}</p>${link}`;
  };

  if (WIKI_CACHE[title] !== undefined) {
    renderWiki(WIKI_CACHE[title]);
    return;
  }
  const fetchLang = async lang => {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    return d.type === 'disambiguation' || !d.extract ? null : d;
  };
  try {
    let data = await fetchLang('it');
    if (!data) data = await fetchLang('en');
    WIKI_CACHE[title] = data;
    renderWiki(data);
  } catch (e) {
    renderWiki(null);
  }
}

function openCatSwitcher() {
  if (!host || !st || st.ph !== 'lobby') return;
  const o = document.createElement('div');
  o.className = 'bd';
  o.innerHTML = `<div class="top"><button class="ghost sm" data-x="c">✕</button><b>🔄 Cambia categoria</b><span></span></div>
    <div class="page"><div class="grid">${CATS.map(c => `<button class="cat ${c.k === st.cat ? 'on' : ''}" data-x="pick" data-k="${c.k}"><span>${c.e}</span><b>${esc(c.n)}</b><small>${cnt(c)} voci</small></button>`).join('')}</div></div>`;
  document.body.appendChild(o);
  o.onclick = e => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    if (b.dataset.x === 'c') { o.remove(); return; }
    const k = b.dataset.k;
    o.remove();
    if (k === st.cat) return;
    const cc = CATS.find(c => c.k === k);
    act({ t: 'cat', k, cn: cc && cc.custom ? { n: cc.n, e: cc.e } : null });
    if (cc && cc.custom) shareCat();
  };
}

const gtxt = () => '🧩 ' + facet(cat()) + ': ' + (ui.g || 'Tutti');
const gbtn = () => groups(cat()).length ? `<button class="ghost" style="width:100%" data-a="grp">${esc(gtxt())}</button>` : '';
const nameBox = () => `<div class="card"><label>Il tuo nome</label><input id="nm" maxlength="20" placeholder="Come ti chiami?" value="${esc(name)}"></div>`;
const netBanner = () => `<div class="net-banner"><span>⚠️ Connessione persa</span><button data-a="reconn">Riconnetti</button></div>`;

const V = {
  home: () => `<div class="page">
    <div style="display:flex;justify-content:flex-end"><button class="ghost sm" data-a="set">⚙️</button></div>
    <div class="hero" style="padding-top:0"><div class="logo">🔮</div><h1>Indovina!</h1><p>Scegli un segreto, fai domande e scopri quello dell’altro.</p></div>
    ${nameBox()}
    <h3>Crea una partita</h3>
    ${ui.idxErr ? `<p class="err">${esc(ui.idxErr)}</p>` : (!ui.idxLoaded && !CATS.length ? '<p class="wt">⏳ Caricamento categorie…</p>' : '')}
    <div class="grid">${CATS.map(c => `<button class="cat" data-a="new" data-k="${c.k}"><span>${c.e}</span><b>${esc(c.n)}</b><small>${cnt(c)} voci</small></button>`).join('')}</div>
    <button class="ghost" style="width:100%;margin-top:10px" data-a="cc">＋ Crea categoria personalizzata</button>
    <h3>Hai un codice?</h3>
    <div class="row"><input id="cd" maxlength="10" placeholder="Codice invito"><button class="btn" data-a="code">Entra</button></div>
  </div>`,

  join: () => `<div class="page">
    <button class="ghost sm" data-a="back">← Indietro</button>
    <div class="hero"><div class="logo">🔗</div><h1>Sei stato invitato!</h1><p>Codice partita: <b>${esc(code)}</b></p></div>
    ${nameBox()}
    <div style="margin-top:14px">
      ${ui.err ? `<p class="err">${esc(ui.err)}</p>` : ''}
      ${ui.conn && !ui.err ? '<p class="wt">Connessione in corso…</p>' : `<button class="btn big" data-a="join">Entra in partita</button>`}
    </div>
  </div>`,

  lobby: () => {
    const c = cat();
    return `${netBanner()}<div class="top">
      <button class="ghost sm" data-a="back">←</button>
      <button class="top-cat ${host ? 'can-edit' : ''}" data-a="${host ? 'chcat' : ''}" title="${host ? 'Cambia categoria' : ''}">${c.e} ${esc(c.n)}${host ? ' ▾' : ''}</button>
      <span class="row"><button class="ghost sm" data-a="set">⚙️</button><button class="ghost sm" data-a="inv">🔗 Invita</button></span>
    </div>
    <div class="page">
      <div class="card" id="plr"></div>
      <h3>Modalità</h3><div class="card" id="mdr"></div>
      <h3>Il tuo segreto</h3><div id="sel"></div>
      <div class="row"><input id="q" placeholder="🔍 Cerca…" value="${esc(ui.q)}"><button class="ghost sm" data-a="sort">${ui.asc ? 'A→Z' : 'Z→A'}</button></div>
      <div id="gfr" style="margin-top:8px">${gbtn()}</div>
      <div id="list" class="list"></div>
      <details><summary>＋ Non c’è? Aggiungi il tuo</summary><div class="row"><input id="ce" class="emo" maxlength="4" placeholder="✨"><input id="cn" maxlength="50" placeholder="Nome"><button class="btn" data-a="custom">Ok</button></div></details>
    </div>
    <div class="bar" id="rdb"></div>`;
  },

  game: () => `${netBanner()}<div id="hd" class="top"></div>
    <div id="feed" class="feed"></div>
    <div id="act" class="act"></div>
    <div id="ty" class="ty"></div>
    <div class="chat">
      ${st.mode === 'b' ? '<button class="ghost sm" data-a="board" title="Lista candidati">📋</button>' : ''}
      <button class="ghost sm" data-a="notes" title="Appunti e Q&A">📝</button>
      <input id="cx" maxlength="${MAX_MSG}" placeholder="💬 Chat libera (non usa il turno)…">
      <button class="btn" data-a="chat">➤</button>
    </div>`,

  end: () => {
    const w = st.win;
    const mine = w === me;
    const [a, b] = st.order;
    const sw = serie();
    return `${netBanner()}<div class="page">
      <div class="hero">
        <div class="logo">${mine ? '🏆' : '😅'}</div>
        <h1>${mine ? 'Hai vinto!' : esc(pn(w)) + ' ha vinto!'}</h1>
        <p>Partita finita al round ${st.rd}</p>
        ${b ? `<p><b>${esc(pn(a))} ${wins(a)} – ${wins(b)} ${esc(pn(b))}</b></p>` : ''}
        ${sw ? `<p>🏅 Serie vinta da <b>${esc(pn(sw))}</b>!</p>` : ''}
      </div>
      <div class="card" style="display:flex;justify-content:space-around">${st.order.map(id => {
        const s = st.rv[id];
        return `<div class="rv"><small>Segreto di ${id === me ? 'te' : esc(pn(id))}</small><span class="big">${s ? s.e : '❔'}</span><b>${s ? esc(s.n) : '…'}</b></div>`;
      }).join('')}</div>
      <div style="margin-top:16px"><button class="btn big" data-a="again">${sw ? '🔁 Nuova serie' : '🔁 Rivincita'}</button></div>
      <div style="margin-top:10px"><button class="ghost" style="width:100%" data-a="back">🏠 Torna alla home</button></div>
    </div>`;
  }
};

function fillList(el, items, row) {
  if (el._off) el._off();
  let n = 60;
  let dead = 0;
  const io = new IntersectionObserver(es => {
    if (!dead && es.some(x => x.isIntersecting) && n < items.length) {
      n += 80;
      draw();
    }
  });
  function draw() {
    io.disconnect();
    el.innerHTML = items.slice(0, n).map(row).join('') + (items.length > n ? '<div class="sent"></div>' : '');
    const s = el.querySelector('.sent');
    if (s) io.observe(s);
  }
  draw();
  el._off = () => { dead = 1; io.disconnect(); };
}

function drawList() {
  const el = $('#list');
  if (!el) return;
  const q = norm(ui.q.trim());
  const c = cat();
  if (c.wait || c.loading) {
    el.innerHTML = '<p class="wt" style="padding:12px">⏳ Caricamento lista…</p>';
    return;
  }
  if (c.json && !c.loaded) {
    ensureCat(c);
    return;
  }
  view = lst(c).filter(i => (!q || i.s.includes(q)) && (!ui.g || i.g === ui.g));
  if (!ui.asc) view = view.slice().reverse();
  if (!view.length) {
    if (el._off) el._off();
    el.innerHTML = '<p class="wt" style="padding:12px">Nessun risultato: aggiungilo a mano qui sotto 👇</p>';
    return;
  }
  fillList(el, view, (i, x) => `<div class="it-wrap">
    <button class="it ${secret && secret.n === i.n ? 's' : ''}" data-a="pick" data-i="${x}"><span>${i.e}</span><b>${esc(i.n)}</b>${i.g ? `<small>${esc(i.g)}</small>` : ''}</button>
    <button class="info-btn" data-a="wiki" data-n="${esc(i.n)}" title="Info Wikipedia">ℹ️</button>
  </div>`);
}

function paintLobby() {
  const r = st.pl[me] && st.pl[me].r;
  const h = host ? '' : 'disabled';
  $('#plr').innerHTML = `<div class="pl">${[0, 1].map(i => {
    const id = st.order[i];
    return id
      ? `<div class="p"><span class="av">${esc(pn(id)[0] || '?').toUpperCase()}</span><b>${esc(pn(id))}${id === me ? ' (tu)' : ''}</b><i class="dot ${st.pl[id].r ? 'on' : ''}"></i></div>`
      : `<div class="p wait">⏳ In attesa dell’amico… codice <b>${esc(code)}</b></div>`;
  }).join('')}</div>`;
  $('#mdr').innerHTML = `<div class="row" style="flex-wrap:wrap">
      <button class="ghost sm ${st.mode !== 'b' ? 'on' : ''}" data-a="md" data-m="n" ${h}>🎯 Classica</button>
      <button class="ghost sm ${st.mode === 'b' ? 'on' : ''}" data-a="md" data-m="b" ${h}>📋 Con candidati</button>
    </div>
    <p style="font-size:13px">${st.mode === 'b' ? 'Puoi aprire la lista dei candidati e depennare i nomi (solo per te).' : 'Solo domande, tentativi e blocco appunti automatico.'}</p>
    <div class="row" style="flex-wrap:wrap;margin-top:6px"><small style="font-weight:800">Serie:</small>${[0, 3, 5].map(b => `<button class="ghost sm ${(st.bo || 0) === b ? 'on' : ''}" data-a="bo" data-b="${b}" ${h}>${b ? 'al meglio di ' + b : '∞ partite'}</button>`).join('')}</div>
    ${host ? '<p style="font-size:12px;margin-top:6px">Tocca il nome della categoria in alto per cambiarla senza uscire dalla stanza.</p>' : '<p style="font-size:13px">Le modalità e la categoria le sceglie chi ha creato la partita.</p>'}`;
  $('#sel').innerHTML = secret ? `<div class="card sel"><span class="big">${secret.e}</span><b>${esc(secret.n)}</b></div>` : '';
  $('#rdb').innerHTML = `<button class="btn big" data-a="ready" ${secret ? '' : 'disabled'}>${r ? 'Annulla: non sono pronto' : 'Sono pronto!'}</button>`;
  const q = $('#q');
  if (q) q.disabled = !!r;
}

function paintGame(full) {
  const myTurn = st.order[st.turn] === me;
  const p = st.pend;
  if (!myTurn || p) ui.dr = null;
  $('#hd').innerHTML = `<button class="ghost sm" data-a="back">←</button>
    <span class="pill">Round ${st.rd}${st.sc && Object.keys(st.sc).length ? ' · ' + wins(me) + '–' + wins(other()) : ''}</span>
    <b style="font-size:14px">${myTurn ? '🟢 Tocca a te' : '⏳ ' + esc(pn(st.order[st.turn]))}</b>
    <span class="pill" title="${secret ? esc(secret.n) : ''}">${secret ? secret.e + ' ' + esc(secret.n) : ''}</span>`;
  const cards = [];
  for (const l of st.log) {
    if (l.k === 'c') cards.push(l);
    else if (l.k === 'q' || l.k === 'g') cards.push({ ...l, a: null });
    else {
      const c = [...cards].reverse().find(x => (x.k === 'q' || x.k === 'g') && !x.a);
      if (c) c.a = l;
      else cards.push({ k: 'o', x: l.x });
    }
  }
  const fd = $('#feed');
  fd.innerHTML = cards.map(c => c.k === 'c'
    ? `<div class="b ${c.f === me ? 'me' : 'you'}"><small>${esc(who(c.f))}</small>${esc(c.x)}</div>`
    : c.k === 'o'
      ? `<div class="ev">${esc(c.x)}</div>`
      : `<div class="qa ${c.f === me ? 'me' : 'you'}"><div class="qq"><small>${esc(who(c.f))} · ${c.k === 'q' ? '❓ Domanda' : '🎯 Tentativo'}</small>${esc(c.x)}</div><div class="qr ${c.a ? (c.a.ok === true ? 'yes' : c.a.ok === false ? 'no' : 'rp') : 'pn'}">${c.a ? esc(c.a.x) : '⏳ In attesa della risposta…'}</div></div>`
  ).join('') || '<p class="wt" style="margin-top:20px">Nessun messaggio ancora. Buona fortuna! 🍀</p>';
  fd.scrollTop = fd.scrollHeight;

  const d = ui.dr;
  const key = [st.turn, p && p.x, p && p.k, ui.mode, myTurn, d && d.x].join('|');
  if (!full && key === lastAct) return;
  lastAct = key;

  let h;
  if (p && p.f !== me) {
    h = p.k === 'q'
      ? `<div><b>${esc(pn(p.f))}</b> chiede: “${esc(p.x)}”</div>
         <div class="row c"><button class="btn ok" data-a="qa" data-x="Sì">Sì</button><button class="btn no" data-a="qa" data-x="No">No</button><button class="ghost" data-a="qa" data-x="Forse">Forse</button></div>
         <div class="row"><input id="ax" maxlength="${MAX_MSG}" placeholder="…o rispondi a mano"><button class="btn" data-a="ans">➤</button></div>`
      : `<div><b>${esc(pn(p.f))}</b> prova a indovinare: <b>“${esc(p.x)}”</b><br>È il tuo segreto?</div>
         <div class="row c"><button class="btn ok" data-a="ga" data-v="1">Sì, hai indovinato!</button><button class="btn no" data-a="ga" data-v="0">No</button></div>`;
  } else if (p) {
    h = '<div class="wt">⏳ In attesa della risposta…</div>';
  } else if (myTurn && d) {
    h = `<div class="cf"><b>Controlla prima di inviare</b><div class="cfq">${d.k === 'q' ? '❓ Domanda' : '🎯 Tentativo'}: “${esc(d.x)}”</div><p>Questo usa il tuo turno. Se volevi solo scrivere in chat, annulla e usa la barra qui sotto.</p><div class="row"><button class="ghost" style="flex:1" data-a="edit">✏️ Modifica</button><button class="btn" style="flex:1" data-a="send">✅ Invia</button></div></div>`;
  } else if (myTurn) {
    h = `<div class="row c"><button class="ghost sm ${ui.mode === 'q' ? 'on' : ''}" data-a="mode" data-m="q">❓ Fai una domanda</button><button class="ghost sm ${ui.mode === 'g' ? 'on' : ''}" data-a="mode" data-m="g">🎯 Indovina</button></div>
         <div class="row"><input id="ix" maxlength="${MAX_MSG}" value="${esc(ui.dx || '')}" placeholder="${ui.mode === 'q' ? 'La tua domanda (usa il turno)…' : 'Cosa pensi sia? (usa il turno)…'}"><button class="btn" data-a="ask">Rivedi</button></div>`;
  } else {
    h = `<div class="wt">Tocca a ${esc(pn(st.order[st.turn]))}…</div>`;
  }
  $('#act').innerHTML = h;
}

function save() {
  try {
    if (st) {
      const t = CATS.find(c => c.tmp && c.k === st.cat);
      localStorage.setItem('ind', JSON.stringify({
        me, name, code, host, st, secret, cr: crossed, nt: notes,
        cu: t ? { k: t.k, n: t.n, e: t.e, i: t.raw[0] } : null
      }));
    }
  } catch (e) {}
}

function render() {
  save();
  const s = !st ? (code ? 'join' : 'home') : st.ph === 'lobby' ? 'lobby' : st.ph === 'play' ? 'game' : 'end';
  if (s === 'game' && app.dataset.s === 'game') { paintGame(false); return; }
  if (s === 'lobby' && app.dataset.s === 'lobby') { paintLobby(); return; }
  const keep = [...app.querySelectorAll('input[id]')].map(i => [i.id, i.value]);
  const fo = document.activeElement && document.activeElement.id;
  app.dataset.s = s;
  app.innerHTML = V[s]();
  keep.forEach(([id, v]) => {
    const e = document.getElementById(id);
    if (e && v && !e.value) e.value = v;
  });
  if (fo) {
    const e = document.getElementById(fo);
    if (e) e.focus();
  }
  if (s === 'lobby') { paintLobby(); drawList(); }
  if (s === 'game') paintGame(true);
  net();
}

function groupPicker(c, cur, cb) {
  const G = groups(c);
  const o = document.createElement('div');
  o.className = 'bd';
  o.style.zIndex = 20;
  o.innerHTML = `<div class="top"><button class="ghost sm" data-x="c">✕</button><b>🧩 ${esc(facet(c))}</b><span></span></div>
    <div class="row" style="padding:8px 14px"><input id="gq" placeholder="🔍 Cerca…"></div>
    <div id="gl" class="list" style="padding:6px 14px 24px;overflow:auto;flex:1"></div>`;
  document.body.appendChild(o);
  const gl = o.querySelector('#gl');
  let v = [];
  const draw = q => {
    const s = norm(q.trim());
    v = [['', lst(c).length]].concat(G.filter(g => !s || norm(g[0]).includes(s)));
    fillList(gl, v, (g, x) => `<button class="it ${g[0] === cur ? 's' : ''}" data-x="g" data-i="${x}"><span>${g[0] ? '🧩' : '📚'}</span><b>${esc(g[0] || 'Tutti')}</b><small>${g[1]}</small></button>`);
  };
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    const g = b.dataset.x === 'g' ? v[b.dataset.i][0] : null;
    if (gl._off) gl._off();
    o.remove();
    if (g !== null) cb(g);
  });
  o.addEventListener('input', e => { if (e.target.id === 'gq') draw(e.target.value); });
  draw('');
}

function customCat() {
  const o = document.createElement('div');
  o.className = 'ov';
  const mine = () => CATS.filter(c => c.custom);
  const store = () => {
    try { localStorage.setItem('ind-cc', JSON.stringify(mine().map(c => ({ k: c.k, n: c.n, e: c.e, i: c.raw[0] })))); } catch (e) {}
  };
  const draw = err => {
    o.innerHTML = `<div class="card">
      <b>📝 Nuova categoria</b>
      <div class="row" style="margin:10px 0"><input id="uce" class="emo" maxlength="4" placeholder="📝"><input id="ucn" maxlength="30" placeholder="Nome categoria"></div>
      <textarea id="ucl" rows="8" placeholder="Una voce per riga.&#10;Con emoji davanti: 🍕 Pizza&#10;Con gruppo per i filtri: Pizza | Cibo"></textarea>
      ${err ? `<p class="err">${esc(err)}</p>` : ''}
      <div class="row" style="margin-top:10px"><button class="ghost" style="flex:1" data-u="x">Chiudi</button><button class="btn" style="flex:1" data-u="ok">Crea</button></div>
      ${mine().length ? '<h3>Le tue categorie</h3>' + mine().map(c => `<div class="row" style="margin:4px 0"><span>${c.e}</span><b style="flex:1">${esc(c.n)}</b><small>${cnt(c)}</small><button class="ghost sm" data-u="del" data-k="${c.k}">🗑</button></div>`).join('') : ''}
    </div>`;
  };
  o.onclick = e => {
    const b = e.target.closest('[data-u]');
    if (!b) return;
    const d = b.dataset.u;
    if (d === 'x') { o.remove(); return; }
    if (d === 'del') {
      const i = CATS.findIndex(c => c.k === b.dataset.k);
      if (i >= 0) CATS.splice(i, 1);
      store();
      draw();
      render();
      return;
    }
    const n = ($('#ucn').value || '').trim().slice(0, 30);
    const em = ($('#uce').value || '').trim() || '📝';
    const lines = $('#ucl').value.split('\n').map(x => x.trim()).filter(Boolean);
    if (!n) return draw('Dai un nome alla categoria.');
    if (lines.length < 4) return draw('Servono almeno 4 voci.');
    if (lines.length > 800) return draw('Massimo 800 voci.');
    const it = lines.map(l => {
      let [a, g] = l.split('|').map(x => x.trim());
      const m = a.match(/^(\p{Extended_Pictographic}[\p{Extended_Pictographic}\u200d\ufe0f]*)\s+(.+)$/u);
      const nm = (m ? m[2] : a).replace(/;/g, ',').slice(0, 50);
      return (m ? m[1] : em) + ' ' + nm + (g ? '|' + g.replace(/;/g, ',').slice(0, 30) : '');
    });
    const raw = it.join(';');
    if (raw.length > 24000) return draw('Lista troppo lunga.');
    CATS.push({ k: 'u-' + Math.random().toString(36).slice(2, 7), n, e: em, raw: [raw], custom: 1 });
    store();
    o.remove();
    render();
    toast('Categoria creata!');
  };
  draw();
  document.body.appendChild(o);
}

async function board() {
  await ensureCat(cat());
  const L = lst(cat());
  let q = '';
  let only = false;
  let v = [];
  let gs = '';
  const o = document.createElement('div');
  o.className = 'bd';
  o.innerHTML = `<div class="top"><button class="ghost sm" data-x="c">✕</button><b>📋 Candidati</b><button class="ghost sm" data-x="f">Tutti</button></div>
    <div class="row" style="padding:8px 14px"><input id="bq" placeholder="🔍 Cerca…">${groups(cat()).length ? '<button class="ghost sm" data-x="g">🧩</button>' : ''}<button class="ghost sm" data-x="r">↺</button></div>
    <div id="bn" class="wt" style="padding:0 14px"></div>
    <div id="bl" class="list" style="padding:6px 14px 24px;overflow:auto;flex:1"></div>`;
  document.body.appendChild(o);
  const bl = o.querySelector('#bl');
  const bn = o.querySelector('#bn');
  const count = () => { bn.textContent = (L.length - Object.keys(crossed).length) + ' candidati rimasti su ' + L.length; };
  const draw = () => {
    const s = norm(q.trim());
    v = L.filter(i => (!s || i.s.includes(s)) && (!gs || i.g === gs) && (!only || !crossed[i.n]));
    fillList(bl, v, (i, x) => `<div class="it-wrap">
      <button class="it ${crossed[i.n] ? 'x' : ''}" data-x="t" data-i="${x}"><span>${i.e}</span><b>${esc(i.n)}</b></button>
      <button class="info-btn" data-x="w" data-n="${esc(i.n)}" title="Info Wikipedia">ℹ️</button>
    </div>`);
    count();
  };
  o.addEventListener('click', e => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    const k = b.dataset.x;
    if (k === 'c') { if (bl._off) bl._off(); o.remove(); }
    else if (k === 'f') { only = !only; b.textContent = only ? 'Rimasti' : 'Tutti'; draw(); }
    else if (k === 'g') groupPicker(cat(), gs, x => { gs = x; b.textContent = gs ? '🧩 ' + gs : '🧩'; draw(); });
    else if (k === 'r') ask('Rimettere tutti in gioco?', () => { crossed = {}; save(); draw(); }, null, 'Sì');
    else if (k === 'w') showWikiInfo(b.dataset.n);
    else if (k === 't') {
      const n = v[b.dataset.i].n;
      if (crossed[n]) delete crossed[n];
      else crossed[n] = 1;
      b.classList.toggle('x');
      save();
      count();
    }
  });
  o.addEventListener('input', e => { if (e.target.id === 'bq') { q = e.target.value; draw(); } });
  draw();
}

function ask(msg, yes, no, yl) {
  const o = document.createElement('div');
  o.className = 'ov';
  o.innerHTML = `<div class="card"><b>${msg}</b><div class="row" style="margin-top:12px"><button class="ghost" style="flex:1" data-n>Resta</button><button class="btn no" style="flex:1" data-y>${yl || 'Esci'}</button></div></div>`;
  o.onclick = e => {
    const y = e.target.closest('[data-y]');
    const n = e.target.closest('[data-n]');
    if (y || n) {
      o.remove();
      (y ? yes : (no || (() => {})))();
    }
  };
  document.body.appendChild(o);
}

function leave() {
  connSeq++;
  seenChat.clear();
  if (R) {
    send({ t: 'bye' });
    try { R.leave(); } catch (e) {}
  }
  R = null;
  st = null;
  secret = null;
  crossed = {};
  notes = '';
  code = '';
  host = false;
  synced = false;
  ui.conn = false;
  ui.err = '';
  ui.q = '';
  ui.g = '';
  ui.on = true;
  stopTitleFlash();
  for (let i = CATS.length; i--;) if (CATS[i].tmp) CATS.splice(i, 1);
  try { localStorage.removeItem('ind'); } catch (e) {}
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
  document.querySelectorAll('.bd,.ov').forEach(x => x.remove());
  render();
}

function back() {
  if (!st) { leave(); return; }
  ask(st.ph === 'end' ? 'Tornare alla home?' : 'Uscire dalla partita? L’altro giocatore verrà avvisato.', leave);
}

const val = id => {
  const e = document.getElementById(id);
  const v = e ? e.value.trim() : '';
  if (e) e.value = '';
  return v;
};

app.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const d = b.dataset;
  switch (d.a) {
    case 'new': newGame(d.k); break;
    case 'code': {
      const c = val('cd').toLowerCase();
      if (c) { code = c; location.hash = c; joinGame(); }
      break;
    }
    case 'join': joinGame(); break;
    case 'set': settings(); break;
    case 'cc': customCat(); break;
    case 'chcat': openCatSwitcher(); break;
    case 'wiki': showWikiInfo(d.n); break;
    case 'reconn':
      if (R) { R.reconnect(); resync(); toast('Riconnessione in corso…'); }
      else connect();
      break;
    case 'grp':
      groupPicker(cat(), ui.g, g => {
        ui.g = g;
        const bt = $('#gfr button');
        if (bt) bt.textContent = gtxt();
        drawList();
      });
      break;
    case 'pick':
      secret = { e: view[d.i].e, n: view[d.i].n };
      document.querySelectorAll('#list .it.s').forEach(x => x.classList.remove('s'));
      b.classList.add('s');
      paintLobby();
      save();
      break;
    case 'custom': {
      const n = val('cn');
      const em = val('ce');
      if (n) { secret = { e: em || '✨', n }; paintLobby(); save(); }
      break;
    }
    case 'sort':
      ui.asc = !ui.asc;
      drawList();
      b.textContent = ui.asc ? 'A→Z' : 'Z→A';
      break;
    case 'md': if (host) act({ t: 'md', m: d.m, bo: st.bo || 0 }); break;
    case 'bo': if (host) act({ t: 'md', m: st.mode || 'n', bo: +d.b }); break;
    case 'ready': if (secret) act({ t: 'rd', v: st.pl[me].r ? 0 : 1 }); break;
    case 'board': board(); break;
    case 'notes': openScratchpad(); break;
    case 'inv': {
      const u = location.href;
      try {
        if (navigator.share) await navigator.share({ title: 'Indovina!', text: 'Vieni a giocare con me! Codice: ' + code, url: u });
        else { await navigator.clipboard.writeText(u); toast('Link copiato!'); }
      } catch (x) { toast('Codice partita: ' + code); }
      break;
    }
    case 'mode': ui.dx = ($('#ix') || {}).value || ''; ui.mode = d.m; paintGame(true); break;
    case 'ask': {
      const el = $('#ix');
      const x = el ? el.value.trim() : '';
      if (x) { ui.dr = { k: ui.mode, x }; ui.dx = x; paintGame(true); }
      break;
    }
    case 'edit': ui.dr = null; paintGame(true); break;
    case 'send': {
      const dr = ui.dr;
      if (dr) { ui.dr = null; ui.dx = ''; act({ t: 'ask', k: dr.k, x: dr.x }); }
      break;
    }
    case 'qa': act({ t: 'ans', x: d.x }); break;
    case 'ans': { const x = val('ax'); if (x) act({ t: 'ans', x }); break; }
    case 'ga': act({ t: 'ans', x: d.v === '1' ? 'Sì, giusto! 🎉' : 'No', ok: d.v === '1' }); break;
    case 'chat': { const x = val('cx'); if (x) act({ t: 'c', x, id: me + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }); break; }
    case 'again': act({ t: 're', rs: serie() ? 1 : 0 }); break;
    case 'back': back(); break;
  }
});

app.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'q') { ui.q = e.target.value; drawList(); }
  if ((id === 'cx' || id === 'ix' || id === 'ax') && Date.now() - lastTy > 2000) {
    lastTy = Date.now();
    send({ t: 'ty' });
  }
});

app.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
  const m = { cx: 'chat', ix: 'ask', ax: 'ans', cd: 'code', nm: null, cn: 'custom' }[e.target.id];
  if (m) {
    const b = app.querySelector(`[data-a="${m}"]`);
    if (b) b.click();
  }
});

addEventListener('hashchange', () => {
  const c = location.hash.slice(1).toLowerCase();
  if (c && !st) { code = c; render(); }
  else if (!c && st) ask('Uscire dalla partita?', leave, () => { location.hash = code; });
  else if (!c && !st && code) { code = ''; ui.conn = false; render(); }
});

const vv = window.visualViewport;
const fit = () => {
  document.documentElement.style.setProperty('--vh', (vv ? vv.height : innerHeight) + 'px');
  const f = $('#feed');
  if (f && document.activeElement && document.activeElement.tagName === 'INPUT') f.scrollTop = f.scrollHeight;
};
if (vv) {
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', () => scrollTo(0, 0));
}
fit();

try {
  const s = JSON.parse(localStorage.getItem('ind') || 'null');
  if (s && s.st && (!code || code === s.code)) {
    ({ me, name, code, host, st, secret } = s);
    crossed = s.cr || {};
    notes = s.nt || '';
    if (s.cu) CATS.push({ k: s.cu.k, n: s.cu.n, e: s.cu.e, raw: [s.cu.i], tmp: 1 });
    synced = true;
    location.hash = code;
    connect();
  } else if (s && code && code !== s.code) {
    localStorage.removeItem('ind');
  }
} catch (e) {}

render();
loadIndex();
