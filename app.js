'use strict';
/* ClipForge — 브라우저 기반 영상 편집기 (Canvas + WebAudio + MediaRecorder) */

// ───────────── 유틸 ─────────────
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fmt = (t) => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0'); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k in e) e[k] = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2400); }

window.addEventListener('error', (e) => { try { const t0 = $('#toast'); t0.textContent = '오류: ' + e.message + (e.lineno ? ` (줄 ${e.lineno})` : ''); t0.classList.add('show'); setTimeout(() => t0.classList.remove('show'), 6000); } catch { } });
window.addEventListener('unhandledrejection', (e) => { try { const t0 = $('#toast'); t0.textContent = '오류: ' + (e.reason && e.reason.message || e.reason); t0.classList.add('show'); setTimeout(() => t0.classList.remove('show'), 6000); } catch { } });
// ───────────── 상수 ─────────────
const RATIOS = { '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1], '4:3': [4, 3], '3:4': [3, 4], '21:9': [21, 9] };
const DEF_FILTER = { brightness: 100, contrast: 100, saturate: 100, hue: 0, blur: 0, grayscale: 0, sepia: 0, invert: 0 };
const FILTER_PRESETS = {
  '원본': {}, '빈티지': { sepia: 45, contrast: 90, saturate: 80, brightness: 105 }, '흑백': { grayscale: 100, contrast: 112 },
  '따뜻한': { sepia: 22, saturate: 125, hue: -10, brightness: 105 }, '차가운': { hue: 18, saturate: 110, brightness: 100, contrast: 105 },
  '선명': { contrast: 125, saturate: 135 }, '페이드': { contrast: 82, brightness: 112, saturate: 80 }, '드라마틱': { contrast: 145, saturate: 90, brightness: 88 },
  '네온': { saturate: 190, contrast: 120, hue: 25 }, '네거티브': { invert: 100 }, '몽환': { blur: 2, brightness: 112, saturate: 120, contrast: 90 }, '세피아': { sepia: 100 },
};
const FX = [['vignette', '비네트'], ['grain', '필름 그레인'], ['glow', '글로우'], ['pixelate', '모자이크'], ['rgb', 'RGB 분리'], ['mirror', '거울'], ['shake', '흔들림']];
const LAYERFX = ['vignette', 'grain', 'glow', 'pixelate', 'rgb', 'mirror'];
const ANIMS = [['none', '없음'], ['fade', '페이드'], ['zoomIn', '줌인'], ['zoomOut', '줌아웃'], ['pop', '팝'], ['slideLeft', '왼쪽에서'], ['slideRight', '오른쪽에서'], ['slideUp', '아래에서'], ['slideDown', '위에서'], ['spin', '회전'], ['blur', '블러'], ['flip', '플립'], ['bounce', '바운스'], ['typewriter', '타자기(텍스트)']];
const TRANS = [['none', '없음'], ['fade', '디졸브'], ['wipeLeft', '와이프 →'], ['wipeRight', '와이프 ←'], ['wipeUp', '와이프 ↑'], ['wipeDown', '와이프 ↓'], ['slideLeft', '슬라이드 →'], ['slideRight', '슬라이드 ←'], ['slideUp', '슬라이드 ↑'], ['slideDown', '슬라이드 ↓'], ['zoomIn', '줌'], ['spin', '스핀'], ['blur', '블러'], ['flip', '플립']];
const MASKS = [['none', '없음'], ['circle', '원'], ['rounded', '둥근 사각형'], ['star', '별'], ['heart', '하트'], ['triangle', '삼각형'], ['hexagon', '육각형'], ['diamond', '마름모'], ['burst', '버스트']];
const FONTS = ['Noto Sans KR', 'Black Han Sans', 'Do Hyeon', 'Jua', 'Malgun Gothic', 'Apple SD Gothic Neo', 'Arial Black', 'Impact', 'Georgia', 'Courier New', 'Comic Sans MS', 'sans-serif', 'serif', 'monospace', 'cursive'];
const TEXT_PRESETS = [
  { n: '기본', t: {} },
  { n: '굵은 제목', t: { font: 'Black Han Sans', size: 100, strokeW: 4, stroke: '#000000' } },
  { n: '하단 자막', t: { size: 44, bold: false, bg: '#000000', bgAlpha: 60 }, y: 0.36 },
  { n: '노랑 자막', t: { color: '#ffe600', size: 54, strokeW: 3, shadow: 'drop' }, y: 0.36 },
  { n: '네온', t: { color: '#39f6ff', size: 84, shadow: 'glow', font: 'Do Hyeon' } },
  { n: '손글씨', t: { font: 'Jua', size: 80, color: '#fff7c2', shadow: 'drop' } },
  { n: '레트로', t: { font: 'Do Hyeon', size: 90, color: '#ff4fa3', strokeW: 5, stroke: '#2a0a4a', shadow: 'drop' } },
  { n: '라벨', t: { size: 48, color: '#111111', bg: '#ffffff', bgAlpha: 100, bold: true } },
];
const SHAPES = [['rect', '▭'], ['rounded', '▢'], ['circle', '●'], ['triangle', '▲'], ['star', '★'], ['heart', '♥'], ['arrow', '➡'], ['bubble', '🗨'], ['burst', '✸'], ['lightning', 'ϟ'], ['diamond', '◆'], ['hexagon', '⬢'], ['cross', '✚'], ['check', '✔'], ['ring', '◯']];
const LABELS = [['NEW', '#ff3b5c', '#ffffff'], ['HOT', '#ff8a00', '#ffffff'], ['SALE', '#ffe600', '#111111'], ['WOW!', '#8e2de2', '#ffffff'], ['LOL', '#00c2ff', '#ffffff'], ['구독', '#ff0000', '#ffffff'], ['좋아요', '#ff4fa3', '#ffffff'], ['꿀팁', '#2ecc71', '#ffffff'], ['주목!', '#111111', '#ffe600'], ['1등', '#d4af37', '#ffffff'], ['BEST', '#1f6feb', '#ffffff'], ['LIVE', '#e11d48', '#ffffff']];
const EMOJI_CATS = {
  '표정': '😀😃😄😁😆😅😂🤣😊😇🙂😉😍🥰😘😋😛😜🤪😎🤩🥳😏😒😔😢😭😤😠🤬😱😨😰😓🤔🤫🤭😴🤯🥶🥵🤢🤮😷🤒🤡👻💀👽🤖',
  '손·마음': '👍👎👏🙌🤝🙏💪✌️🤞👌🤙👋✋👆👇👈👉☝️✊👊❤️🧡💛💚💙💜🖤💔💕💖💯',
  '동물': '🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦄🐝🦋🐢🐙🐬🐳🦈',
  '음식': '🍎🍌🍇🍓🍑🍕🍔🍟🌭🍿🍩🍪🎂🍰🍫🍦☕🍺🍷🥤🍜🍣',
  '활동·사물': '⚽🏀🎮🎯🎬🎤🎧🎵🎶📷📱💻💡🔥✨⭐🌟💥💫🎉🎊🎁🏆👑💎🚀✈️🚗⏰📌📍',
  '자연': '☀️🌙☁️🌧️⚡❄️🌈🌸🌹🌻🍀🌴🌍💧',
  '기호': '✅❌⚠️❓❗💬💭➡️⬅️⬆️⬇️🔴🟠🟡🟢🔵🟣⭕🚫🔔',
};
const BG_SOURCES = [['#000000', '#000000'], ['#ffffff', '#ffffff'], ['#ff3b5c', '#ff9a3b'], ['#2b32b2', '#1488cc'], ['#11998e', '#38ef7d'], ['#8e2de2', '#4a00e0'], ['#f857a6', '#ff5858'], ['#232526', '#414345']];

// ───────────── 상태 ─────────────
const media = new Map();           // id -> {id,name,type,url,blob,dur,w,h,thumb,img,peaks}
let project = newProject();
let sel = null;                    // 선택된 클립 id
let t = 0, playing = false, lastNow = 0, exporting = null;
let pps = 70;                      // 타임라인 확대 (px/초)
let inspTab = 'basic';
let clipboard = null;
const els = new Map();             // clipId -> {el, gain}
const bboxes = new Map();          // clipId -> 마지막 렌더 박스
const missing = {};                // 불러온 프로젝트에서 없는 미디어 id -> 이름
let hist = [], hi = -1;
let selMedia = null;
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const HAS_FILTER = (() => {
  if (/nofilter=1/.test(location.search)) return false;
  try { const c = document.createElement('canvas'); c.width = c.height = 1; const g = c.getContext('2d'); g.filter = 'invert(1)'; g.fillStyle = '#000'; g.fillRect(0, 0, 1, 1); return g.getImageData(0, 0, 1, 1).data[0] > 200; } catch { return false; }
})();

function mkTrack(kind = 'video') { return { id: uid(), kind, clips: [], muted: false, hidden: false, locked: false }; }
function newProject() { return { name: '제목 없음', ratio: '16:9', res: 720, w: 1280, h: 720, bg: '#000000', fps: 30, videoVol: 100, audioVol: 100, tracks: [mkTrack(), mkTrack(), mkTrack('audio')], markers: [], mediaNames: {} }; }
function mkClip(type, o = {}) {
  return Object.assign({
    id: uid(), type, mediaId: null, start: 0, dur: 5, in: 0, speed: 1, volume: 100, fadeIn: 0, fadeOut: 0,
    x: 0, y: 0, scale: 100, rot: 0, opacity: 100, flipX: false, flipY: false,
    filter: { ...DEF_FILTER }, fx: [], chroma: { on: false, color: '#00ff00', tol: 35, soft: 12 }, mask: 'none', bgBlur: false,
    animIn: { type: 'none', dur: 0.5 }, animOut: { type: 'none', dur: 0.5 }, transIn: { type: 'none', dur: 0.6 }, kf: {}, fit: 'fit', mute: false, syncMs: 0, loop: false, sepOn: false, vVol: 100, mVol: 100,
  }, o);
}
const defText = () => ({ content: '텍스트를 입력하세요', font: 'Noto Sans KR', size: 64, bold: true, italic: false, color: '#ffffff', stroke: '#000000', strokeW: 0, shadow: 'none', bg: '#000000', bgAlpha: 0, align: 'center' });
const allClips = () => project.tracks.flatMap(tr => tr.clips);
const findClip = (id) => { for (const tr of project.tracks) { const c = tr.clips.find(c => c.id === id); if (c) return c; } return null; };
const trackOf = (c) => project.tracks.find(tr => tr.clips.includes(c));
const total = () => allClips().reduce((m, c) => Math.max(m, c.start + c.dur), 0);
const kindOf = (c) => c.type === 'audio' ? 'audio' : 'video';
const selClip = () => sel ? findClip(sel) : null;
const trackMutedFor = (c) => { const tr = trackOf(c); return !!(tr && tr.muted); };
const clipLabel = (c) => c.text ? c.text.content.split('\n')[0] : c.type === 'shape' ? '도형' : (media.get(c.mediaId)?.name || '(미디어 없음)');

// ───────────── 히스토리 / 저장 ─────────────
function snapshot() { return JSON.stringify(project); }
function pushHist() { hist = hist.slice(0, hi + 1); hist.push(snapshot()); if (hist.length > 100) hist.shift(); hi = hist.length - 1; }
let saveTimer;
function autosave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem('clipforge:project', snapshot()); } catch { } }, 400); }
function commit() { pushHist(); autosave(); if (project.ratio === 'original') resizeCanvas(); renderTimeline(); if (playing) scheduleAudio(); }
function undo() { if (hi > 0) { hi--; project = JSON.parse(hist[hi]); afterRestore(); } }
function redo() { if (hi < hist.length - 1) { hi++; project = JSON.parse(hist[hi]); afterRestore(); } }
function afterRestore() { if (sel && !findClip(sel)) sel = null; syncTopbar(); resizeCanvas(); refresh(); autosave(); }
function refresh() { renderTimeline(); buildInspector(); }

// ───────────── 오디오 엔진 ─────────────
let actx, master, streamDest;
function ensureAudio() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); streamDest = actx.createMediaStreamDestination();
    master.connect(actx.destination); master.connect(streamDest);
    master.gain.value = $('#mvol').value / 100;
  }
  if (actx.state === 'suspended') actx.resume();
  if (!actx._unlocked) { actx._unlocked = true; try { const b = actx.createBuffer(1, 1, 22050), z = actx.createBufferSource(); z.buffer = b; z.connect(actx.destination); z.start(0); } catch { } }
}
for (const ev of ['pointerdown', 'touchend', 'click']) document.addEventListener(ev, ensureAudio, { capture: true });

const vpool = $('#vpool');
function getEl(c) {
  let o = els.get(c.id);
  const m = media.get(c.mediaId); if (!m) return null;
  if (!o) {
    const el = document.createElement(m.type === 'audio' ? 'audio' : 'video');
    el.src = m.url; el.preload = 'auto'; el.playsInline = true; el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', '');
    if (m.abuf) el.muted = true;
    if (m.type === 'video') vpool.append(el);
    o = { el, gain: null }; els.set(c.id, o);
  }
  if (m.abuf) { if (!o.el.muted) o.el.muted = true; }
  else if (!o.gain && actx && !IS_IOS) {
    try { const src = actx.createMediaElementSource(o.el); o.gain = actx.createGain(); src.connect(o.gain); o.gain.connect(master); } catch { }
  }
  return o;
}
function pruneEls() { const ids = new Set(allClips().map(c => c.id)); for (const [id, o] of els) if (!ids.has(id)) { o.el.pause(); o.el.removeAttribute('src'); o.el.load(); o.el.remove(); els.delete(id); bboxes.delete(id); } }

// 오디오는 디코딩된 AudioBuffer 를 WebAudio 로 직접 재생 (iOS 호환, 싱크/반복/분리 음원 지원)
let playNodes = [];
function clipGain(c, tr, tt) {
  if (tr.muted || c.mute) return 0;
  const rel = tt - c.start; let g = (c.volume / 100) * ((c.type === 'audio' ? project.audioVol : project.videoVol) / 100);
  if (c.fadeIn > 0) g *= clamp(rel / c.fadeIn, 0, 1);
  if (c.fadeOut > 0) g *= clamp((c.dur - rel) / c.fadeOut, 0, 1);
  return g;
}
function stopAudioNodes() { for (const n of playNodes) { try { n.src.stop(); } catch { } try { n.src.disconnect(); n.gain.disconnect(); } catch { } } playNodes = []; }
function scheduleAudio() {
  stopAudioNodes(); if (!actx || !playing) return;
  const now = actx.currentTime;
  for (const tr of project.tracks) for (const c of tr.clips) {
    if (c.type !== 'video' && c.type !== 'audio') continue;
    const m = media.get(c.mediaId); if (!m || !m.abuf) continue;
    const end = c.start + c.dur; if (end <= t) continue;
    const stems = c.sepOn && m.sep ? [[m.sep.v, 'v'], [m.sep.m, 'm']] : [[m.abuf, 'o']];
    const sync = (c.syncMs || 0) / 1000, sp = clamp(c.speed, 0.25, 4), loop = c.loop && c.type === 'audio';
    for (const [buf, k] of stems) {
      const tl = Math.max(c.start, t), pre = Math.max(0, c.start - t);
      let off = c.in + (tl - c.start - sync) * sp, extra = 0;
      if (off < 0) { extra = -off / sp; off = 0; }
      if (loop) { const span = buf.duration - c.in; if (span > 0.05 && off >= buf.duration) off = c.in + ((off - c.in) % span); }
      else if (off >= buf.duration) continue;
      const remain = end - tl - extra; if (remain <= 0) continue;
      const src = actx.createBufferSource(); src.buffer = buf; src.playbackRate.value = sp;
      if (loop) { src.loop = true; src.loopStart = c.in; src.loopEnd = buf.duration; }
      const g = actx.createGain(); g.gain.value = 0; src.connect(g); g.connect(master);
      try { src.start(now + pre + extra, off, remain * sp); } catch { continue; }
      playNodes.push({ src, gain: g, c, tr, k });
    }
  }
}

function syncMedia() {
  for (const n of playNodes) { const sv = n.k === 'v' ? n.c.vVol : n.k === 'm' ? n.c.mVol : 100; n.gain.gain.value = clipGain(n.c, n.tr, t) * sv / 100; }
  for (const tr of project.tracks) for (const c of tr.clips) {
    if (c.type !== 'video' && c.type !== 'audio') continue;
    const m0 = media.get(c.mediaId); if (c.type === 'audio' && m0 && m0.abuf) continue;
    const act = t >= c.start && t < c.start + c.dur;
    const near = playing && !act && c.start > t && c.start - t < 0.7;
    if (!act && !near) { const o = els.get(c.id); if (o && !o.el.paused) o.el.pause(); continue; }
    const o = getEl(c); if (!o) continue;
    const el = o.el, m = media.get(c.mediaId);
    const maxT = Math.max(0, (m.dur || 1e9) - 0.04);
    const target = clamp(c.in + (clamp(t, c.start, c.start + c.dur) - c.start) * c.speed, 0, maxT);
    const rate = clamp(c.speed, 0.0625, 16);
    if (el.playbackRate !== rate) el.playbackRate = rate;
    if (near) { if (!el.paused) el.pause(); if (Math.abs(el.currentTime - c.in) > 0.05 && !el.seeking) el.currentTime = c.in; continue; }
    if (playing) {
      if (Math.abs(el.currentTime - target) > 0.3 && !el.seeking) el.currentTime = target;
      if (el.paused) el.play().catch(() => { });
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - target) > 0.02 && !el.seeking) el.currentTime = target;
    }
    if (!m.abuf) { const g = clipGain(c, tr, t); el.muted = g <= 0.001; if (o.gain) o.gain.gain.value = g; else el.volume = clamp(g, 0, 1); }
  }
}
function pauseAllEls() { for (const o of els.values()) if (!o.el.paused) o.el.pause(); }


// ───────────── 미디어 가져오기 ─────────────
const idbP = new Promise((res, rej) => { try { const r = indexedDB.open('clipforge', 2); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('media')) d.createObjectStore('media', { keyPath: 'id' }); if (!d.objectStoreNames.contains('sep')) d.createObjectStore('sep', { keyPath: 'fp' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
const idbPut = async (rec) => { try { (await idbP).transaction('media', 'readwrite').objectStore('media').put(rec); } catch { } };
const idbDel = async (id) => { try { (await idbP).transaction('media', 'readwrite').objectStore('media').delete(id); } catch { } };
const idbPutSep = async (rec) => { try { (await idbP).transaction('sep', 'readwrite').objectStore('sep').put(rec); } catch { } };
const idbDelSep = async (fp) => { try { (await idbP).transaction('sep', 'readwrite').objectStore('sep').delete(fp); } catch { } };
const idbGetSep = async (fp) => { try { const db = await idbP; return await new Promise(res => { const q = db.transaction('sep').objectStore('sep').get(fp); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch { return null; } };
const idbAll = async () => { try { const db = await idbP; return await new Promise(res => { const q = db.transaction('media').objectStore('media').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => res([]); }); } catch { return []; } };

let persistPref = (() => { try { return localStorage.getItem('clipforge:persist') === '1'; } catch { return false; } })();
async function addMedia(file, { id, name, durOverride, persist = persistPref } = {}) {
  const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'image' : file.type.startsWith('audio') ? 'audio' : null;
  if (!type) { toast('지원하지 않는 형식: ' + file.name); return null; }
  name = name || file.name;
  if (!id) id = Object.keys(missing).find(k => missing[k] === name) || uid();
  delete missing[id];
  const url = URL.createObjectURL(file);
  const m = { id, name, type, url, blob: file, dur: 5, w: 0, h: 0, thumb: '', peaks: null, fp: name + '|' + file.size, abuf: null, sep: null };
  try {
    if (type === 'image') {
      const img = new Image(); img.src = url; await img.decode();
      m.img = img; m.w = img.naturalWidth; m.h = img.naturalHeight; m.thumb = url;
    } else {
      const el = document.createElement(type); el.preload = 'metadata'; el.muted = true; el.src = url;
      await new Promise((r, j) => { el.onloadedmetadata = r; el.onerror = () => j(new Error('decode')); });
      m.dur = durOverride || (isFinite(el.duration) ? el.duration : 10);
      if (type === 'video') { m.w = el.videoWidth; m.h = el.videoHeight; m.thumb = await grabThumb(el, m.dur); if (m.thumb) { m.thumbImg = new Image(); m.thumbImg.src = m.thumb; } }
    }
  } catch (e) { toast('불러오지 못했습니다: ' + name); URL.revokeObjectURL(url); return null; }
  media.set(id, m); project.mediaNames[id] = name;
  if (persist) idbPut({ id, name, type, blob: file, dur: m.dur });
  renderMedia(); loadAudio(m);
  return m;
}
const frameCache = new Map();
function snapFrame(c, src, m) {
  const now = performance.now(); let fc = frameCache.get(c.id);
  if (!fc) { fc = document.createElement('canvas'); fc._t = 0; fc._mt = 0; frameCache.set(c.id, fc); }
  if (now - fc._t > (playing ? 700 : 150)) {
    const w = Math.min(480, m.w), hh = Math.max(1, Math.round(w * m.h / m.w)); if (fc.width !== w || fc.height !== hh) { fc.width = w; fc.height = hh; }
    try { fc.getContext('2d').drawImage(src, 0, 0, w, hh); fc._t = now; fc._mt = src.currentTime; } catch { }
  }
}
function fallbackFrame(c, m) {
  const fc = frameCache.get(c.id), want = c.in + (clamp(t, c.start, c.start + c.dur) - c.start) * c.speed;
  if (fc && fc.width > 1 && Math.abs(fc._mt - want) < 2) return fc;
  return m.thumbImg && m.thumbImg.complete && m.thumbImg.naturalWidth ? m.thumbImg : (fc && fc.width > 1 ? fc : null);
}
function prewarm() {   // 곧 나올 영상을 미리 첫 프레임으로 맞춰 둬서 '화면이 안 나오는' 현상을 줄인다
  for (const tr of project.tracks) for (const c of tr.clips) {
    if (c.type !== 'video') continue;
    const d = c.start - t; if (d < -0.1 || d > 4 || (t >= c.start && t < c.start + c.dur)) continue;
    const o = getEl(c); if (!o) continue; const el = o.el;
    if (!el.paused) el.pause(); if (!el.seeking && Math.abs(el.currentTime - c.in) > 0.05) el.currentTime = c.in;
  }
}
function gcEls() {      // iOS 는 동시에 많은 video 를 못 다루므로 멀리 있는 것은 해제
  if (els.size <= 4) return;
  for (const [id, o] of [...els]) { const c = findClip(id); if (!c || c.type !== 'video') continue; if (c.start - t > 12 || t - (c.start + c.dur) > 12) { o.el.pause(); o.el.removeAttribute('src'); o.el.load(); o.el.remove(); els.delete(id); } }
}
let frameNo = 0;
async function grabThumb(el, dur) {
  try {
    el.currentTime = Math.min(0.5, dur / 2);
    await new Promise(r => { el.onseeked = r; setTimeout(r, 1500); });
    const c = document.createElement('canvas'); c.width = 192; c.height = Math.max(1, Math.round(192 * el.videoHeight / el.videoWidth));
    const g = c.getContext('2d'); g.drawImage(el, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.6);
  } catch { return ''; }
}
const AUDIO_LIMIT = () => (IS_IOS ? 40e6 : 250e6);
async function loadAudio(m, force = false) {
  if (m.type === 'image') return;
  if (!force && m.blob.size > AUDIO_LIMIT()) return;
  if (m.blob.size > 400e6) return;
  try {
    const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 1, 44100);
    const ab = await m.blob.arrayBuffer();
    const buf = await new Promise((res, rej) => { const p = ac.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
    m.abuf = buf;
    const per = 50, n = Math.ceil(buf.duration * per), d = buf.getChannelData(0), step = Math.floor(d.length / n) || 1, p = new Float32Array(n);
    for (let i = 0; i < n; i++) { let mx = 0; for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j += 8) mx = Math.max(mx, Math.abs(d[j])); p[i] = mx; }
    m.peaks = p; renderTimeline(); loadSep(m); buildInspector();
  } catch { }
}

let mediaFilter = 'all';
function renderMedia() {
  const g = $('#mediaGrid'); g.innerHTML = '';
  $$('#mediaTabs button').forEach(b => b.classList.toggle('on', b.dataset.f === mediaFilter));
  for (const m of media.values()) {
    if (mediaFilter !== 'all' && m.type !== mediaFilter) continue;
    const it = h('div', { class: 'mitem', draggable: true, title: m.name },
      h('div', { class: 'th', style: m.thumb ? `background-image:url(${m.thumb})` : '' }, m.thumb ? '' : (m.type === 'audio' ? '🎵' : '🖼')),
      h('div', { class: 'nm' }, m.name),
      m.type !== 'image' ? h('div', { class: 'dur' }, fmt(m.dur).slice(0, 5)) : null,
      h('button', { class: 'add', title: '타임라인에 추가', onclick: (e) => { e.stopPropagation(); addMediaToTimeline(m.id); } }, '+'),
      h('button', { class: 'rm', title: '삭제', onclick: (e) => { e.stopPropagation(); removeMedia(m.id); } }, '×'));
    it.addEventListener('click', () => { selMedia = m.id; $$('.mitem').forEach(x => x.classList.remove('sel')); it.classList.add('sel'); });
    if (m.id === selMedia) it.classList.add('sel');
    it.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/x-media', m.id));
    it.addEventListener('dblclick', () => addMediaToTimeline(m.id));
    g.append(it);
  }
}
const RATIO_LABELS = [['original', '원본'], ['16:9', '16:9 가로'], ['9:16', '9:16 세로(릴스·쇼츠)'], ['1:1', '1:1 정사각'], ['4:3', '4:3'], ['3:4', '3:4'], ['21:9', '21:9 와이드']];
const FIT_LABELS = [['fill', '화면 채우기 (꽉 차게, 넘치는 부분은 잘림)'], ['fit', '전체 보기 (전체가 보이게, 여백 생김)'], ['blur', '전체 보기 + 블러 배경']];
let dlgState = { ratio: '16:9', fit: 'fill' };
function askRatio(hasVideo) {
  return new Promise((resolve) => {
    const dlg = $('#ratioDlg'), empty = !allClips().some(c => c.type === 'video' || c.type === 'image');
    dlgState.ratio = empty ? 'original' : project.ratio;
    const draw = () => {
      const rc = $('#ratioChips'), fc = $('#fitChips'); rc.innerHTML = ''; fc.innerHTML = '';
      for (const [v, n] of RATIO_LABELS) rc.append(h('button', { class: 'chip' + (dlgState.ratio === v ? ' on' : ''), onclick: () => { dlgState.ratio = v; draw(); } }, n));
      for (const [v, n] of FIT_LABELS) fc.append(h('button', { class: 'chip' + (dlgState.fit === v ? ' on' : ''), onclick: () => { dlgState.fit = v; draw(); } }, n));
    };
    draw();
    $('#dlgNote').textContent = empty ? '' : '※ 이미 편집 중인 프로젝트는 전체 화면 비율이 함께 바뀝니다.';
    $('#noAudioRow').style.display = hasVideo ? '' : 'none'; $('#noAudio').checked = false; $('#autoAdd').checked = true; $('#persistMedia').checked = persistPref;
    dlg.hidden = false;
    const done = (ok) => { dlg.hidden = true; $('#ratioOk').onclick = $('#ratioCancel').onclick = null; resolve(ok ? { ...dlgState, noAudio: $('#noAudio').checked && hasVideo, autoAdd: $('#autoAdd').checked, persist: $('#persistMedia').checked } : null); };
    $('#ratioOk').onclick = () => done(true); $('#ratioCancel').onclick = () => done(false);
  });
}
async function importFiles(files) {
  files = [...files]; if (!files.length) return;
  const hasVisual = files.some(f => /^(video|image)\//.test(f.type)), hasVideo = files.some(f => /^video\//.test(f.type));
  let opt = null;
  if (hasVisual) {
    opt = await askRatio(hasVideo); if (!opt) return;
    if (project.ratio !== opt.ratio) { project.ratio = opt.ratio; syncTopbar(); resizeCanvas(); }
  }
  if (opt) { persistPref = opt.persist; try { localStorage.setItem('clipforge:persist', persistPref ? '1' : '0'); } catch { } }
  let n = 0; const t0 = performance.now();
  for (const f of files) {
    toast(`불러오는 중 ${++n}/${files.length} · ${f.name}`);
    const m = await addMedia(f); if (!m) continue;
    if (opt && (m.type === 'video' || m.type === 'image')) {
      m.fit = opt.fit === 'fill' ? 'fill' : 'fit'; m.bgBlur = opt.fit === 'blur'; m.muteOnAdd = opt.noAudio && m.type === 'video';
      if (opt.autoAdd) addMediaToTimeline(m.id);
    } else if (m.type === 'audio' && !opt) { /* 오디오는 목록에만 추가 */ }
  }
  if (opt) commit();
  toast(`${files.length}개 불러오기 완료 (${((performance.now() - t0) / 1000).toFixed(1)}초)${persistPref ? '' : ' · 임시 사용 중 (앱을 닫으면 사라집니다)'}`);
}
function toggleMute() {
  const c = selClip(); if (!c || (c.type !== 'video' && c.type !== 'audio')) return toast('비디오/오디오 클립을 먼저 선택하세요');
  c.mute = !c.mute; commit(); buildInspector(); toast(c.mute ? '이 클립의 소리를 껐습니다 (화면만 사용)' : '소리를 다시 켰습니다');
}
function cleanUnused() {
  const used = new Set(allClips().map(c => c.mediaId)), un = [...media.keys()].filter(id => !used.has(id));
  if (!un.length) return toast('미사용 미디어가 없습니다');
  if (!confirm(`미사용 미디어 ${un.length}개를 목록에서 제거할까요?\n(기기에 있는 원본 파일은 삭제되지 않습니다)`)) return;
  for (const id of un) { const m = media.get(id); URL.revokeObjectURL(m.url); media.delete(id); idbDel(id); }
  if (un.includes(selMedia)) selMedia = null; renderMedia(); toast(`${un.length}개 정리됨`);
}
function removeMedia(id) {
  const used = allClips().filter(c => c.mediaId === id);
  if (used.length && !confirm(`타임라인에서 ${used.length}개 클립이 사용 중입니다. 함께 삭제할까요?`)) return;
  for (const tr of project.tracks) tr.clips = tr.clips.filter(c => c.mediaId !== id);
  const m = media.get(id); if (m) URL.revokeObjectURL(m.url);
  media.delete(id); idbDel(id); if (selMedia === id) selMedia = null; pruneEls(); renderMedia(); commit(); buildInspector(); toast('프로젝트에서 제거했습니다 (원본 파일은 그대로)');
}

// ───────────── 클립 배치 ─────────────
function trackFree(tr, start, dur, ignoreId) { return !tr.clips.some(o => o.id !== ignoreId && o.start < start + dur - 1e-6 && o.start + o.dur > start + 1e-6); }
function placeClip(c, { track = null, overlay = false } = {}) {
  const kind = kindOf(c); let tr = track;
  if (!tr) {
    const cands = project.tracks.filter(x => x.kind === kind && !x.locked);
    const main = !overlay && (c.type === 'video' || c.type === 'image' || c.type === 'audio');
    tr = (main ? cands.slice().reverse() : cands).find(x => trackFree(x, c.start, c.dur));
  }
  if (!tr) { tr = mkTrack(kind); if (kind === 'video') project.tracks.unshift(tr); else project.tracks.push(tr); }
  tr.clips.push(c); tr.clips.sort((a, b) => a.start - b.start);
  return tr;
}
function addMediaToTimeline(mid, { start = null, track = null } = {}) {
  const m = media.get(mid); if (!m) return;
  const c = mkClip(m.type, { mediaId: mid, dur: m.type === 'image' ? 5 : m.dur });
  if (m.type === 'video' || m.type === 'image') { if (m.fit) c.fit = m.fit; if (m.bgBlur) c.bgBlur = true; }
  if (m.muteOnAdd) c.mute = true;
  if (start == null) {
    if (m.type === 'audio') start = t;
    else { const main = project.tracks.filter(x => x.kind === 'video' && !x.locked).slice(-1)[0]; start = main && main.clips.length ? Math.max(...main.clips.map(o => o.start + o.dur)) : 0; if (main && !main.clips.length) track = track || main; }
  }
  c.start = Math.max(0, start);
  if (track && !trackFree(track, c.start, c.dur)) track = null;
  placeClip(c, { track }); sel = c.id; inspTab = inspTabsFor(c)[0];
  commit(); buildInspector();
  if (!exporting) { if (t > total()) t = 0; }
}
function addText(preset = TEXT_PRESETS[0]) {
  const c = mkClip('text', { start: t, dur: 3, text: { ...defText(), ...preset.t } });
  if (preset.y) c.y = preset.y;
  placeClip(c); sel = c.id; inspTab = 'text'; commit(); buildInspector();
}
function addSticker(emoji) {
  const c = mkClip('sticker', { start: t, dur: 3, animIn: { type: 'pop', dur: 0.4 }, text: { ...defText(), content: emoji, size: 160, bold: false } });
  placeClip(c); sel = c.id; inspTab = 'basic'; commit(); buildInspector();
}
function addShape(type) {
  const c = mkClip('shape', { start: t, dur: 3, animIn: { type: 'pop', dur: 0.4 }, shape: { type, color: '#ff3b5c', stroke: '#ffffff', strokeW: 0 } });
  placeClip(c); sel = c.id; inspTab = 'text'; commit(); buildInspector();
}

function addLabel([txt, bg, fg]) {
  const c = mkClip('sticker', { start: t, dur: 3, animIn: { type: 'pop', dur: 0.4 }, text: { ...defText(), content: txt, font: 'Black Han Sans', size: 64, bold: false, color: fg, bg, bgAlpha: 100 } });
  placeClip(c); sel = c.id; inspTab = 'text'; commit(); buildInspector();
}
async function addCustomSticker(files) {
  for (const f of files) {
    const m = await addMedia(f); if (!m) continue; if (m.type !== 'image') { toast('스티커는 이미지 파일(PNG 권장)만 가능합니다'); continue; }
    const c = mkClip('image', { mediaId: m.id, start: t, dur: 3, scale: 40, animIn: { type: 'pop', dur: 0.4 } });
    placeClip(c, { overlay: true }); sel = c.id; inspTab = 'basic'; commit(); buildInspector();
  }
}
let emojiCat = Object.keys(EMOJI_CATS)[0];
function renderEmoji() {
  const cats = $('#emojiCats'), grid = $('#emojiGrid'); cats.innerHTML = ''; grid.innerHTML = '';
  for (const k of Object.keys(EMOJI_CATS)) cats.append(h('button', { class: 'chip' + (k === emojiCat ? ' on' : ''), onclick: () => { emojiCat = k; renderEmoji(); } }, k));
  for (const em of EMOJI_CATS[emojiCat].match(/\p{Extended_Pictographic}(\uFE0F)?/gu) || []) grid.append(h('div', { class: 'tile', onclick: () => addSticker(em) }, em));
}
// ───────────── 편집 명령 ─────────────
function targetClip() {
  const s = selClip(); if (s) return s;
  for (const tr of project.tracks) { const c = tr.clips.find(c => t > c.start && t < c.start + c.dur); if (c) return c; }
  return null;
}
function splitClip(c = targetClip(), at = t) {
  if (!c || at <= c.start + 0.03 || at >= c.start + c.dur - 0.03) { if (!c) toast('분할할 클립이 없습니다'); return null; }
  const tr = trackOf(c), rel = at - c.start;
  const b = JSON.parse(JSON.stringify(c)); b.id = uid();
  b.start = at; b.dur = c.dur - rel; b.in = c.in + rel * c.speed;
  b.transIn = { type: 'none', dur: 0.6 }; b.fadeIn = 0; b.animIn = { type: 'none', dur: 0.5 };
  for (const k of Object.keys(c.kf || {})) b.kf[k] = c.kf[k].map(p => ({ t: p.t - rel, v: p.v }));
  c.dur = rel; c.fadeOut = 0; c.animOut = { type: 'none', dur: 0.5 };
  tr.clips.push(b); tr.clips.sort((x, y) => x.start - y.start);
  sel = b.id; commit(); buildInspector(); return b;
}
// ── 재생 구간 지정 (원본은 그대로, 보이는 구간만 바꿈) ──
const isSrcClip = (c) => c.type === 'video' || c.type === 'audio';
function shiftKf(c, d) { for (const k of Object.keys(c.kf || {})) c.kf[k] = c.kf[k].map(p => ({ t: p.t + d, v: p.v })); }
function trimTarget() {
  const c = targetClip(); if (!c) { toast('먼저 클립을 선택하세요'); return null; }
  if (trackOf(c).locked) { toast('잠긴 트랙입니다'); return null; }
  sel = c.id; return c;
}
function trimFromHere() {            // 여기부터: 빨간 선 앞부분은 재생하지 않음
  const c = trimTarget(); if (!c) return;
  if (t <= c.start + 0.05 || t >= c.start + c.dur - 0.1) return toast('빨간 선을 클립 안쪽에 두고 눌러 주세요');
  const d = t - c.start; if (isSrcClip(c)) c.in += d * c.speed;
  c.start = t; c.dur -= d; shiftKf(c, -d); commit(); buildInspector(); toast(`${fmt(isSrcClip(c) ? c.in : t)} 부터 재생`);
}
function trimToHere() {              // 여기까지: 빨간 선 뒷부분은 재생하지 않음
  const c = trimTarget(); if (!c) return;
  if (t <= c.start + 0.1 || t >= c.start + c.dur - 0.05) return toast('빨간 선을 클립 안쪽에 두고 눌러 주세요');
  c.dur = t - c.start; commit(); buildInspector(); toast(`${fmt(t)} 까지만 재생`);
}
function trimToStart() {             // 처음부터: 잘라 둔 앞부분을 원래대로
  const c = trimTarget(); if (!c) return;
  if (!isSrcClip(c)) return toast('이 클립은 원본 구간이 없습니다');
  if (c.in < 0.01) return toast('이미 처음부터 재생됩니다');
  const tr = trackOf(c), prevEnd = tr.clips.filter(x => x !== c && x.start + x.dur <= c.start + 1e-6).reduce((m, x) => Math.max(m, x.start + x.dur), 0);
  const ns = Math.max(prevEnd, c.start - c.in / c.speed), back = c.start - ns;
  if (back < 0.01) return toast('앞 클립에 막혀 더 되돌릴 수 없습니다');
  c.in = Math.max(0, c.in - back * c.speed); if (c.in < 0.01) c.in = 0;
  c.start = ns; c.dur += back; shiftKf(c, back); commit(); buildInspector();
  toast(c.in === 0 ? '처음부터 재생' : '앞 클립까지만 복원했습니다 (일부)');
}
function trimToEnd() {               // 끝까지: 잘라 둔 뒷부분을 원래대로
  const c = trimTarget(); if (!c) return;
  if (!isSrcClip(c)) return toast('이 클립은 원본 구간이 없습니다');
  const m = media.get(c.mediaId); if (!m) return;
  const tr = trackOf(c), next = tr.clips.filter(x => x !== c && x.start >= c.start + c.dur - 1e-6).reduce((mn, x) => Math.min(mn, x.start), Infinity);
  const full = (m.dur - c.in) / c.speed, nd = Math.min(full, next - c.start);
  if (nd <= c.dur + 0.01) return toast(full <= c.dur + 0.01 ? '이미 끝까지 재생됩니다' : '뒤 클립에 막혀 더 늘릴 수 없습니다');
  c.dur = nd; commit(); buildInspector(); toast(nd >= full - 0.01 ? '끝까지 재생' : '뒤 클립까지만 복원했습니다 (일부)');
}
function deleteClip(ripple = false) {
  const c = selClip(); if (!c) return;
  const tr = trackOf(c); tr.clips = tr.clips.filter(x => x !== c);
  if (ripple) for (const o of tr.clips) if (o.start >= c.start) o.start = Math.max(0, o.start - c.dur);
  sel = null; pruneEls(); commit(); buildInspector();
}
function dupClip() {
  const c = selClip(); if (!c) return;
  const b = JSON.parse(JSON.stringify(c)); b.id = uid(); b.start = c.start + c.dur;
  placeClip(b, { track: trackFree(trackOf(c), b.start, b.dur) ? trackOf(c) : null }); sel = b.id; commit(); buildInspector();
}
async function freezeFrame() {
  const c = selClip();
  if (!c || (c.type !== 'video' && c.type !== 'image') || t <= c.start || t >= c.start + c.dur) return toast('비디오 클립을 선택하고 클립 안에 재생 헤드를 두세요');
  const m = media.get(c.mediaId), o = getEl(c);
  const cvs = document.createElement('canvas'); cvs.width = m.w; cvs.height = m.h;
  cvs.getContext('2d').drawImage(c.type === 'image' ? m.img : o.el, 0, 0, m.w, m.h);
  const blob = await new Promise(r => cvs.toBlob(r, 'image/png'));
  const fm = await addMedia(new File([blob], `정지 ${fmt(t - c.start)}.png`, { type: 'image/png' })); if (!fm) return;
  const FZ = 3, tr = trackOf(c);
  const b = splitClip(c, t); if (!b) return;
  for (const o2 of tr.clips) if (o2.start >= t) o2.start += FZ;
  const fc = mkClip('image', { mediaId: fm.id, start: t, dur: FZ });
  for (const k of ['x', 'y', 'scale', 'rot', 'opacity', 'flipX', 'flipY', 'mask', 'bgBlur']) fc[k] = c[k];
  fc.filter = { ...c.filter }; fc.fx = [...c.fx];
  tr.clips.push(fc); tr.clips.sort((x, y) => x.start - y.start); sel = fc.id; commit(); buildInspector();
}
function addTrack(kind) { const tr = mkTrack(kind); if (kind === 'video') project.tracks.unshift(tr); else project.tracks.push(tr); commit(); }
function addMarker() { project.markers.push(+t.toFixed(3)); project.markers.sort((a, b) => a - b); commit(); }

// ───────────── 키프레임 ─────────────
const KF_PROPS = ['x', 'y', 'scale', 'rot', 'opacity'];
function prop(c, k, rel) {
  const pts = c.kf && c.kf[k];
  if (!pts || !pts.length) return c[k];
  if (rel <= pts[0].t) return pts[0].v;
  for (let i = 1; i < pts.length; i++) if (rel < pts[i].t) { const a = pts[i - 1], b = pts[i]; return lerp(a.v, b.v, (rel - a.t) / (b.t - a.t)); }
  return pts[pts.length - 1].v;
}
function setProp(c, k, v) {
  if (c.kf[k] && c.kf[k].length) {
    const rel = +(t - c.start).toFixed(3), pts = c.kf[k], p = pts.find(p => Math.abs(p.t - rel) < 0.04);
    if (p) p.v = v; else { pts.push({ t: rel, v }); pts.sort((a, b) => a.t - b.t); }
  } else c[k] = v;
}
function toggleKf(c, k) {
  const rel = +(t - c.start).toFixed(3); c.kf[k] = c.kf[k] || [];
  const i = c.kf[k].findIndex(p => Math.abs(p.t - rel) < 0.04);
  if (i >= 0) { c.kf[k].splice(i, 1); if (!c.kf[k].length) c[k] = prop({ ...c, kf: {} }, k, 0); }
  else { const v = prop(c, k, rel); c.kf[k].push({ t: rel, v }); c.kf[k].sort((a, b) => a.t - b.t); }
}

// ───────────── 렌더링 ─────────────
const cv = $('#cv'), ctx = cv.getContext('2d');
const layer = document.createElement('canvas'), lctx = layer.getContext('2d', { willReadFrequently: true });
const tmpC = document.createElement('canvas'), tctx = tmpC.getContext('2d');
const noiseC = document.createElement('canvas'); noiseC.width = noiseC.height = 200;
{ const g = noiseC.getContext('2d'), d = g.createImageData(200, 200); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }

function resizeCanvas() {
  let rw, rh;
  if (project.ratio === 'original') {
    const c = allClips().filter(c => c.type === 'video' || c.type === 'image').sort((a, b) => a.start - b.start)[0], m = c && media.get(c.mediaId);
    [rw, rh] = m && m.w ? [m.w, m.h] : [16, 9];
  } else [rw, rh] = RATIOS[project.ratio] || [16, 9];
  const s = project.res; let w, hh;
  if (rw >= rh) { hh = s; w = Math.round(s * rw / rh / 2) * 2; } else { w = s; hh = Math.round(s * rh / rw / 2) * 2; }
  w = clamp(w, 2, 4096); hh = clamp(hh, 2, 4096);
  $('#sizeLbl').textContent = `${w}×${hh}px`;
  if (w === cv.width && hh === cv.height && layer.width === w && layer.height === hh && tmpC.width === w) { project.w = w; project.h = hh; fitStage(); return; }
  project.w = w; project.h = hh; cv.width = layer.width = tmpC.width = w; cv.height = layer.height = tmpC.height = hh;
  fitStage();
}
function fitStage() {
  const st = $('#stage'), pad = 24, k = Math.min((st.clientWidth - pad) / cv.width, (st.clientHeight - pad) / cv.height);
  cv.style.width = cv.width * k + 'px'; cv.style.height = cv.height * k + 'px';
}
window.addEventListener('resize', fitStage);

const easeOut = (p) => 1 - Math.pow(1 - p, 3);
function applyAnim(type, p, m) {
  p = clamp(p, 0, 1); const e = easeOut(p), q = 1 - e;
  switch (type) {
    case 'fade': m.a *= p; break;
    case 'zoomIn': m.s *= lerp(0.3, 1, e); m.a *= p; break;
    case 'zoomOut': m.s *= lerp(1.8, 1, e); m.a *= p; break;
    case 'pop': m.s *= e * (1 + Math.sin(p * Math.PI) * 0.15); m.a *= Math.min(1, p * 3); break;
    case 'slideLeft': m.x -= q * 0.6; break;
    case 'slideRight': m.x += q * 0.6; break;
    case 'slideUp': m.y += q * 0.6; break;
    case 'slideDown': m.y -= q * 0.6; break;
    case 'spin': m.r -= q * 180; m.s *= lerp(0.2, 1, e); m.a *= p; break;
    case 'blur': m.blur += q * 30; m.a *= Math.min(1, p * 2); break;
    case 'flip': m.sx *= Math.max(0.02, e); break;
    case 'bounce': m.y -= Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) * 0.2; m.a *= Math.min(1, p * 4); break;
    case 'typewriter': m.chars = Math.min(m.chars, p); break;
    case 'wipeLeft': m.wipe = { d: 'l', p }; break;
    case 'wipeRight': m.wipe = { d: 'r', p }; break;
    case 'wipeUp': m.wipe = { d: 'u', p }; break;
    case 'wipeDown': m.wipe = { d: 'd', p }; break;
  }
}
function wipeClip(g, w, W, H) {
  const p = w.p; g.beginPath();
  if (w.d === 'l') g.rect(0, 0, W * p, H); else if (w.d === 'r') g.rect(W * (1 - p), 0, W * p, H);
  else if (w.d === 'u') g.rect(0, H * (1 - p), W, H * p); else g.rect(0, 0, W, H * p);
  g.clip();
}
const poly = (p, w, h, pts) => { pts.forEach(([x, y], i) => p[i ? 'lineTo' : 'moveTo'](x * w, y * h)); p.closePath(); };
function shapePath(type, w, h) {
  const p = new Path2D();
  switch (type) {
    case 'circle': p.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); break;
    case 'rounded': p.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.18); break;
    case 'triangle': p.moveTo(0, -h / 2); p.lineTo(w / 2, h / 2); p.lineTo(-w / 2, h / 2); p.closePath(); break;
    case 'star': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.22 : 0.5; p[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * w * 1.05, Math.sin(a) * r * h * 1.05); } p.closePath(); break;
    case 'heart': p.moveTo(0, h * 0.42); p.bezierCurveTo(-w * 0.72, -h * 0.05, -w * 0.36, -h * 0.6, 0, -h * 0.2); p.bezierCurveTo(w * 0.36, -h * 0.6, w * 0.72, -h * 0.05, 0, h * 0.42); p.closePath(); break;
    case 'arrow': poly(p, w, h, [[-.5, -.2], [.05, -.2], [.05, -.5], [.5, 0], [.05, .5], [.05, .2], [-.5, .2]]); break;
    case 'bubble': p.roundRect(-w / 2, -h / 2, w, h * 0.72, Math.min(w, h) * 0.16); poly(p, w, h, [[-.3, .2], [0, .2], [-.4, .5]]); break;
    case 'burst': { const pts = []; for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? 0.37 : 0.5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } poly(p, w, h, pts); break; }
    case 'lightning': poly(p, w, h, [[.1, -.5], [-.3, .05], [-.02, .05], [-.1, .5], [.3, -.1], [.02, -.1]]); break;
    case 'diamond': poly(p, w, h, [[0, -.5], [.5, 0], [0, .5], [-.5, 0]]); break;
    case 'hexagon': poly(p, w, h, [0, 1, 2, 3, 4, 5].map(i => [Math.cos(i * Math.PI / 3) * .5, Math.sin(i * Math.PI / 3) * .5])); break;
    case 'cross': poly(p, w, h, [[-.17, -.5], [.17, -.5], [.17, -.17], [.5, -.17], [.5, .17], [.17, .17], [.17, .5], [-.17, .5], [-.17, .17], [-.5, .17], [-.5, -.17], [-.17, -.17]]); break;
    case 'check': poly(p, w, h, [[-.5, .05], [-.35, -.1], [-.12, .13], [.38, -.4], [.5, -.25], [-.12, .42]]); break;
    case 'ring': p.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); p.ellipse(0, 0, w * 0.32, h * 0.32, 0, 0, Math.PI * 2, true); break;
    default: p.rect(-w / 2, -h / 2, w, h);
  }
  return p;
}
function filterStr(f, extraBlur, S) {
  const a = [];
  if (f.brightness !== 100) a.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) a.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== 100) a.push(`saturate(${f.saturate}%)`);
  if (f.hue) a.push(`hue-rotate(${f.hue}deg)`);
  if (f.grayscale) a.push(`grayscale(${f.grayscale}%)`);
  if (f.sepia) a.push(`sepia(${f.sepia}%)`);
  if (f.invert) a.push(`invert(${f.invert}%)`);
  const bl = (f.blur + extraBlur) * S; if (bl > 0.05) a.push(`blur(${bl}px)`);
  return a.length ? a.join(' ') : 'none';
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ── iOS Safari 등 ctx.filter 미지원 환경용 소프트웨어 필터 ──
const blurC = document.createElement('canvas'), bctx = blurC.getContext('2d');
const isDefaultFilter = (f) => Object.keys(DEF_FILTER).every(k => f[k] === DEF_FILTER[k]);
function composeFilter(f) {
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1], O = [0, 0, 0];
  const app = (A, b) => {
    const N = new Array(9), NO = [0, 0, 0];
    for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) N[r * 3 + c] = A[r * 3] * M[c] + A[r * 3 + 1] * M[3 + c] + A[r * 3 + 2] * M[6 + c]; NO[r] = A[r * 3] * O[0] + A[r * 3 + 1] * O[1] + A[r * 3 + 2] * O[2] + b[r]; }
    M = N; O = NO;
  };
  const b = f.brightness / 100; app([b, 0, 0, 0, b, 0, 0, 0, b], [0, 0, 0]);
  const ct = f.contrast / 100; app([ct, 0, 0, 0, ct, 0, 0, 0, ct], [0.5 * (1 - ct), 0.5 * (1 - ct), 0.5 * (1 - ct)]);
  const s = f.saturate / 100; app([.213 + .787 * s, .715 - .715 * s, .072 - .072 * s, .213 - .213 * s, .715 + .285 * s, .072 - .072 * s, .213 - .213 * s, .715 - .715 * s, .072 + .928 * s], [0, 0, 0]);
  const th = f.hue * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
  app([.213 + cs * .787 - sn * .213, .715 - cs * .715 - sn * .715, .072 - cs * .072 + sn * .928, .213 - cs * .213 + sn * .143, .715 + cs * .285 + sn * .140, .072 - cs * .072 - sn * .283, .213 - cs * .213 - sn * .787, .715 - cs * .715 + sn * .715, .072 + cs * .928 + sn * .072], [0, 0, 0]);
  const g = 1 - f.grayscale / 100; app([.2126 + .7874 * g, .7152 - .7152 * g, .0722 - .0722 * g, .2126 - .2126 * g, .7152 + .2848 * g, .0722 - .0722 * g, .2126 - .2126 * g, .7152 - .7152 * g, .0722 + .9278 * g], [0, 0, 0]);
  const se = 1 - f.sepia / 100; app([.393 + .607 * se, .769 - .769 * se, .189 - .189 * se, .349 - .349 * se, .686 + .314 * se, .168 - .168 * se, .272 - .272 * se, .534 - .534 * se, .131 + .869 * se], [0, 0, 0]);
  const iv = f.invert / 100; app([1 - 2 * iv, 0, 0, 0, 1 - 2 * iv, 0, 0, 0, 1 - 2 * iv], [iv, iv, iv]);
  return { M, O };
}
function colorPass(f, W, H) {
  if (isDefaultFilter({ ...f, blur: 0 })) return;
  const { M, O } = composeFilter(f), img = lctx.getImageData(0, 0, W, H), d = img.data;
  const o0 = O[0] * 255, o1 = O[1] * 255, o2 = O[2] * 255;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i] = M[0] * r + M[1] * g + M[2] * b + o0; d[i + 1] = M[3] * r + M[4] * g + M[5] * b + o1; d[i + 2] = M[6] * r + M[7] * g + M[8] * b + o2;
  }
  lctx.putImageData(img, 0, 0);
}
function softBlurDraw(g, src, dx, dy, dw, dh, px, sw, sh) {
  const k = clamp(Math.round(px * 1.2), 1, 48), w = Math.max(2, Math.ceil(dw / k)), h2 = Math.max(2, Math.ceil(dh / k));
  blurC.width = w; blurC.height = h2; bctx.clearRect(0, 0, w, h2); bctx.drawImage(src, 0, 0, sw || src.width, sh || src.height, 0, 0, w, h2);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(blurC, 0, 0, w, h2, dx, dy, dw, dh);
}
function blurLayer(px, W, H) {
  tctx.clearRect(0, 0, W, H); tctx.drawImage(layer, 0, 0);
  lctx.clearRect(0, 0, W, H); softBlurDraw(lctx, tmpC, 0, 0, W, H, px, W, H);
}

function sourceOf(c) {
  const m = media.get(c.mediaId); if (!m) return null;
  if (c.type === 'image') return m.img;
  const o = getEl(c); return o && o.el.readyState >= 1 ? o.el : null;
}
function drawText(g, c, S, mod) {
  const T = c.text, px = T.size * S;
  g.font = `${T.italic ? 'italic ' : ''}${T.bold ? 'bold ' : ''}${px}px "${T.font}", sans-serif`;
  g.textBaseline = 'middle';
  let lines = T.content.split('\n');
  if (mod.chars < 1) { let n = Math.floor(lines.join('\n').length * mod.chars), out = []; for (const l of lines) { out.push(l.slice(0, Math.max(0, n))); n -= l.length + 1; } lines = out; }
  const full = T.content.split('\n');
  const wMax = Math.max(1, ...full.map(l => g.measureText(l).width)), lh = px * 1.25, tH = lh * full.length;
  const ax = T.align === 'left' ? -wMax / 2 : T.align === 'right' ? wMax / 2 : 0;
  g.textAlign = T.align;
  if (T.bgAlpha > 0) { g.fillStyle = rgba(T.bg, T.bgAlpha / 100); g.beginPath(); g.roundRect(-wMax / 2 - px * 0.4, -tH / 2 - px * 0.15, wMax + px * 0.8, tH + px * 0.3, px * 0.25); g.fill(); }
  lines.forEach((l, i) => {
    const yy = -tH / 2 + lh * (i + 0.5);
    g.save();
    if (T.shadow === 'drop') { g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = px * 0.12; g.shadowOffsetY = px * 0.06; }
    if (T.shadow === 'glow') { g.shadowColor = T.color; g.shadowBlur = px * 0.45; }
    if (T.strokeW > 0) { g.lineWidth = T.strokeW * S * 2; g.strokeStyle = T.stroke; g.lineJoin = 'round'; g.strokeText(l, ax, yy); }
    g.fillStyle = T.color; g.fillText(l, ax, yy);
    if (T.shadow === 'glow') g.fillText(l, ax, yy);
    g.restore();
  });
  return [wMax + px * 0.8, tH + px * 0.3];
}
function drawContent(g, c, W, H, S, mod) {
  if (c.type === 'video' || c.type === 'image') {
    let src = sourceOf(c); const m = media.get(c.mediaId); if (!m || !m.w) return [0, 0];
    if (c.type === 'video') { if (src && src.readyState >= 2 && !src.seeking) snapFrame(c, src, m); else src = fallbackFrame(c, m); }
    const f = (c.fit === 'fill' ? Math.max : Math.min)(W / m.w, H / m.h), dw = m.w * f, dh = m.h * f;
    g.save();
    if (c.mask !== 'none') g.clip(shapePath(c.mask, dw, dh));
    if (src) { try { g.drawImage(src, -dw / 2, -dh / 2, dw, dh); } catch { } }
    g.restore();
    return [dw, dh];
  }
  if (c.type === 'shape') {
    const b = Math.min(W, H) * 0.35, p = shapePath(c.shape.type, b, b);
    g.fillStyle = c.shape.color; g.fill(p);
    if (c.shape.strokeW > 0) { g.lineWidth = c.shape.strokeW * S; g.strokeStyle = c.shape.stroke; g.stroke(p); }
    return [b, b];
  }
  if (c.text) return drawText(g, c, S, mod);
  return [0, 0];
}
function postFX(c, tt, W, H, S, softF) {
  if (softF) { colorPass(softF.f, W, H); if (softF.blur > 0.5) blurLayer(softF.blur, W, H); }
  if (c.chroma.on) {
    const img = lctx.getImageData(0, 0, W, H), d = img.data, n = parseInt(c.chroma.color.slice(1), 16);
    const kr = n >> 16, kg = (n >> 8) & 255, kb = n & 255, tol = c.chroma.tol * 4.4, soft = Math.max(1, c.chroma.soft * 4.4);
    for (let i = 0; i < d.length; i += 4) {
      const dr = d[i] - kr, dg = d[i + 1] - kg, db = d[i + 2] - kb, dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < tol) d[i + 3] = 0; else if (dist < tol + soft) d[i + 3] *= (dist - tol) / soft;
    }
    lctx.putImageData(img, 0, 0);
  }
  for (const fx of c.fx) {
    if (fx === 'pixelate') {
      const n = Math.max(2, 14 * S), tw = Math.ceil(W / n), th = Math.ceil(H / n);
      tctx.clearRect(0, 0, W, H); tctx.drawImage(layer, 0, 0, tw, th);
      lctx.clearRect(0, 0, W, H); lctx.imageSmoothingEnabled = false; lctx.drawImage(tmpC, 0, 0, tw, th, 0, 0, W, H); lctx.imageSmoothingEnabled = true;
    } else if (fx === 'rgb') {
      const img = lctx.getImageData(0, 0, W, H), src = new Uint8ClampedArray(img.data), d = img.data, off = Math.round(8 * S) * 4;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const xr = Math.min(W - 1, x + Math.round(off / 4)), xb = Math.max(0, x - Math.round(off / 4)); d[i] = src[(y * W + xr) * 4]; d[i + 2] = src[(y * W + xb) * 4 + 2]; d[i + 3] = Math.max(src[i + 3], src[(y * W + xr) * 4 + 3], src[(y * W + xb) * 4 + 3]); }
      lctx.putImageData(img, 0, 0);
    } else if (fx === 'mirror') {
      tctx.clearRect(0, 0, W, H); tctx.drawImage(layer, 0, 0);
      lctx.save(); lctx.translate(W, 0); lctx.scale(-1, 1); lctx.drawImage(tmpC, 0, 0, W / 2, H, 0, 0, W / 2, H); lctx.restore();
    } else if (fx === 'vignette') {
      lctx.save(); lctx.globalCompositeOperation = 'source-atop';
      const gr = lctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.5);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.8)'); lctx.fillStyle = gr; lctx.fillRect(0, 0, W, H); lctx.restore();
    } else if (fx === 'grain') {
      lctx.save(); lctx.globalCompositeOperation = 'source-atop'; lctx.globalAlpha = 0.18; lctx.translate(Math.random() * 200, Math.random() * 200);
      lctx.fillStyle = lctx.createPattern(noiseC, 'repeat'); lctx.fillRect(-200, -200, W + 200, H + 200); lctx.restore();
    } else if (fx === 'glow') {
      tctx.clearRect(0, 0, W, H); tctx.drawImage(layer, 0, 0);
      lctx.save(); lctx.globalCompositeOperation = 'lighter'; lctx.globalAlpha = 0.55; if (HAS_FILTER) { lctx.filter = `blur(${14 * S}px)`; lctx.drawImage(tmpC, 0, 0); } else softBlurDraw(lctx, tmpC, 0, 0, W, H, 14 * S, W, H); lctx.restore();
    }
  }
}
function visibleItems(tt) {
  const out = [];
  for (let i = project.tracks.length - 1; i >= 0; i--) {
    const tr = project.tracks[i]; if (tr.hidden || tr.kind !== 'video') continue;
    const c = tr.clips.find(c => tt >= c.start && tt < c.start + c.dur); if (!c) continue;
    if (c.transIn.type !== 'none' && tt < c.start + c.transIn.dur) {
      const p = tr.clips.find(q => q !== c && Math.abs(q.start + q.dur - c.start) < 1e-3);
      if (p) out.push({ c: p, ghost: true });
    }
    out.push({ c });
  }
  return out;
}
function drawClip(c, tt, ghost) {
  const W = cv.width, H = cv.height, S = Math.min(W, H) / 720, rel = tt - c.start;
  let x = prop(c, 'x', rel) * W, y = prop(c, 'y', rel) * H, s = prop(c, 'scale', rel) / 100, r = prop(c, 'rot', rel), a = prop(c, 'opacity', rel) / 100;
  const mod = { x: 0, y: 0, s: 1, r: 0, a: 1, blur: 0, wipe: null, sx: 1, chars: 1 };
  if (!ghost) {
    if (c.animIn.type !== 'none' && rel < c.animIn.dur) applyAnim(c.animIn.type, rel / c.animIn.dur, mod);
    const left = c.dur - rel; if (c.animOut.type !== 'none' && left < c.animOut.dur) applyAnim(c.animOut.type, left / c.animOut.dur, mod);
    if (c.transIn.type !== 'none' && rel < c.transIn.dur) applyAnim(c.transIn.type, rel / c.transIn.dur, mod);
  }
  if (c.fx.includes('shake')) { x += Math.sin(tt * 53) * W * 0.006; y += Math.cos(tt * 61) * H * 0.006; r += Math.sin(tt * 37) * 0.6; }
  x += mod.x * W; y += mod.y * H; s *= mod.s; r += mod.r; a *= mod.a;
  if (a <= 0.001) return;
  const soft = !HAS_FILTER && (!isDefaultFilter(c.filter) || mod.blur > 0.05), needLayer = soft || c.chroma.on || c.fx.some(f => LAYERFX.includes(f)), g = needLayer ? lctx : ctx;
  if (needLayer) lctx.clearRect(0, 0, W, H);
  g.save();
  if (!needLayer) { g.globalAlpha = Math.min(1, a); if (mod.wipe) wipeClip(g, mod.wipe, W, H); }
  if (c.bgBlur && (c.type === 'video' || c.type === 'image')) {
    const src = sourceOf(c), m = media.get(c.mediaId);
    if (src && m.w) { const f = Math.max(W / m.w, H / m.h) * 1.15; g.save(); try { if (HAS_FILTER) { g.filter = `blur(${30 * S}px) brightness(.7)`; g.drawImage(src, (W - m.w * f) / 2, (H - m.h * f) / 2, m.w * f, m.h * f); } else { softBlurDraw(g, src, (W - m.w * f) / 2, (H - m.h * f) / 2, m.w * f, m.h * f, 30 * S, m.w, m.h); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 0, W, H); } } catch { } g.restore(); }
  }
  if (HAS_FILTER) g.filter = filterStr(c.filter, mod.blur, S);
  g.translate(W / 2 + x, H / 2 + y); g.rotate(r * Math.PI / 180); g.scale(s * mod.sx * (c.flipX ? -1 : 1), s * (c.flipY ? -1 : 1));
  const [bw, bh] = drawContent(g, c, W, H, S, mod);
  g.restore();
  bboxes.set(c.id, { cx: W / 2 + x, cy: H / 2 + y, w: bw * s, h: bh * s, rot: r });
  if (needLayer) {
    postFX(c, tt, W, H, S, soft ? { f: c.filter, blur: (c.filter.blur + mod.blur) * S } : null);
    ctx.save(); ctx.globalAlpha = Math.min(1, a); if (mod.wipe) wipeClip(ctx, mod.wipe, W, H); ctx.drawImage(layer, 0, 0); ctx.restore();
  }
}
function drawFrame() {
  ctx.fillStyle = project.bg; ctx.fillRect(0, 0, cv.width, cv.height);
  for (const it of visibleItems(t)) drawClip(it.c, it.ghost ? it.c.start + it.c.dur - 0.001 : t, it.ghost);
}

// ───────────── 재생 루프 ─────────────
function play() { if (!total()) return toast('타임라인이 비어 있습니다'); ensureAudio(); if (t >= total() - 0.02) t = 0; playing = true; lastNow = performance.now(); $('#bPlay').textContent = '⏸'; if (actx.state === 'running') scheduleAudio(); else actx.resume().then(() => { if (playing) scheduleAudio(); }); }
function pause() { playing = false; stopAudioNodes(); $('#bPlay').textContent = '▶'; pauseAllEls(); buildInspectorValuesIfKf(); }
function seek(x) { t = clamp(x, 0, Math.max(total(), 0)); if (playing) scheduleAudio(); }
function tick() {
  const now = performance.now();
  if (playing) {
    t += (now - lastNow) / 1000; lastNow = now;
    if (t >= total()) {
      if (exporting) { t = total(); finishExport(); }
      else if ($('#loop').checked) { t = 0; scheduleAudio(); }
      else { t = total(); pause(); }
    }
  }
  syncMedia(); drawFrame(); updateUI();
  if (++frameNo % 15 === 0) { prewarm(); if (frameNo % 60 === 0) gcEls(); }
  requestAnimationFrame(tick);
}
function updateUI() {
  $('#timeLbl').textContent = `${fmt(t)} / ${fmt(total())}`;
  const HW = headW(), ph = $('.playhead'); if (ph) ph.style.left = (HW + t * pps) + 'px';
  const wrap = $('#tlwrap');
  if (playing && !exporting) { const px = HW + t * pps; if (px > wrap.scrollLeft + wrap.clientWidth - 40 || px < wrap.scrollLeft + HW) wrap.scrollLeft = px - 200; }
  const sb = $('#sbox'), c = selClip(), bb = c && bboxes.get(c.id);
  const vis = c && bb && t >= c.start && t < c.start + c.dur && !exporting && bb.w > 0;
  if (vis) {
    const k = cv.clientWidth / cv.width;
    Object.assign(sb.style, { display: 'block', left: (bb.cx - bb.w / 2) * k + 'px', top: (bb.cy - bb.h / 2) * k + 'px', width: bb.w * k + 'px', height: bb.h * k + 'px', transform: `rotate(${bb.rot}deg)` });
  } else sb.style.display = 'none';
  if (exporting) { $('#ovBar').style.width = (100 * t / Math.max(total(), 0.01)) + '%'; $('#ovInfo').textContent = `${fmt(t)} / ${fmt(total())} — 탭을 전환하지 마세요`; }
}

// ───────────── 타임라인 렌더 ─────────────
const headW = () => { const c = document.querySelector('.corner'); return c && c.offsetWidth ? c.offsetWidth : 130; };
function renderTimeline() {
  const wrap = $('#tlwrap'), inner = $('#tlinner');
  const lanePx = Math.max(total() + 12, wrap.clientWidth / pps) * pps + 100;
  let step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find(s => s * pps >= 80) || 300;
  let ticks = '';
  for (let s = 0; s * pps < lanePx; s += step) {
    ticks += `<div class="tick" style="left:${s * pps}px">${fmt(s).slice(0, step < 1 ? 8 : 5)}</div>`;
    ticks += `<div class="tick minor" style="left:${(s + step / 2) * pps}px"></div>`;
  }
  const markers = project.markers.map((m, i) => `<div class="marker" data-mi="${i}" style="left:${m * pps}px" title="더블클릭하여 삭제">⚑</div>`).join('');
  let html = `<div class="ruler-row"><div class="corner"></div><div class="ruler" style="width:${lanePx}px">${ticks}${markers}</div></div>`;
  let vi = 0, ai = 0;
  const vcount = project.tracks.filter(x => x.kind === 'video').length;
  project.tracks.forEach((tr, ti) => {
    const nm = tr.kind === 'video' ? `비디오 ${vcount - vi++}` : `오디오 ${++ai}`, hgt = tr.kind === 'video' ? 56 : 44;
    html += `<div class="track-row ${tr.locked ? 'locked' : ''}" data-ti="${ti}" style="height:${hgt}px"><div class="thead"><span>${nm}</span><div class="btns">
      <button data-act="mute" class="${tr.muted ? 'on' : ''}" title="음소거">🔇</button>
      ${tr.kind === 'video' ? `<button data-act="hide" class="${tr.hidden ? 'on' : ''}" title="숨기기">👁</button>` : ''}
      <button data-act="lock" class="${tr.locked ? 'on' : ''}" title="잠금">🔒</button>
      <button data-act="rm" title="트랙 삭제">✕</button></div></div>
      <div class="lane" data-ti="${ti}" style="width:${lanePx}px">`;
    for (const c of tr.clips) {
      const m = media.get(c.mediaId), left = c.start * pps, w = Math.max(4, c.dur * pps);
      const bg = m && m.thumb && c.type !== 'audio' ? `<div class="bgimg" style="background-image:url(${m.thumb})"></div>` : '';
      const tags = [(c.mute || trackMutedFor(c)) && (c.type === 'video' || c.type === 'audio') ? '🔇' : '', c.speed !== 1 ? `${c.speed}x` : '', c.animIn.type !== 'none' || c.animOut.type !== 'none' ? '✦' : '', c.fx.length || c.filter.brightness !== 100 ? 'fx' : '', Object.keys(c.kf).some(k => c.kf[k].length) ? '◆' : ''].filter(Boolean).join(' ');
      html += `<div class="clip t-${c.type} ${c.id === sel ? 'sel' : ''}" data-id="${c.id}" style="left:${left}px;width:${w}px">${bg}
        ${c.transIn.type !== 'none' ? `<div class="tr" style="width:${c.transIn.dur * pps}px"></div>` : ''}
        <div class="hl"></div><div class="cl">${c.type === 'audio' ? '🎵 ' : c.type === 'text' ? 'T ' : ''}${esc(clipLabel(c))} <small style="opacity:.8">${tags}</small></div><div class="hr"></div></div>`;
    }
    html += `</div></div>`;
  });
  html += `<div class="playhead" style="left:${headW() + t * pps}px"></div>`;
  const sl = wrap.scrollLeft, st = wrap.scrollTop;
  inner.style.width = (headW() + lanePx) + 'px'; inner.innerHTML = html; wrap.scrollLeft = sl; wrap.scrollTop = st;
  // 파형
  $$('.clip.t-audio, .clip.t-video', inner).forEach(el => {
    const c = findClip(el.dataset.id), m = media.get(c.mediaId); if (!m || !m.peaks) return;
    const cvs = h('canvas'); const W = Math.min(4000, Math.ceil(c.dur * pps)); cvs.width = W; cvs.height = 40; el.append(cvs);
    const g = cvs.getContext('2d'), vid = c.type === 'video'; g.fillStyle = vid ? '#ffffff88' : '#ffffffaa';
    for (let x = 0; x < W; x += 2) { const ts = c.in + (x / W) * c.dur * c.speed, v = m.peaks[Math.floor(ts * 50)] || 0, hh = Math.max(1, v * (vid ? 16 : 36)); if (vid) g.fillRect(x, 40 - hh, 1.5, hh); else g.fillRect(x, 20 - hh / 2, 1.5, hh); }
  });
}
const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// ───────────── 타임라인 인터랙션 ─────────────
const tlwrap = $('#tlwrap');
let drag = null, delTarget = 'clip', pinch = null;
const timeAtX = (cx) => (cx - tlwrap.getBoundingClientRect().left + tlwrap.scrollLeft - headW()) / pps;
function markSel() { $$('.clip', tlwrap).forEach(x => x.classList.toggle('sel', x.dataset.id === sel)); }
function snapPoint(v, c, thr) {
  if (!$('#snap').checked) return v;
  const pts = [0, t, ...allClips().filter(o => o !== c).flatMap(o => [o.start, o.start + o.dur])];
  let best = null, bd = thr;
  for (const p of pts) { const d1 = Math.abs(p - v); if (d1 < bd) { bd = d1; best = p; } if (c) { const d2 = Math.abs(p - (v + c.dur)); if (d2 < bd) { bd = d2; best = p - c.dur; } } }
  return best == null ? v : best;
}
tlwrap.addEventListener('pointerdown', (e) => {
  const act = e.target.closest('[data-act]');
  if (act) {
    const tr = project.tracks[+act.closest('.track-row').dataset.ti], a = act.dataset.act;
    if (a === 'rm') { if (tr.clips.length && !confirm('트랙의 클립이 모두 삭제됩니다. 계속할까요?')) return; project.tracks.splice(project.tracks.indexOf(tr), 1); if (!project.tracks.length) project.tracks.push(mkTrack()); pruneEls(); }
    else if (a === 'mute') tr.muted = !tr.muted; else if (a === 'hide') tr.hidden = !tr.hidden; else if (a === 'lock') tr.locked = !tr.locked;
    commit(); return;
  }
  if (e.target.closest('.marker')) return;
  const ru = e.target.closest('.ruler');
  if (ru) { drag = { mode: 'scrub' }; lastPt = { x: e.clientX, y: e.clientY }; try { ru.setPointerCapture(e.pointerId); } catch { } pause(); seek(timeAtX(e.clientX)); return; }
  const ce = e.target.closest('.clip');
  if (ce) {
    const c = findClip(ce.dataset.id), tr = trackOf(c);
    if (sel !== c.id) { sel = c.id; if (!inspTabsFor(c).includes(inspTab)) inspTab = inspTabsFor(c)[0]; buildInspector(); markSel(); }
    if (tr.locked) return;
    const mode = e.target.classList.contains('hl') ? 'trimL' : e.target.classList.contains('hr') ? 'trimR' : 'move';
    drag = { mode, c, tr, lastTr: tr, el: ce, sx: e.clientX, scroll0: tlwrap.scrollLeft, o: { start: c.start, dur: c.dur, in: c.in }, moved: false };
    lastPt = { x: e.clientX, y: e.clientY };
    try { ce.setPointerCapture(e.pointerId); } catch { }
    return;
  }
  if (e.target.closest('.lane')) { sel = null; buildInspector(); markSel(); pause(); seek(timeAtX(e.clientX)); if (e.pointerType !== 'touch') { drag = { mode: 'scrub' }; lastPt = { x: e.clientX, y: e.clientY }; } }
});
tlwrap.addEventListener('dblclick', (e) => { const mk = e.target.closest('.marker'); if (mk) { project.markers.splice(+mk.dataset.mi, 1); commit(); } });
let lastPt = null, edgeRaf = 0;
function applyDrag(cx, cy) {
  if (!drag) return;
  if (drag.mode === 'scrub') { seek(timeAtX(cx)); return; }
  const { c, o } = drag, thr = 9 / pps, m = media.get(c.mediaId);
  const sdx = tlwrap.scrollLeft - drag.scroll0, dx = ((cx - drag.sx) + sdx) / pps;
  if (Math.abs(cx - drag.sx) > 3 || Math.abs(sdx) > 3) drag.moved = true; if (!drag.moved) return;
  const isSrc = c.type === 'video' || c.type === 'audio';
  if (drag.mode === 'move') {
    let ns = snapPoint(Math.max(0, o.start + dx), c, thr);
    let tr = drag.lastTr;
    const row = $$('.track-row').find(r => { const b = r.getBoundingClientRect(); return cy >= b.top && cy < b.bottom; });
    if (row) { const cand = project.tracks[+row.dataset.ti]; if (cand && cand.kind === kindOf(c) && !cand.locked) tr = cand; }
    if (!trackFree(tr, ns, c.dur, c.id)) { if (trackFree(drag.lastTr, ns, c.dur, c.id)) tr = drag.lastTr; else return; }
    if (tr !== drag.lastTr) {
      drag.lastTr.clips = drag.lastTr.clips.filter(x => x !== c); tr.clips.push(c); drag.lastTr = tr;
      const lane = $(`.lane[data-ti="${project.tracks.indexOf(tr)}"]`); if (lane) lane.append(drag.el);
    }
    c.start = ns;
  } else if (drag.mode === 'trimL') {
    const prev = drag.tr.clips.filter(x => x !== c && x.start + x.dur <= o.start + 1e-6).reduce((mx, x) => Math.max(mx, x.start + x.dur), 0);
    let ns = snapPoint(o.start + dx, null, thr);
    const minS = Math.max(prev, isSrc ? o.start - o.in / c.speed : 0);
    ns = clamp(ns, minS, o.start + o.dur - 0.1);
    c.start = ns; c.dur = o.start + o.dur - ns; if (isSrc) c.in = o.in + (ns - o.start) * c.speed;
  } else if (drag.mode === 'trimR') {
    const next = drag.tr.clips.filter(x => x !== c && x.start >= o.start + o.dur - 1e-6).reduce((mn, x) => Math.min(mn, x.start), Infinity);
    let ne = snapPoint(o.start + o.dur + dx, null, thr);
    const maxE = Math.min(next, isSrc && m && !c.loop ? o.start + (m.dur - o.in) / c.speed : Infinity);
    ne = clamp(ne, o.start + 0.1, maxE); c.dur = ne - o.start;
  }
  drag.el.style.left = c.start * pps + 'px'; drag.el.style.width = Math.max(4, c.dur * pps) + 'px';
}
function extendTimeline() {   // 오른쪽 끝에서 계속 끌면 타임라인을 자동으로 늘린다
  const add = 400, inner = $('#tlinner');
  $$('.lane,.ruler', inner).forEach(el => el.style.width = (parseFloat(el.style.width) + add) + 'px');
  inner.style.width = (parseFloat(inner.style.width) + add) + 'px';
}
function edgeLoop() {
  edgeRaf = 0; if (!drag || !lastPt) return;
  const r = tlwrap.getBoundingClientRect(), lz = r.left + headW() + 44, rz = r.right - 56; let v = 0;
  if (lastPt.x < lz) v = -Math.min(28, (lz - lastPt.x) / 4 + 3); else if (lastPt.x > rz) v = Math.min(28, (lastPt.x - rz) / 4 + 3);
  if (v) {
    if (v > 0 && tlwrap.scrollLeft >= tlwrap.scrollWidth - tlwrap.clientWidth - 2) extendTimeline();
    const before = tlwrap.scrollLeft; tlwrap.scrollLeft = Math.max(0, before + v);
    if (tlwrap.scrollLeft !== before) applyDrag(lastPt.x, lastPt.y);
  }
  edgeRaf = requestAnimationFrame(edgeLoop);
}
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  lastPt = { x: e.clientX, y: e.clientY }; applyDrag(e.clientX, e.clientY);
  if (!edgeRaf) edgeRaf = requestAnimationFrame(edgeLoop);
});
document.addEventListener('pointerup', () => {
  if (!drag) return;
  if (drag.mode === 'scrub') buildInspectorValuesIfKf(); else if (drag.moved) { drag.tr.clips.sort((a, b) => a.start - b.start); drag.lastTr.clips.sort((a, b) => a.start - b.start); commit(); }
  drag = null;
});
document.addEventListener('pointercancel', () => { if (drag && drag.moved) { drag.lastTr.clips.sort((a, b) => a.start - b.start); commit(); } drag = null; });
// 두 손가락 핀치로 타임라인 확대/축소 (드래그 중에는 CSS 로만 늘리고 손을 뗄 때 다시 그린다)
tlwrap.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), pps0: pps, k: 1 }; drag = null; } }, { passive: true });
tlwrap.addEventListener('touchmove', (e) => {
  if (!pinch || e.touches.length !== 2) return;
  const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  pinch.k = clamp(d / pinch.d, 10 / pinch.pps0, 300 / pinch.pps0); const inner = $('#tlinner'); inner.style.transformOrigin = '0 0'; inner.style.transform = `scaleX(${pinch.k})`;
}, { passive: true });
tlwrap.addEventListener('touchend', () => { if (pinch && pinch.k !== 1) { const inner = $('#tlinner'); inner.style.transform = ''; pps = clamp(pinch.pps0 * pinch.k, 10, 300); $('#zoom').value = pps; renderTimeline(); } pinch = null; });
// 미디어 드래그 앤 드롭
tlwrap.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/x-media') || e.dataTransfer.types.includes('Files')) { e.preventDefault(); const l = e.target.closest('.lane'); $$('.lane.drop').forEach(x => x.classList.remove('drop')); if (l) l.classList.add('drop'); } });
tlwrap.addEventListener('dragleave', () => $$('.lane.drop').forEach(x => x.classList.remove('drop')));
tlwrap.addEventListener('drop', async (e) => {
  e.preventDefault(); $$('.lane.drop').forEach(x => x.classList.remove('drop'));
  const lane = e.target.closest('.lane'), tr = lane ? project.tracks[+lane.dataset.ti] : null, at = Math.max(0, timeAtX(e.clientX));
  const mid = e.dataTransfer.getData('text/x-media');
  if (mid) { const m = media.get(mid); addMediaToTimeline(mid, { start: at, track: tr && tr.kind === kindOf({ type: m.type }) ? tr : null }); }
  else for (const f of e.dataTransfer.files) { const m = await addMedia(f); if (m) addMediaToTimeline(m.id, { start: at, track: tr && tr.kind === kindOf({ type: m.type }) ? tr : null }); }
});

// ───────────── 프리뷰 직접 조작 ─────────────
let sdrag = null;
const stage = $('#cvwrap');
function stagePt(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
stage.addEventListener('pointerdown', (e) => {
  const [px, py] = stagePt(e), c0 = selClip(), bb0 = c0 && bboxes.get(c0.id);
  if (e.target.classList.contains('hs') && c0) { sdrag = { m: 'scale', c: c0, d0: Math.hypot(px - bb0.cx, py - bb0.cy), s0: prop(c0, 'scale', t - c0.start) }; e.preventDefault(); return; }
  if (e.target.classList.contains('hrot') && c0) { sdrag = { m: 'rot', c: c0 }; e.preventDefault(); return; }
  const items = visibleItems(t).filter(i => !i.ghost).reverse();
  let hit = null;
  for (const it of items) {
    const bb = bboxes.get(it.c.id); if (!bb || trackOf(it.c).locked) continue;
    const a = -bb.rot * Math.PI / 180, dx = px - bb.cx, dy = py - bb.cy, lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= bb.w / 2 && Math.abs(ly) <= bb.h / 2) { hit = it.c; break; }
  }
  if (hit) { sel = hit.id; if (!inspTabsFor(hit).includes(inspTab)) inspTab = 'basic'; buildInspector(); renderTimeline(); sdrag = { m: 'move', c: hit, px, py, x0: prop(hit, 'x', t - hit.start), y0: prop(hit, 'y', t - hit.start) }; }
  else { sel = null; buildInspector(); renderTimeline(); }
});
document.addEventListener('pointermove', (e) => {
  if (!sdrag) return; const [px, py] = stagePt(e), c = sdrag.c, bb = bboxes.get(c.id); sdrag.moved = true;
  if (sdrag.m === 'move') {
    let nx = sdrag.x0 + (px - sdrag.px) / cv.width, ny = sdrag.y0 + (py - sdrag.py) / cv.height;
    if (Math.abs(nx) < 0.012) nx = 0; if (Math.abs(ny) < 0.012) ny = 0;
    setProp(c, 'x', nx); setProp(c, 'y', ny);
  } else if (sdrag.m === 'scale' && bb) setProp(c, 'scale', clamp(sdrag.s0 * Math.hypot(px - bb.cx, py - bb.cy) / sdrag.d0, 10, 400));
  else if (sdrag.m === 'rot' && bb) { let r = Math.atan2(py - bb.cy, px - bb.cx) * 180 / Math.PI + 90; if (r > 180) r -= 360; for (const s of [0, 90, -90, 180, -180]) if (Math.abs(r - s) < 3) r = s; setProp(c, 'rot', r); }
});
document.addEventListener('pointerup', () => { if (sdrag) { if (sdrag.moved) { commit(); buildInspector(); } sdrag = null; } });

// ───────────── 인스펙터 ─────────────
const inspTabsFor = (c) => c.type === 'audio' ? ['audio'] : c.type === 'video' ? ['basic', 'audio', 'filter', 'anim'] : c.type === 'text' || c.type === 'sticker' ? ['text', 'basic', 'anim', 'filter'] : c.type === 'shape' ? ['text', 'basic', 'anim', 'filter'] : ['basic', 'filter', 'anim'];
const TAB_NAMES = { basic: '기본', text: '내용', filter: '색보정·효과', anim: '애니메이션', audio: '소리' };
function buildInspectorValuesIfKf() { const c = selClip(); if (c && Object.values(c.kf).some(a => a.length)) buildInspector(); }

function row(label, ...kids) { return h('div', { class: 'row' }, h('label', {}, label), ...kids); }
function slider(label, get, set, min, max, step = 1, o = {}) {
  const dec = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  const val = o.num ? h('input', { type: 'number', min, max, step, class: 'numin' }) : h('span', { class: 'val' });
  const inp = h('input', { type: 'range', min, max, step, value: get() });
  const upd = () => { const v = +get(); if (o.num) val.value = v.toFixed(dec); else val.textContent = v.toFixed(dec) + (o.unit || ''); };
  inp.oninput = () => { set(+inp.value); upd(); }; inp.onchange = () => commit();
  if (o.num) val.onchange = () => { const v = clamp(+val.value || 0, +min, +max); set(v); inp.value = v; upd(); commit(); if (o.rebuild) buildInspector(); };
  upd();
  let kfb = h('span');
  if (o.kf) { const c = selClip(), rel = t - c.start, on = (c.kf[o.kf] || []).some(p => Math.abs(p.t - rel) < 0.04); kfb = h('button', { class: 'kf' + (on ? ' on' : ''), title: '키프레임 추가/삭제 (재생 헤드 위치)', onclick: () => { toggleKf(c, o.kf); commit(); buildInspector(); } }, '◆'); }
  const r = h('div', { class: 'row' + (o.num ? ' rnum' : '') }, h('label', {}, label + (o.num && o.unit ? ` (${o.unit})` : '')), inp, val, kfb);
  if (!o.pm) return r;
  const bump = (d) => () => { const v = clamp(+(+get() + d).toFixed(3), +min, +max); set(v); commit(); buildInspector(); };
  return h('div', {}, r, h('div', { class: 'pm' }, h('button', { onclick: bump(-o.pm) }, '−'), h('button', { onclick: bump(o.pm) }, '+')));
}
function chips(options, cur, pick) {
  const box = h('div', { class: 'chips' });
  for (const [v, n] of options) { const b = h('button', { class: 'chip' + (v === cur ? ' on' : ''), onclick: () => { $$('.chip', box).forEach(x => x.classList.remove('on')); b.classList.add('on'); pick(v); commit(); } }, n); box.append(b); }
  return box;
}
const btn = (label, fn, cls = 'chip') => h('button', { class: cls, onclick: fn }, label);
const check = (label, get, set) => h('label', { class: 'sm', style: 'margin:6px 0;display:flex' }, h('input', { type: 'checkbox', checked: get(), onchange: (e) => { set(e.target.checked); commit(); } }), label);
const color = (label, get, set) => h('div', { class: 'row two' }, h('label', {}, label), h('input', { type: 'color', value: get(), oninput: (e) => set(e.target.value), onchange: () => commit() }));

function buildInspector() {
  const box = $('#insp'); box.innerHTML = '';
  const c = selClip();
  if (!c) {
    box.append(
      h('div', { class: 'sec' }, '프로젝트 설정'),
      color('배경색', () => project.bg, (v) => project.bg = v),
      h('div', { class: 'hint' }, `출력 크기: ${project.w} × ${project.h} px`),
      h('div', { class: 'sec' }, '전체 음량'),
      slider('영상 원본', () => project.videoVol, v => project.videoVol = v, 0, 200, 1, { num: true, pm: 10, unit: '%' }),
      slider('음악·음성', () => project.audioVol, v => project.audioVol = v, 0, 200, 1, { num: true, pm: 10, unit: '%' }),
      h('div', { class: 'empty' }, '클립을 선택하면 속성을 편집할 수 있습니다.', h('br'), h('br'), '단축키: Space 재생 · S 분할 · Delete 삭제 · Ctrl+D 복제 · Ctrl+Z 실행취소 · M 마커 · ←/→ 프레임 이동 · +/− 확대')
    );
    return;
  }
  const tabs = inspTabsFor(c); if (!tabs.includes(inspTab)) inspTab = tabs[0];
  box.append(h('div', { class: 'itabs' }, tabs.map(k => h('button', { class: 'itab' + (k === inspTab ? ' on' : ''), onclick: () => { inspTab = k; buildInspector(); } }, k === 'text' && c.type === 'shape' ? '도형' : TAB_NAMES[k]))));
  const B = { basic: tabBasic, text: tabText, filter: tabFilter, anim: tabAnim, audio: tabAudio }[inspTab];
  box.append(B(c));
}
function tabTransform(c) {
  const rel = () => t - c.start, vis = c.type === 'video' || c.type === 'image', bb = bboxes.get(c.id);
  return [
    h('div', { class: 'sec' }, '크기·위치'),
    vis ? chips([['fit', '전체 보기'], ['fill', '화면 채우기']], c.fit, v => c.fit = v) : null,
    slider('크기', () => prop(c, 'scale', rel()), v => setProp(c, 'scale', v), 10, 400, 1, { kf: 'scale', unit: '%', num: true, pm: 5 }),
    slider('위치 X', () => prop(c, 'x', rel()) * 100, v => setProp(c, 'x', v / 100), -100, 100, 0.5, { kf: 'x', unit: '%', num: true, pm: 1 }),
    slider('위치 Y', () => prop(c, 'y', rel()) * 100, v => setProp(c, 'y', v / 100), -100, 100, 0.5, { kf: 'y', unit: '%', num: true, pm: 1 }),
    slider('회전', () => prop(c, 'rot', rel()), v => setProp(c, 'rot', v), -180, 180, 1, { kf: 'rot', unit: '°', num: true, pm: 1 }),
    slider('투명도', () => prop(c, 'opacity', rel()), v => setProp(c, 'opacity', v), 0, 100, 1, { kf: 'opacity', unit: '%', num: true }),
    h('div', { class: 'chips' },
      btn('⌖ 가운데 정렬', () => { setProp(c, 'x', 0); setProp(c, 'y', 0); commit(); buildInspector(); }),
      btn('⟳ 90° 회전', () => { let r = prop(c, 'rot', rel()) + 90; if (r > 180) r -= 360; setProp(c, 'rot', r); commit(); buildInspector(); }),
      btn('↔ 좌우반전', () => { c.flipX = !c.flipX; commit(); buildInspector(); }, 'chip' + (c.flipX ? ' on' : '')),
      btn('↕ 상하반전', () => { c.flipY = !c.flipY; commit(); buildInspector(); }, 'chip' + (c.flipY ? ' on' : '')),
      btn('크기/위치 초기화', () => { Object.assign(c, { x: 0, y: 0, scale: 100, rot: 0, opacity: 100, flipX: false, flipY: false, kf: {} }); commit(); buildInspector(); })),
    h('div', { class: 'hint' }, `출력 ${project.w}×${project.h}px` + (bb && bb.w ? ` · 이 클립 표시 ${Math.round(bb.w)}×${Math.round(bb.h)}px` : '')),
  ];
}
function speedRow(c) {
  return slider('속도', () => c.speed, v => {
    const srcLen = c.dur * c.speed; c.speed = v; c.dur = srcLen / v; const m = media.get(c.mediaId), tr = trackOf(c);
    if (m && (c.type === 'video' || c.type === 'audio') && !c.loop) c.dur = Math.min(c.dur, (m.dur - c.in) / v);
    const next = tr.clips.filter(x => x !== c && x.start >= c.start).reduce((mn, x) => Math.min(mn, x.start), Infinity); c.dur = Math.min(c.dur, next - c.start);
  }, 0.25, 4, 0.05, { num: true, pm: 0.25, unit: '배' });
}
function moveOrder(c, dir) {
  const tr = trackOf(c), list = tr.clips.slice().sort((a, b) => a.start - b.start), i = list.indexOf(c), j = i + dir;
  if (j < 0 || j >= list.length) return toast(dir < 0 ? '맨 앞입니다' : '맨 뒤입니다');
  const a = list[Math.min(i, j)], b = list[Math.max(i, j)], gap = b.start - (a.start + a.dur), s0 = a.start;
  b.start = s0; a.start = s0 + b.dur + gap; commit(); buildInspector();
}
function tabTiming(c) {
  const m = media.get(c.mediaId), tr = trackOf(c);
  const apply = (s, d) => {
    s = Math.max(0, s); d = Math.max(0.1, d);
    if ((c.type === 'video' || c.type === 'audio') && m && !c.loop && d > (m.dur - c.in) / c.speed + 1e-6) { toast('원본 길이를 넘을 수 없습니다'); return false; }
    if (!trackFree(tr, s, d, c.id)) { toast('다른 클립과 겹칩니다'); return false; }
    c.start = s; c.dur = d; return true;
  };
  const num = (label, get, set) => h('div', { class: 'row two' }, h('label', {}, label), h('input', { type: 'number', step: 0.01, min: 0, value: get().toFixed(2), class: 'numin', onchange: (e) => { if (set(+e.target.value)) commit(); buildInspector(); } }));
  return [
    h('div', { class: 'sec' }, '타이밍 (초)'),
    num('시작', () => c.start, v => apply(v, c.dur)), num('끝', () => c.start + c.dur, v => apply(c.start, v - c.start)), num('길이', () => c.dur, v => apply(c.start, v)),
    h('div', { class: 'chips' }, btn('◀ 앞으로 이동', () => moveOrder(c, -1)), btn('뒤로 이동 ▶', () => moveOrder(c, 1))),
  ];
}
function tabBasic(c) {
  const out = [...tabTransform(c)];
  if (c.type === 'video' || c.type === 'image') out.push(h('div', { class: 'sec' }, '마스크'), chips(MASKS, c.mask, v => c.mask = v), check('배경 블러 채우기 (빈 영역)', () => c.bgBlur, v => c.bgBlur = v));
  out.push(...tabTiming(c));
  if (c.type === 'video') out.push(h('div', { class: 'sec' }, '재생 속도'), speedRow(c));
  return h('div', {}, out);
}
function tabAudio(c) {
  const out = [h('div', { class: 'sec' }, '볼륨'),
    check('이 클립 음소거', () => c.mute, v => c.mute = v),
    slider('볼륨', () => c.volume, v => c.volume = v, 0, 200, 1, { num: true, pm: 10, unit: '%' }),
    slider('페이드인', () => c.fadeIn, v => c.fadeIn = v, 0, 10, 0.1, { num: true, unit: '초' }),
    slider('페이드아웃', () => c.fadeOut, v => c.fadeOut = v, 0, 10, 0.1, { num: true, unit: '초' }),
    h('div', { class: 'sec' }, '싱크'),
    slider('싱크', () => c.syncMs, v => c.syncMs = v, -2000, 2000, 10, { num: true, pm: 10, unit: 'ms' }),
    h('div', { class: 'hint' }, '+ 이면 소리가 화면보다 늦게, − 이면 빠르게 나옵니다.')];
  if (c.type === 'audio') out.push(check('반복 재생 (오른쪽 끝을 늘리면 반복)', () => c.loop, v => c.loop = v));
  out.push(...stemSection(c));
  if (c.type === 'audio') out.push(...tabTiming(c), h('div', { class: 'sec' }, '재생 속도'), speedRow(c));
  return h('div', {}, out);
}

// ── 목소리/배경음 분리 UI ──
let prevSrc = null;
function previewBuf(buf) {
  ensureAudio(); if (prevSrc) { try { prevSrc.stop(); } catch { } prevSrc = null; } if (!buf) return;
  const s = actx.createBufferSource(); s.buffer = buf; s.connect(actx.destination); s.start(); prevSrc = s; s.onended = () => { if (prevSrc === s) prevSrc = null; };
}
function stemSection(c) {
  const m = media.get(c.mediaId), out = [h('div', { class: 'sec' }, '목소리 / 배경음 분리')];
  if (m && !m.abuf && m.blob && m.blob.size > AUDIO_LIMIT() && !m.analyzing) out.push(h('button', { class: 'wide', onclick: async (e) => { m.analyzing = true; e.target.textContent = '분석 중…'; e.target.disabled = true; await loadAudio(m, true); m.analyzing = false; buildInspector(); } }, '소리 분석하기 (파형·분리 사용)'));
  if (!m || !m.abuf) return [...out, h('div', { class: 'hint' }, m && m.blob && m.blob.size > AUDIO_LIMIT() ? '파일이 커서 불러오는 속도를 위해 소리 분석(파형·분리)을 건너뛰었습니다. 필요하면 아래 버튼을 누르세요.' : '소리를 분석하는 중이거나 소리가 없는 파일입니다.')];
  const status = h('div', { class: 'hint' });
  if (!m.sep) {
    const b = h('button', { class: 'primary wide', onclick: () => runSeparation(m, c, b, status) }, '분리 실행 (이 기기에서 처리)');
    return [...out, h('div', { class: 'hint' }, '스테레오 음원에서 가운데 정렬된 목소리를 분리합니다. 모노 음원은 불가. 긴 파일은 시간이 걸립니다.'), b, status];
  }
  out.push(h('div', { class: 'hint' }, '✓ 분리 완료 — 같은 파일은 저장된 결과를 재사용합니다.'),
    check('분리 음원으로 재생 (이 컷에 적용)', () => c.sepOn, v => { c.sepOn = v; }),
    slider('목소리', () => c.vVol, v => c.vVol = v, 0, 200, 1, { num: true, pm: 10, unit: '%' }),
    slider('배경음', () => c.mVol, v => c.mVol = v, 0, 200, 1, { num: true, pm: 10, unit: '%' }),
    h('div', { class: 'chips' },
      btn('목소리만', () => { c.sepOn = true; c.vVol = 100; c.mVol = 0; commit(); buildInspector(); }),
      btn('음악만', () => { c.sepOn = true; c.vVol = 0; c.mVol = 100; commit(); buildInspector(); }),
      btn('둘 다', () => { c.sepOn = true; c.vVol = 100; c.mVol = 100; commit(); buildInspector(); })),
    h('div', { class: 'chips' }, btn('▶ 목소리 듣기', () => previewBuf(m.sep.v)), btn('▶ 배경음 듣기', () => previewBuf(m.sep.m)), btn('■ 정지', () => previewBuf(null))),
    h('div', { class: 'chips' },
      btn('목소리 WAV 저장', () => download(wavBlob(m.sep.v), m.name.replace(/\.[^.]+$/, '') + '_목소리.wav')),
      btn('배경음 WAV 저장', () => download(wavBlob(m.sep.m), m.name.replace(/\.[^.]+$/, '') + '_배경음.wav')),
      btn('다시 분리', () => { m.sep = null; idbDelSep(m.fp); c.sepOn = false; commit(); buildInspector(); })));
  return out;
}
async function runSeparation(m, c, b, status) {
  b.disabled = true;
  try {
    if (m.abuf.duration > 480) throw new Error('8분 이하의 파일만 분리할 수 있습니다');
    const r = await separateStems(m.abuf, (p) => { status.textContent = `분리 중… ${Math.round(p * 100)}% (화면을 켜 두세요)`; });
    m.sep = r; c.sepOn = true; c.vVol = 100; c.mVol = 100;
    idbPutSep({ fp: m.fp, v: wavBlob(r.v), m: wavBlob(r.m) });
    commit(); buildInspector(); toast('분리 완료');
  } catch (e) { status.textContent = '실패: ' + e.message; b.disabled = false; }
}

function tabText(c) {
  if (c.type === 'shape') {
    const S = c.shape;
    return h('div', {}, [h('div', { class: 'sec' }, '도형'), chips(SHAPES.map(([k, n]) => [k, n]), S.type, v => S.type = v), color('채우기', () => S.color, v => S.color = v), color('테두리', () => S.stroke, v => S.stroke = v), slider('테두리 두께', () => S.strokeW, v => S.strokeW = v, 0, 40, 1)]);
  }
  const T = c.text;
  const ta = h('textarea', { rows: 3, value: T.content, oninput: () => { T.content = ta.value || ' '; }, onchange: () => commit() });
  const fs = h('select', { onchange: () => { T.font = fs.value; document.fonts.load(`40px "${T.font}"`); commit(); } }, FONTS.map(f => h('option', { value: f, selected: f === T.font, style: `font-family:"${f}"` }, f)));
  return h('div', {}, [
    h('div', { class: 'sec' }, '텍스트'), ta, row('글꼴', fs),
    slider('크기', () => T.size, v => T.size = v, 10, 400, 1),
    h('div', { class: 'chips' },
      h('button', { class: 'chip' + (T.bold ? ' on' : ''), onclick: (e) => { T.bold = !T.bold; e.target.classList.toggle('on'); commit(); } }, 'B 굵게'),
      h('button', { class: 'chip' + (T.italic ? ' on' : ''), onclick: (e) => { T.italic = !T.italic; e.target.classList.toggle('on'); commit(); } }, 'I 기울임')),
    chips([['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], T.align, v => T.align = v),
    color('글자색', () => T.color, v => T.color = v), color('외곽선', () => T.stroke, v => T.stroke = v),
    slider('외곽선 두께', () => T.strokeW, v => T.strokeW = v, 0, 30, 1),
    h('div', { class: 'sec' }, '그림자'), chips([['none', '없음'], ['drop', '드롭'], ['glow', '글로우']], T.shadow, v => T.shadow = v),
    h('div', { class: 'sec' }, '배경 박스'), color('배경색', () => T.bg, v => T.bg = v), slider('배경 투명도', () => T.bgAlpha, v => T.bgAlpha = v, 0, 100, 1, { unit: '%' }),
  ]);
}
function tabFilter(c) {
  const F = c.filter, out = [];
  if (c.type === 'video' || c.type === 'image') {
    const pr = h('div', { class: 'fpresets' }, Object.entries(FILTER_PRESETS).map(([n, p]) => h('div', { class: 'fp', onclick: () => { c.filter = { ...DEF_FILTER, ...p }; commit(); buildInspector(); } }, n)));
    out.push(h('div', { class: 'sec' }, '필터 프리셋'), pr);
  }
  out.push(h('div', { class: 'sec' }, '색 조정'),
    slider('밝기', () => F.brightness, v => F.brightness = v, 0, 250), slider('대비', () => F.contrast, v => F.contrast = v, 0, 250), slider('채도', () => F.saturate, v => F.saturate = v, 0, 300),
    slider('색조', () => F.hue, v => F.hue = v, -180, 180), slider('블러', () => F.blur, v => F.blur = v, 0, 40), slider('흑백', () => F.grayscale, v => F.grayscale = v, 0, 100),
    slider('세피아', () => F.sepia, v => F.sepia = v, 0, 100), slider('반전', () => F.invert, v => F.invert = v, 0, 100),
    h('div', { class: 'sec' }, '효과 (중복 가능)'),
    h('div', { class: 'chips' }, FX.map(([k, n]) => h('button', { class: 'chip' + (c.fx.includes(k) ? ' on' : ''), onclick: (e) => { c.fx = c.fx.includes(k) ? c.fx.filter(x => x !== k) : [...c.fx, k]; e.target.classList.toggle('on'); commit(); } }, n))));
  if (c.type === 'video' || c.type === 'image') out.push(h('div', { class: 'sec' }, '크로마키 (그린스크린)'), check('크로마키 사용', () => c.chroma.on, v => { c.chroma.on = v; }), color('키 색상', () => c.chroma.color, v => c.chroma.color = v), slider('허용치', () => c.chroma.tol, v => c.chroma.tol = v, 1, 100), slider('가장자리', () => c.chroma.soft, v => c.chroma.soft = v, 0, 50));
  return h('div', {}, out);
}
function tabAnim(c) {
  const mk = (title, key, list) => [h('div', { class: 'sec' }, title), chips(list, c[key].type, v => { c[key].type = v; if (v !== 'none') { t = key === 'animOut' ? c.start + Math.max(0, c.dur - c[key].dur) : c.start; if (key === 'animOut') t = clamp(t, 0, total()); } }), c[key].type !== 'none' ? slider('길이', () => c[key].dur, v => c[key].dur = v, 0.1, Math.min(5, c.dur), 0.1, { unit: 's' }) : null];
  return h('div', {}, [...mk('입장 애니메이션', 'animIn', ANIMS), ...mk('퇴장 애니메이션', 'animOut', ANIMS), ...mk('전환 효과 (클립 시작, 앞 클립과 이어 붙이면 교차)', 'transIn', TRANS)]);
}

// ───────────── 좌측 패널 ─────────────
function initPanels() {
  $$('.ltab').forEach(b => b.onclick = () => { $$('.ltab,.lpanel').forEach(x => x.classList.remove('on')); b.classList.add('on'); $('#p-' + b.dataset.p).classList.add('on'); });
  $('#btnImpVideo').onclick = () => $('#vidIn').click(); $('#btnImpPhoto').onclick = () => $('#imgIn').click(); $('#btnImportAudio').onclick = () => $('#audioIn').click();
  $('#vidIn').onchange = async (e) => { const f = [...e.target.files]; e.target.value = ''; await importFiles(f); };
  $('#imgIn').onchange = async (e) => { const f = [...e.target.files]; e.target.value = ''; await importFiles(f); };
  $('#fileIn').onchange = async (e) => { const f = [...e.target.files]; e.target.value = ''; await importFiles(f); };
  $$('#mediaTabs button').forEach(b => b.onclick = () => { mediaFilter = b.dataset.f; renderMedia(); });
  $('#tMute').onclick = toggleMute;
  $('#audioIn').onchange = async (e) => { for (const f of e.target.files) await addMedia(f); e.target.value = ''; };
  const pm = $('#p-media');
  pm.addEventListener('dragover', e => { e.preventDefault(); }); pm.addEventListener('drop', async e => { e.preventDefault(); await importFiles(e.dataTransfer.files); });
  window.addEventListener('dragover', e => e.preventDefault()); window.addEventListener('drop', e => e.preventDefault());
  BG_SOURCES.forEach(([a, b]) => $('#bgGrid').append(h('div', { class: 'tile', style: `background:linear-gradient(135deg,${a},${b});min-height:40px`, title: '배경 추가', onclick: () => addBackground(a, b) })));
  $('#btnAddText').onclick = () => addText();
  TEXT_PRESETS.forEach(p => $('#textPresets').append(h('div', { class: 'tile txt', style: `font-family:"${p.t.font || 'Noto Sans KR'}";color:${p.t.color || '#fff'};font-weight:${p.t.bold === false ? 400 : 700};${p.t.bgAlpha ? `background:${rgba(p.t.bg, p.t.bgAlpha / 100)};` : ''}${p.t.shadow === 'glow' ? `text-shadow:0 0 8px ${p.t.color};` : ''}${p.t.strokeW ? `-webkit-text-stroke:1px ${p.t.stroke};` : ''}`, onclick: () => addText(p) }, p.n)));
  SHAPES.forEach(([k, n]) => $('#shapeGrid').append(h('div', { class: 'tile', onclick: () => addShape(k) }, n)));
  renderEmoji();
  LABELS.forEach(l => $('#labelGrid').append(h('div', { class: 'tile txt', style: `background:${l[1]};color:${l[2]};font-family:'Black Han Sans','Noto Sans KR';font-size:17px`, onclick: () => addLabel(l) }, l[0])));
  $('#btnStkUp').onclick = () => $('#stkIn').click();
  $('#stkIn').onchange = async (e) => { await addCustomSticker([...e.target.files]); e.target.value = ''; };
  [['pop', '팝'], ['whoosh', '휘익'], ['ding', '딩'], ['beep', '삐'], ['kick', '킥'], ['clap', '박수'], ['coin', '코인'], ['riser', '라이저']].forEach(([k, n]) => $('#sfxGrid').append(h('div', { class: 'tile sfx', onclick: () => addSfx(k, n) }, h('span', {}, '🔊'), n)));
  $('#btnRec').onclick = toggleRec;
  initTts();
  $('#btnCapAdd').onclick = () => {
    const lines = $('#capText').value.split('\n').map(s => s.trim()).filter(Boolean), d = +$('#capDur').value || 2; if (!lines.length) return;
    addCaptions(lines.map((l, i) => ({ s: t + i * d, e: t + (i + 1) * d, text: l })));
  };
  $('#btnSrt').onclick = () => $('#srtIn').click();
  $('#srtIn').onchange = async (e) => { const f = e.target.files[0]; if (f) addCaptions(parseSrt(await f.text())); e.target.value = ''; };
  $('#btnSrtOut').onclick = exportSrt;
}
async function addBackground(a, b) {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 1280, 720); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, 1280, 720);
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); const m = await addMedia(new File([blob], `배경 ${a}.png`, { type: 'image/png' })); if (m) addMediaToTimeline(m.id);
}
const SRT_STYLE = TEXT_PRESETS[2];
function addCaptions(list) {
  if (!list.length) return toast('자막이 없습니다');
  const tr = mkTrack(); project.tracks.unshift(tr);
  for (const L of list) tr.clips.push(mkClip('text', { start: L.s, dur: Math.max(0.2, L.e - L.s), y: SRT_STYLE.y, text: { ...defText(), ...SRT_STYLE.t, content: L.text } }));
  commit(); buildInspector(); toast(`자막 ${list.length}개 추가`);
}
function parseSrt(txt) {
  const out = [], re = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)\s*\r?\n([\s\S]*?)(?:\r?\n\r?\n|$)/g; let m;
  const sec = (a, b, c, d) => +a * 3600 + +b * 60 + +c + +d / 1000;
  while ((m = re.exec(txt))) out.push({ s: sec(m[1], m[2], m[3], m[4]), e: sec(m[5], m[6], m[7], m[8]), text: m[9].trim() });
  return out;
}
function exportSrt() {
  const caps = allClips().filter(c => c.type === 'text').sort((a, b) => a.start - b.start); if (!caps.length) return toast('텍스트 클립이 없습니다');
  const f = (s) => { const ms = Math.round(s * 1000), p = (n, l = 2) => String(n).padStart(l, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
  download(new Blob([caps.map((c, i) => `${i + 1}\n${f(c.start)} --> ${f(c.start + c.dur)}\n${c.text.content}\n`).join('\n')], { type: 'text/plain' }), project.name + '.srt');
}
function download(blob, name) { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

// ───────────── 목소리/배경음 분리 (스테레오 STFT 마스킹, 외부 모델/서버 없음) ─────────────
function makeFFT(N) {
  const levels = Math.log2(N) | 0, rev = new Uint32Array(N), cs = new Float64Array(N / 2), sn = new Float64Array(N / 2);
  for (let i = 0; i < N; i++) { let r = 0, x = i; for (let b = 0; b < levels; b++) { r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
  for (let i = 0; i < N / 2; i++) { cs[i] = Math.cos(2 * Math.PI * i / N); sn[i] = Math.sin(2 * Math.PI * i / N); }
  return (re, im, inv) => {
    for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let q = re[i]; re[i] = re[j]; re[j] = q; q = im[i]; im[i] = im[j]; im[j] = q; } }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let i = 0; i < N; i += size) for (let j = i, k = 0; j < i + half; j++, k += step) {
        const c = cs[k], s = inv ? sn[k] : -sn[k], l = j + half, tr = re[l] * c - im[l] * s, ti = re[l] * s + im[l] * c;
        re[l] = re[j] - tr; im[l] = im[j] - ti; re[j] += tr; im[j] += ti;
      }
    }
    if (inv) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  };
}
async function separateStems(buf, onProgress) {
  if (buf.numberOfChannels < 2) throw new Error('모노 음원은 분리할 수 없습니다 (스테레오 필요)');
  const N = 2048, H = 512, nb = N / 2, sr = buf.sampleRate, len = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
  let diff = 0, sum = 0; for (let i = 0; i < len; i += 97) { diff += Math.abs(L[i] - R[i]); sum += Math.abs(L[i]) + Math.abs(R[i]); }
  if (diff < 1e-4 * sum + 1e-9) throw new Error('좌우 채널이 같은 음원(사실상 모노)이라 분리할 수 없습니다');
  const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const wf = new Float32Array(nb + 1), binHz = sr / N;
  for (let k = 0; k <= nb; k++) { const f = k * binHz; wf[k] = f < 100 ? 0 : f < 200 ? (f - 100) / 100 : f < 8000 ? 1 : f < 16000 ? 1 - 0.7 * (f - 8000) / 8000 : 0.3; }
  const vL = new Float32Array(len), vR = new Float32Array(len), fft = makeFFT(N), re = new Float64Array(N), im = new Float64Array(N);
  const prev = new Float32Array(nb + 1), mk = new Float32Array(nb + 1), a = new Float64Array(4 * (nb + 1));
  let fr = 0; const total = Math.ceil((len + N) / H);
  for (let s = -N + H; s < len; s += H) {
    for (let i = 0; i < N; i++) { const x = s + i; if (x >= 0 && x < len) { re[i] = L[x] * win[i]; im[i] = R[x] * win[i]; } else { re[i] = 0; im[i] = 0; } }
    fft(re, im, false);
    for (let k = 0; k <= nb; k++) {
      const k2 = (N - k) % N, Lr = (re[k] + re[k2]) / 2, Li = (im[k] - im[k2]) / 2, Rr = (im[k] + im[k2]) / 2, Ri = -(re[k] - re[k2]) / 2;
      const pl = Lr * Lr + Li * Li, pr = Rr * Rr + Ri * Ri, dr = Lr - Rr, di = Li - Ri;
      let m = 1 - (dr * dr + di * di) / (pl + pr + 1e-12); m = m < 0 ? 0 : m * m; m *= wf[k];
      mk[k] = m;
    }
    for (let k = 0; k <= nb; k++) {   // 주파수·시간 평활
      const m = 0.25 * (mk[Math.max(0, k - 1)] + 2 * mk[k] + mk[Math.min(nb, k + 1)]) * 0.55 + 0.45 * prev[k]; prev[k] = m;
      const k2 = (N - k) % N, Lr = (re[k] + re[k2]) / 2, Li = (im[k] - im[k2]) / 2, Rr = (im[k] + im[k2]) / 2, Ri = -(re[k] - re[k2]) / 2;
      a[4 * k] = Lr * m; a[4 * k + 1] = Li * m; a[4 * k + 2] = Rr * m; a[4 * k + 3] = Ri * m;
    }
    for (let k = 0; k <= nb; k++) {
      const vlr = a[4 * k], vli = a[4 * k + 1], vrr = a[4 * k + 2], vri = a[4 * k + 3];
      re[k] = vlr - vri; im[k] = vli + vrr;
      if (k > 0 && k < nb) { re[N - k] = vlr + vri; im[N - k] = -vli + vrr; }
    }
    im[0] = im[0]; fft(re, im, true);
    for (let i = 0; i < N; i++) { const x = s + i; if (x >= 0 && x < len) { vL[x] += re[i] * win[i] / 1.5; vR[x] += im[i] * win[i] / 1.5; } }
    if (++fr % 60 === 0) { onProgress && onProgress(fr / total); await sleep(0); }
  }
  const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 1, sr);
  const v = ac.createBuffer(2, len, sr), mu = ac.createBuffer(2, len, sr), mL = new Float32Array(len), mR = new Float32Array(len);
  for (let i = 0; i < len; i++) { mL[i] = L[i] - vL[i]; mR[i] = R[i] - vR[i]; }
  v.copyToChannel(vL, 0); v.copyToChannel(vR, 1); mu.copyToChannel(mL, 0); mu.copyToChannel(mR, 1);
  onProgress && onProgress(1);
  return { v, m: mu };
}
async function loadSep(m) {
  try {
    const rec = await idbGetSep(m.fp); if (!rec || m.sep) return;
    const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 1, 44100);
    const [v, mu] = await Promise.all([rec.v.arrayBuffer(), rec.m.arrayBuffer()].map(async (p) => { const ab = await p; return new Promise((res, rej) => { const q = ac.decodeAudioData(ab, res, rej); if (q && q.catch) q.catch(rej); }); }));
    m.sep = { v, m: mu }; buildInspector();
  } catch { }
}

// ───────────── 효과음 합성 / 녹음 ─────────────
function wavBlob(buf) {
  const ch = buf.numberOfChannels || 1, data = []; for (let i = 0; i < ch; i++) data.push(buf.getChannelData(i));
  const n = data[0].length, ab = new ArrayBuffer(44 + n * ch * 2), v = new DataView(ab), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * ch * 2, true);
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { v.setInt16(o, clamp(data[c][i], -1, 1) * 32767, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}
async function synth(name) {
  const sr = 44100, dur = { pop: 0.3, whoosh: 1.2, ding: 1.4, beep: 0.4, kick: 0.6, clap: 0.5, coin: 0.5, riser: 3 }[name];
  const oc = new OfflineAudioContext(1, Math.ceil(sr * dur), sr), g = oc.createGain(); g.connect(oc.destination);
  const noise = () => { const b = oc.createBuffer(1, Math.ceil(sr * dur), sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = oc.createBufferSource(); s.buffer = b; return s; };
  const osc = (type, f) => { const o = oc.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  switch (name) {
    case 'pop': { const o = osc('sine', 700); o.frequency.exponentialRampToValueAtTime(120, 0.12); g.gain.setValueAtTime(0.9, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.25); o.connect(g); o.start(); break; }
    case 'whoosh': { const n = noise(), f = oc.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(4000, 0.5); f.frequency.exponentialRampToValueAtTime(400, 1.1); g.gain.setValueAtTime(0.001, 0); g.gain.linearRampToValueAtTime(0.8, 0.5); g.gain.linearRampToValueAtTime(0.001, 1.15); n.connect(f); f.connect(g); n.start(); break; }
    case 'ding': { for (const fr of [880, 1320, 1760]) { const o = osc('sine', fr), gg = oc.createGain(); gg.gain.value = fr === 880 ? 0.5 : 0.2; o.connect(gg); gg.connect(g); o.start(); } g.gain.setValueAtTime(0.8, 0); g.gain.exponentialRampToValueAtTime(0.001, 1.3); break; }
    case 'beep': { const o = osc('square', 1000); g.gain.setValueAtTime(0.25, 0); g.gain.setValueAtTime(0.001, 0.3); o.connect(g); o.start(); break; }
    case 'kick': { const o = osc('sine', 160); o.frequency.exponentialRampToValueAtTime(40, 0.25); g.gain.setValueAtTime(1, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.5); o.connect(g); o.start(); break; }
    case 'clap': { const n = noise(), f = oc.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200; [0, 0.03, 0.06].forEach(tt => { g.gain.setValueAtTime(0.9, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + 0.025); }); g.gain.setValueAtTime(0.9, 0.09); g.gain.exponentialRampToValueAtTime(0.001, 0.45); n.connect(f); f.connect(g); n.start(); break; }
    case 'coin': { const o = osc('square', 988); o.frequency.setValueAtTime(1319, 0.08); g.gain.setValueAtTime(0.25, 0); g.gain.setValueAtTime(0.25, 0.4); g.gain.exponentialRampToValueAtTime(0.001, 0.5); o.connect(g); o.start(); break; }
    case 'riser': { const o = osc('sawtooth', 100); o.frequency.exponentialRampToValueAtTime(1600, 2.9); const f = oc.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(6000, 2.9); g.gain.setValueAtTime(0.001, 0); g.gain.linearRampToValueAtTime(0.35, 2.9); g.gain.linearRampToValueAtTime(0.001, 3); o.connect(f); f.connect(g); o.start(); break; }
  }
  return wavBlob(await oc.startRendering());
}
async function addSfx(k, n) {
  const m = await addMedia(new File([await synth(k)], `효과음 ${n}.wav`, { type: 'audio/wav' })); if (m) addMediaToTimeline(m.id, { start: t });
}
let rec = null;
async function toggleRec() {
  const btn = $('#btnRec');
  if (rec) { rec.mr.stop(); return; }
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true }), mr = new MediaRecorder(st), chunks = [], t0 = performance.now(), at = t;
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = async () => {
      st.getTracks().forEach(x => x.stop()); clearInterval(rec.iv); const dur = (performance.now() - t0) / 1000; rec = null;
      btn.textContent = '🎙 음성 녹음 시작'; btn.classList.remove('on');
      const m = await addMedia(new File([new Blob(chunks, { type: mr.mimeType })], `녹음 ${new Date().toLocaleTimeString()}.webm`, { type: mr.mimeType.split(';')[0] || 'audio/webm' }), { durOverride: dur });
      if (m) addMediaToTimeline(m.id, { start: at });
    };
    mr.start(); rec = { mr, iv: setInterval(() => { btn.textContent = `⏹ 녹음 중… ${((performance.now() - t0) / 1000).toFixed(1)}s (클릭하여 종료)`; }, 200) }; btn.classList.add('on');
  } catch { toast('마이크를 사용할 수 없습니다 (권한 확인)'); }
}

// ───────────── AI 음성 (TTS) ─────────────
const TTS_DEFAULT_VOICE = { openai: 'coral', eleven: 'EXAVITQu4vr4xnSDxMaL', google: 'ko-KR-Neural2-A', azure: 'ko-KR-SunHiNeural', browser: '', local: '' };
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { } } };
const VOICES = {
  azure: [['ko-KR-SunHiNeural', '선희 · 한국어 여성'], ['ko-KR-InJoonNeural', '인준 · 한국어 남성'], ['ko-KR-HyunsuMultilingualNeural', '현수 · 한국어 남성 (다국어)'], ['ko-KR-BongJinNeural', '봉진 · 한국어 남성'], ['ko-KR-GookMinNeural', '국민 · 한국어 남성'], ['ko-KR-JiMinNeural', '지민 · 한국어 여성'], ['ko-KR-SeoHyeonNeural', '서현 · 한국어 여성'], ['ko-KR-SoonBokNeural', '순복 · 한국어 여성'], ['ko-KR-YuJinNeural', '유진 · 한국어 여성'],
    ['en-US-JennyNeural', 'Jenny · 영어(미국) 여성'], ['en-US-AriaNeural', 'Aria · 영어(미국) 여성'], ['en-US-GuyNeural', 'Guy · 영어(미국) 남성'], ['ja-JP-NanamiNeural', 'Nanami · 일본어 여성'], ['ja-JP-KeitaNeural', 'Keita · 일본어 남성'], ['zh-CN-XiaoxiaoNeural', 'Xiaoxiao · 중국어 여성'], ['zh-CN-YunxiNeural', 'Yunxi · 중국어 남성']],
  google: [['ko-KR-Neural2-A', 'Neural2-A · 여성'], ['ko-KR-Neural2-B', 'Neural2-B · 여성'], ['ko-KR-Neural2-C', 'Neural2-C · 남성'], ['ko-KR-Wavenet-A', 'Wavenet-A · 여성'], ['ko-KR-Wavenet-B', 'Wavenet-B · 여성'], ['ko-KR-Wavenet-C', 'Wavenet-C · 남성'], ['ko-KR-Wavenet-D', 'Wavenet-D · 남성'], ['ko-KR-Standard-A', 'Standard-A · 여성'], ['ko-KR-Standard-C', 'Standard-C · 남성']],
  openai: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'].map(v => [v, v]),
  eleven: [['EXAVITQu4vr4xnSDxMaL', 'Sarah (기본)'], ['21m00Tcm4TlvDq8ikWAM', 'Rachel'], ['pNInz6obpgDQGcFmaJgB', 'Adam']],
};
function initTts() {
  const prov = $('#ttsProv'), key = $('#ttsKey'), voice = $('#ttsVoice'), vsel = $('#ttsVoiceSel');
  const load = () => {
    const p = prov.value; key.style.display = p === 'browser' || p === 'local' ? 'none' : ''; voice.style.display = 'none'; vsel.style.display = 'none'; $('#ttsRegion').style.display = p === 'azure' ? '' : 'none'; $('#ttsToneRow').style.display = p === 'local' ? '' : 'none';
    key.value = ls.get('clipforge:key:' + p) || ''; voice.value = ls.get('clipforge:voice:' + p) || TTS_DEFAULT_VOICE[p]; fillVoices(p);
    voice.placeholder = p === 'google' ? '목소리 (ko-KR-Neural2-A/B/C, ko-KR-Wavenet-A~D …)' : p === 'azure' ? '목소리 (ko-KR-SunHiNeural, ko-KR-InJoonNeural, ko-KR-HyunsuMultilingualNeural …)' : p === 'openai' ? '목소리 (alloy, coral, nova, onyx, shimmer …)' : p === 'eleven' ? 'ElevenLabs voice_id' : '브라우저 음성 이름 (비우면 한국어 기본)';
  };
  const fillVoices = (p) => {
    if (p === 'local') { vsel.style.display = voice.style.display = 'none'; return; }
    let list = VOICES[p] || [];
    if (p === 'browser') { const vs = (window.speechSynthesis ? speechSynthesis.getVoices() : []).slice().sort((a, b) => (b.lang.startsWith('ko') - a.lang.startsWith('ko')) || a.name.localeCompare(b.name)); list = vs.map(v => [v.name, `${v.name} (${v.lang})`]); }
    vsel.innerHTML = ''; for (const [v, n] of list) vsel.append(h('option', { value: v }, n)); vsel.append(h('option', { value: '__custom__' }, '직접 입력…'));
    vsel.value = list.some(x => x[0] === voice.value) ? voice.value : (p === 'browser' && !voice.value && list.length ? list[0][0] : '__custom__');
    if (vsel.value !== '__custom__') voice.value = vsel.value;
    vsel.style.display = ''; voice.style.display = vsel.value === '__custom__' ? '' : 'none';
  };
  vsel.onchange = () => { if (vsel.value === '__custom__') { voice.style.display = ''; voice.focus(); } else { voice.value = vsel.value; voice.style.display = 'none'; ls.set('clipforge:voice:' + prov.value, voice.value); } };
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { if (prov.value === 'browser') fillVoices('browser'); };
  prov.value = ls.get('clipforge:prov') || 'local'; load();
  prov.onchange = () => { ls.set('clipforge:prov', prov.value); load(); };
  key.onchange = () => ls.set('clipforge:key:' + prov.value, key.value.trim());
  voice.onchange = () => ls.set('clipforge:voice:' + prov.value, voice.value.trim());
  $('#ttsRegion').value = ls.get('clipforge:region') || 'koreacentral'; $('#ttsRegion').onchange = () => ls.set('clipforge:region', $('#ttsRegion').value.trim());
  const info = (s) => { $('#ttsInfo').textContent = s; };
  const run = async (jobs) => {
    if (prov.value === 'browser') { for (const j of jobs) await speakBrowser(j.text); return info('브라우저 내장 음성은 미리듣기만 가능합니다. 타임라인/내보내기에는 OpenAI 또는 ElevenLabs를 사용하세요.'); }
    if (prov.value !== 'local' && !key.value.trim()) return toast('API 키를 입력하세요');
    $('#btnTts').disabled = $('#btnTtsSel').disabled = $('#btnTtsAll').disabled = true;
    try {
      for (let i = 0; i < jobs.length; i++) {
        info(`생성 중… ${i + 1}/${jobs.length}`);
        const local = prov.value === 'local';
        const blob = local ? await ttsLocal(jobs[i].text, info, +$('#ttsTone').value) : await ttsFetch(prov.value, key.value.trim(), voice.value.trim() || TTS_DEFAULT_VOICE[prov.value], jobs[i].text, +$('#ttsSpeed').value);
        const m = await addMedia(new File([blob], `AI음성 ${jobs[i].text.slice(0, 12)}.${local ? 'wav' : 'mp3'}`, { type: local ? 'audio/wav' : 'audio/mpeg' }));
        if (m && local && +$('#ttsSpeed').value !== 1) toast('속도는 생성 후 클립 속성의 속도로 조절하세요');
        if (m) addMediaToTimeline(m.id, { start: jobs[i].start });
      }
      info('완료. 파형이 보이면 사용할 수 있습니다.');
    } catch (e) { info('실패: ' + e.message); toast('음성 생성 실패'); }
    $('#btnTts').disabled = $('#btnTtsSel').disabled = $('#btnTtsAll').disabled = false;
  };
  $('#btnTtsSample').onclick = async () => {
    const p = prov.value, v = voice.value.trim() || TTS_DEFAULT_VOICE[p], ko = !/^(en|ja|zh)/i.test(v), text = ko ? '안녕하세요. 목소리 샘플입니다.' : /^ja/i.test(v) ? 'こんにちは。音声サンプルです。' : /^zh/i.test(v) ? '你好，这是语音示例。' : 'Hello, this is a voice sample.';
    if (p !== 'local' && p !== 'browser' && !key.value.trim()) return toast('API 키를 입력하세요');
    try {
      info('샘플 생성 중…');
      if (p === 'browser') { await speakBrowser(text); info('샘플 재생 완료'); return; }
      const blob = p === 'local' ? await ttsLocal(text, info, +$('#ttsTone').value) : await ttsFetch(p, key.value.trim(), v, text, +$('#ttsSpeed').value);
      const a = new Audio(URL.createObjectURL(blob)); a.play(); info('샘플 재생 중 — 마음에 들면 아래 생성 버튼을 누르세요');
    } catch (e) { info('샘플 실패: ' + e.message); }
  };
  $('#btnTts').onclick = () => { const s = $('#ttsText').value.trim(); if (s) run([{ text: s, start: t }]); else toast('문장을 입력하세요'); };
  $('#btnTtsSel').onclick = () => { const c = selClip(); if (!c || !c.text || c.type !== 'text') return toast('텍스트 클립을 선택하세요'); run([{ text: c.text.content, start: c.start }]); };
  $('#btnTtsAll').onclick = () => { const cs = allClips().filter(c => c.type === 'text').sort((a, b) => a.start - b.start); if (!cs.length) return toast('텍스트 클립이 없습니다'); run(cs.map(c => ({ text: c.text.content, start: c.start }))); };
}
// ── 키 없는 로컬 TTS: transformers.js + MMS-TTS(한국어), 브라우저 안에서 실행 ──
let localTtsP = null;
const HG = { L: ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'],
  V: ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'],
  T: ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'] };
const HG_T_INIT = { 1: 0, 2: 1, 7: 2, 17: 7, 19: 9, 20: 10, 22: 12, 23: 14, 24: 15, 25: 16, 26: 17, 27: 18 }; // 받침 -> 다음 음절 초성 인덱스(연음)
function romanize(text) {
  const out = []; const chars = [...text];
  const dec = (ch) => { const n = ch.charCodeAt(0) - 0xAC00; return n >= 0 && n < 11172 ? { l: Math.floor(n / 588), v: Math.floor((n % 588) / 28), t: n % 28 } : null; };
  for (let i = 0; i < chars.length; i++) {
    const a = dec(chars[i]); if (!a) { out.push(/[A-Za-z0-9 ,.!?']/.test(chars[i]) ? chars[i].toLowerCase() : /\s/.test(chars[i]) ? ' ' : ''); continue; }
    const nx = chars[i + 1] ? dec(chars[i + 1]) : null; let tail = HG.T[a.t], moved = '';
    if (a.t && nx && nx.l === 11 && HG_T_INIT[a.t] != null) { moved = HG.L[HG_T_INIT[a.t]]; tail = ''; }
    out.push((a.l === 11 ? '' : HG.L[a.l]) + HG.V[a.v] + tail);
    if (moved) { chars[i + 1] = String.fromCharCode(0xAC00 + (HG_T_INIT[a.t] * 21 + nx.v) * 28 + nx.t); }
  }
  return out.join('').replace(/ +/g, ' ').trim();
}
async function ttsLocal(text, info, tone = 1) {
  if (!localTtsP) localTtsP = (async () => {
    info('AI 모델 불러오는 중… (처음 한 번 약 40MB 다운로드)');
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/+esm');
    return pipeline('text-to-speech', 'Xenova/mms-tts-kor', { progress_callback: (p) => { if (p.status === 'progress') info(`모델 다운로드 ${Math.round(p.progress || 0)}% (${p.file || ''})`); } });
  })().catch(e => { localTtsP = null; throw new Error('모델 로드 실패 (인터넷 연결 필요): ' + e.message); });
  const tts = await localTtsP, parts = text.split(/[.!?。\n]+/).map(s => s.trim()).filter(Boolean), chunks = []; let sr = 16000;
  const peakOf = (a) => { let m = 0; for (let i = 0; i < a.length; i += 7) m = Math.max(m, Math.abs(a[i])); return m; };
  let usedRaw = false;
  for (const p of parts) {
    info('음성 합성 중… ' + p.slice(0, 20));
    let r = await tts(romanize(p)), a = r.audio && r.audio.data ? r.audio.data : r.audio;
    if (!a || !a.length || peakOf(a) < 0.02) {   // 로마자 입력이 무음이면 한글 원문으로 재시도
      r = await tts(p); a = r.audio && r.audio.data ? r.audio.data : r.audio; usedRaw = true;
    }
    if (!a || !a.length || peakOf(a) < 0.02) throw new Error('모델이 소리를 만들지 못했습니다 (무음 출력). 다른 방식(OpenAI/ElevenLabs)을 사용해 주세요');
    sr = r.sampling_rate; chunks.push(Float32Array.from(a), new Float32Array(Math.round(sr * 0.25)));
  }
  if (usedRaw) info('한글 원문 입력 방식으로 합성했습니다');
  const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0)); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  if (Math.abs(tone - 1) > 0.01) {   // 톤 변경: 리샘플링 (음높이와 속도가 함께 바뀜)
    const n = Math.floor(all.length / tone), out = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * tone, i0 = Math.floor(x), f = x - i0; out[i] = all[i0] * (1 - f) + (all[Math.min(all.length - 1, i0 + 1)] * f); }
    return wavBlob({ getChannelData: () => out, sampleRate: sr });
  }
  return wavBlob({ getChannelData: () => all, sampleRate: sr });
}
async function ttsFetch(p, key, voice, text, speed) {
  let res;
  if (p === 'openai') res = await fetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: text, speed, response_format: 'mp3' }) });
  else if (p === 'google') {
    const lang = voice.split('-').slice(0, 2).join('-') || 'ko-KR';
    res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: { text }, voice: { languageCode: lang, name: voice }, audioConfig: { audioEncoding: 'MP3', speakingRate: speed } }) });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
    const j = await res.json(), bin = atob(j.audioContent), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: 'audio/mpeg' });
  } else if (p === 'azure') {
    const region = ($('#ttsRegion').value || 'koreacentral').trim(), esc2 = (x) => x.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])), lang = voice.split('-').slice(0, 2).join('-') || 'ko-KR';
    const ssml = `<speak version="1.0" xml:lang="${lang}" xmlns="http://www.w3.org/2001/10/synthesis"><voice name="${voice}"><prosody rate="${Math.round((speed - 1) * 100)}%">${esc2(text)}</prosody></voice></speak>`;
    res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' }, body: ssml });
  }
  else res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { speed } }) });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
  return await res.blob();
}
function speakBrowser(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { toast('이 브라우저는 음성 합성을 지원하지 않습니다'); return resolve(); }
    const u = new SpeechSynthesisUtterance(text), want = $('#ttsVoice').value.trim(), vs = speechSynthesis.getVoices();
    u.voice = vs.find(v => want && v.name.includes(want)) || vs.find(v => v.lang.startsWith('ko')) || null; u.lang = u.voice ? u.voice.lang : 'ko-KR'; u.rate = +$('#ttsSpeed').value;
    u.onend = u.onerror = resolve; speechSynthesis.speak(u);
  });
}

// ───────────── 내보내기 ─────────────
let exportCancelled = false, exportRec = null, exportChunks = [], exportMime = '';
async function startExport() {
  if (!total()) return toast('타임라인이 비어 있습니다');
  if (!window.MediaRecorder) return toast('이 브라우저는 내보내기를 지원하지 않습니다 (Chrome/Edge 권장)');
  pause(); ensureAudio(); await actx.resume();
  exportMime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  const stream = new MediaStream([...cv.captureStream(project.fps).getVideoTracks(), ...streamDest.stream.getAudioTracks()]);
  exportChunks = []; exportCancelled = false;
  exportRec = new MediaRecorder(stream, { mimeType: exportMime, videoBitsPerSecond: Math.round(cv.width * cv.height * project.fps * 0.15) });
  exportRec.ondataavailable = e => { if (e.data.size) exportChunks.push(e.data); };
  exportRec.onstop = () => {
    exporting = null; $('#overlay').hidden = true;
    try { master.connect(actx.destination); } catch { }
    if (exportCancelled) return toast('내보내기 취소됨');
    const ext = exportMime.includes('mp4') ? 'mp4' : 'webm', type = exportMime.split(';')[0] || 'video/webm', name = `${project.name}.${ext}`, blob = new Blob(exportChunks, { type });
    if (IS_IOS || (navigator.canShare && 'ontouchstart' in window)) {
      $('#overlay').hidden = false; $('#ovTitle').textContent = '내보내기 완료'; $('#ovInfo').textContent = `${name} (${(blob.size / 1e6).toFixed(1)}MB) — 버튼을 눌러 저장/공유하세요`; $('#ovBar').style.width = '100%';
      const sv = $('#ovSave'); sv.hidden = false; $('#ovCancel').textContent = '닫기';
      sv.onclick = async () => { try { const f = new File([blob], name, { type }); if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: project.name }); else download(blob, name); } catch (e) { if (e.name !== 'AbortError') download(blob, name); } };
    } else { download(blob, name); toast('내보내기 완료: ' + name); }
  };
  try { master.disconnect(actx.destination); } catch { }
  exporting = true; t = 0; $('#ovSave').hidden = true; $('#ovCancel').textContent = '취소'; $('#overlay').hidden = false; $('#ovTitle').textContent = `내보내는 중… (${cv.width}×${cv.height})`;
  syncMedia(); await sleep(600);
  exportRec.start(500); play();
}
function finishExport() { pause(); setTimeout(() => { if (exportRec && exportRec.state !== 'inactive') exportRec.stop(); }, 400); }
$('#ovCancel').onclick = () => { if (!exporting) { $('#overlay').hidden = true; return; } exportCancelled = true; pause(); if (exportRec && exportRec.state !== 'inactive') exportRec.stop(); };

// ───────────── 프로젝트 파일 ─────────────
function loadProject(p) {
  project = Object.assign(newProject(), p); project.mediaNames = project.mediaNames || {}; project.tracks.forEach(tr => tr.clips = tr.clips.map(c => Object.assign(mkClip(c.type), c)));
  for (const [id, nm] of Object.entries(project.mediaNames)) if (!media.has(id)) missing[id] = nm;
  sel = null; t = 0; hist = []; hi = -1; pushHist(); syncTopbar(); resizeCanvas(); refresh();
  const ms = Object.values(missing); if (ms.length) toast('누락된 미디어를 다시 가져오세요(파일명 일치 시 자동 연결): ' + ms.slice(0, 3).join(', '));
}
function syncTopbar() { $('#pname').value = project.name; $('#ratio').value = project.ratio; $('#res').value = project.res; }
function setSheet(v) { document.body.dataset.sheet = v || ''; setTimeout(fitStage, 50); }

// ───────────── 이벤트 연결 ─────────────
function initMobileBar() {
  $$('#mbar button').forEach(b => b.onclick = () => {
    const p = b.dataset.p, cur = document.body.dataset.sheet;
    if (p === 'insp') { setSheet(cur === 'insp' ? '' : 'insp'); }
    else { $$('.ltab,.lpanel').forEach(x => x.classList.remove('on')); $(`.ltab[data-p="${p}"]`).classList.add('on'); $('#p-' + p).classList.add('on'); setSheet(cur === 'left' && b.classList.contains('on') ? '' : 'left'); }
    $$('#mbar button').forEach(x => x.classList.toggle('on', x === b && document.body.dataset.sheet !== ''));
  });
  $$('.sheet-x').forEach(x => x.onclick = () => { setSheet(''); $$('#mbar button').forEach(b => b.classList.remove('on')); });
}
function init() {
  try { initMobileBar(); } catch (e) { console.error(e); }
  try { initPanels(); } catch (e) { console.error(e); toast('일부 기능 초기화 실패: ' + e.message); }
  $('#bPlay').onclick = () => playing ? pause() : play();
  $('#bStart').onclick = () => { pause(); seek(0); }; $('#bEnd').onclick = () => { pause(); seek(total()); };
  $('#bPrev').onclick = () => { pause(); seek(t - 1 / project.fps); }; $('#bNext').onclick = () => { pause(); seek(t + 1 / project.fps); };
  $('#bFull').onclick = () => $('#cvwrap').requestFullscreen?.();
  $('#mvol').oninput = (e) => { if (master) master.gain.value = e.target.value / 100; };
  $('#pname').onchange = (e) => { project.name = e.target.value || '제목 없음'; autosave(); };
  $('#ratio').onchange = (e) => { project.ratio = e.target.value; resizeCanvas(); commit(); };
  $('#res').onchange = (e) => { project.res = +e.target.value; resizeCanvas(); commit(); };
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
  $('#btnExport').onclick = startExport;
  $('#btnPng').onclick = () => { drawFrame(); cv.toBlob(b => download(b, `${project.name}_${fmt(t).replace(':', '-')}.png`)); };
  $('#btnSave').onclick = () => download(new Blob([snapshot()], { type: 'application/json' }), project.name + '.clipforge.json');
  $('#btnOpen').onclick = () => $('#projIn').click();
  $('#projIn').onchange = async (e) => { const f = e.target.files[0]; if (f) { try { loadProject(JSON.parse(await f.text())); } catch { toast('프로젝트 파일이 올바르지 않습니다'); } } e.target.value = ''; };
  $('#btnNew').onclick = () => { if (confirm('새 프로젝트를 만들까요? (현재 편집 내용은 자동 저장본에서만 복구 가능)')) { project = newProject(); sel = null; t = 0; hist = []; hi = -1; pushHist(); syncTopbar(); resizeCanvas(); pruneEls(); refresh(); autosave(); } };
  $('#tSplit').onclick = () => splitClip(); $('#tDel').onclick = () => deleteClip(); $('#tRipple').onclick = () => deleteClip(true); $('#tDup').onclick = dupClip; $('#tFreeze').onclick = freezeFrame; $('#tMark').onclick = addMarker;
  $('#btnClean').onclick = cleanUnused;
  $('#tFromStart').onclick = trimToStart; $('#tFromHere').onclick = trimFromHere; $('#tToHere').onclick = trimToHere; $('#tToEnd').onclick = trimToEnd;
  document.addEventListener('pointerdown', (e) => { delTarget = e.target.closest('#mediaGrid') ? 'media' : 'clip'; }, true);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
  $('#tAddV').onclick = () => addTrack('video'); $('#tAddA').onclick = () => addTrack('audio');
  $('#zoom').oninput = (e) => { pps = +e.target.value; renderTimeline(); };
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input[type=text],input[type=number],textarea,select') || (e.target.tagName === 'INPUT' && e.target.type === 'text')) return;
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (k === ' ') { e.preventDefault(); playing ? pause() : play(); }
    else if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (ctrl && k === 'y') { e.preventDefault(); redo(); }
    else if (ctrl && k === 'd') { e.preventDefault(); dupClip(); }
    else if (ctrl && k === 'c') { const c = selClip(); if (c) clipboard = JSON.parse(JSON.stringify(c)); }
    else if (ctrl && k === 'v' && clipboard) { const b = JSON.parse(JSON.stringify(clipboard)); b.id = uid(); b.start = t; placeClip(b); sel = b.id; commit(); buildInspector(); }
    else if (k === 's' && !ctrl) splitClip();
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); if (delTarget === 'media' && selMedia) removeMedia(selMedia); else deleteClip(e.shiftKey); }
    else if (k === 'm') addMarker();
    else if (k === 'arrowleft') { pause(); seek(t - (e.shiftKey ? 1 : 1 / project.fps)); }
    else if (k === 'arrowright') { pause(); seek(t + (e.shiftKey ? 1 : 1 / project.fps)); }
    else if (k === 'home') { pause(); seek(0); } else if (k === 'end') { pause(); seek(total()); }
    else if (k === '=' || k === '+') { pps = clamp(pps * 1.25, 10, 300); $('#zoom').value = pps; renderTimeline(); }
    else if (k === '-') { pps = clamp(pps / 1.25, 10, 300); $('#zoom').value = pps; renderTimeline(); }
  });
  resizeCanvas(); pushHist(); refresh(); requestAnimationFrame(tick);
  restoreSession();
}
async function restoreSession() {
  try {
    const recs = await idbAll();
    for (const r of recs) await addMedia(r.blob, { id: r.id, name: r.name, durOverride: r.type === 'audio' ? r.dur : undefined, persist: false });
    const saved = localStorage.getItem('clipforge:project');
    if (saved) { const p = JSON.parse(saved); if (p.tracks.some(x => x.clips.length)) { loadProject(p); toast('이전 작업을 복원했습니다'); } }
  } catch { }
}
init();
window.__cf = { get project() { return project; }, media, addMedia, addMediaToTimeline, addText, addShape, addSticker, splitClip, play, pause, seek, get t() { return t; }, startExport, commit, refresh, get sel() { return sel; }, set sel(v) { sel = v; }, mkClip, placeClip, defText };
window.__cf.separateStems = separateStems; window.__cf.playNodesCount = () => playNodes.length; window.__cf.get = (k) => ({ HAS_FILTER, IS_IOS })[k];
