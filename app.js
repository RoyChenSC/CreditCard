// 刷哪張：個人信用卡回饋查詢（純 HTML/CSS/JS PWA）
// 資料：data.js（預設）→ 使用者修改存 localStorage；計算：engine.js；畫面：本檔
const VERSION = '1.4.1';
const STORAGE_KEY = 'ccr-v1';
const BACKUP_KEY = 'ccr-last-backup';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shortDate = (k) => (k ? `${+k.slice(5, 7)}/${+k.slice(8, 10)}` : '');
const fullDate = (k) => (k ? k.replaceAll('-', '/') : '');

/* ================= 資料 ================= */
const blankSettings = () => ({
  enabled: CARDS.map((c) => c.id),
  levels: { 'cathay-cube': 1 },
  plans: { 'taishin-richart': 'daily', 'cathay-cube': 'select' },
  autoDebits: { 'taishin-richart': true },   // 各卡是否設定該行帳戶自動扣繳卡費
  fees: {}, feesCur: {},
  registered: [],
  allPlans: true,     // 比較所有可切換方案（提示需切換）
  showRef: true,      // 沒有已驗證資料時，顯示待驗證參考值
  soonDays: 30,       // 即將到期提醒
  staleDays: 30,      // 已驗證資料超過幾天沒確認 → 需重新確認（每月確認）
});
const blank = () => ({ settings: blankSettings(), offers: null, programs: null, ver: 2 });
const PROGRAMS_DEFAULT = JSON.parse(JSON.stringify(PROGRAMS));

/** 舊版設定轉成目前格式（本機資料與匯入的備份共用） */
function migrateSettings(raw, ver) {
  const s = { ...blankSettings(), ...(raw || {}) };
  // v1.0 舊格式：autoDebit（只代表 Richart）→ autoDebits
  if (typeof s.autoDebit === 'boolean') { s.autoDebits = { ...s.autoDebits, 'taishin-richart': s.autoDebit }; delete s.autoDebit; }
  // v1.4：每週確認改每月確認 → 舊預設 7 天改成 30 天
  if ((ver || 1) < 2 && s.staleDays === 7) s.staleDays = 30;
  return s;
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!d || typeof d !== 'object') return blank();
    return { ...blank(), ...d, settings: migrateSettings(d.settings, d.ver), ver: 2 };
  } catch (e) { return blank(); }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { toast('儲存失敗（空間不足？）'); }
}
function applyPrograms() {
  const p = data.programs || PROGRAMS_DEFAULT;
  Object.keys(PROGRAMS_DEFAULT).forEach((k) => { PROGRAMS[k] = JSON.parse(JSON.stringify(p[k] || PROGRAMS_DEFAULT[k])); });
}
let data = load();
applyPrograms();
const S = () => data.settings;
const offers = () => data.offers || DEFAULT_OFFERS;
function saveOffers(list) { data.offers = list; persist(); }
function saveProgram(key, patch) {
  const p = data.programs || JSON.parse(JSON.stringify(PROGRAMS_DEFAULT));
  p[key] = { ...p[key], ...patch };
  data.programs = p; applyPrograms(); persist();
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ================= 共用小元件 ================= */
const cdot = (card) => `<span class="cdot" style="--c:${card.color}"></span>`;
function statusPill(o) {
  const st = effStatus(o);
  if (isStale(o, S())) return '<span class="pill stale">需確認</span>';
  return `<span class="pill ${st}">${STATUS[st]}</span>`;
}
function soonPill(o) {
  const d = daysLeft(o);
  return expiringSoon(o, S().soonDays) ? `<span class="pill soon">${d === 0 ? '今天到期' : `剩 ${d} 天`}</span>` : '';
}
const rateHtml = (ev, formal) => `<span class="rate ${formal ? 'ok' : 'ref'}">${fmtRate(ev.rate)}</span>`;
/** 需要每月確認的優惠：仍有效，且從沒確認過或超過 staleDays 天 */
const needsCheck = (o) => isLive(o) && (!o.lastVerified || daysBetween(o.lastVerified, todayKey()) > S().staleDays);
const staleVerified = () => offers().filter((o) => isStale(o, S()));
const programList = () => Object.entries(PROGRAMS).map(([key, p]) => ({ key, p }));

/* ================= 查詢 ================= */
let query = '';
let cat = 'all';
let openMerchant = null;

function renderPlans() {
  $('#plans').innerHTML = CARDS.filter((c) => c.plans && S().enabled.includes(c.id)).map((c) => {
    const lv = c.levels ? ` · L${S().levels[c.id] || c.levels[0]}` : '';
    return `<button data-plan="${c.id}">${esc(c.shortName)}：<b>${esc(planName(c.id, S().plans[c.id]))}</b>${lv} ▾</button>`;
  }).join('');
}
function renderWeekTip() {
  const stale = staleVerified().length;
  const verified = offers().filter((o) => effStatus(o) === 'verified').length;
  const tip = $('#weekTip');
  const changed = report && !reportHandled() && (report.changes || []).length && daysBetween(report.checkedAt.slice(0, 10), todayKey()) <= 8 ? report.changes.length : 0;
  if (changed) tip.textContent = `⚠ 官方頁面有 ${changed} 項變動（${shortDate(report.checkedAt.slice(0, 10))} 檢查）→ 去確認`;
  else if (stale) tip.textContent = `⚠ ${stale} 筆優惠超過 ${S().staleDays} 天沒確認，已暫停推薦 → 去確認`;
  else if (!verified) tip.textContent = '目前沒有已驗證的優惠，結果只供參考 → 去確認';
  tip.hidden = !(changed || stale || !verified);
  $('#dataDot').hidden = !(stale || changed);
}
function bestHtml(ev, label) {
  if (!ev) return '';
  return `${label ? `<span class="muted">${label} </span>` : ''}${esc(ev.card.shortName)}`;
}
function renderSearch() {
  renderWeekTip();
  renderPlans();
  $('#cats').innerHTML = [{ id: 'all', name: '全部' }, ...CATEGORIES]
    .map((c) => `<button class="chip ${cat === c.id ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');
  const q = query.trim().toLowerCase();
  const list = MERCHANTS.filter((m) => (cat === 'all' || m.categoryId === cat)
    && (!q || [m.name, m.categoryName, ...(m.aliases || [])].some((s) => s.toLowerCase().includes(q))));
  if (!list.length) { $('#results').innerHTML = '<div class="empty">找不到這家商店</div>'; return; }
  $('#results').innerHTML = list.map((m) => {
    const r = rankMerchant(m, offers(), S());
    let right, second = '';
    if (r.best) {
      right = `${bestHtml(r.best)}${rateHtml(r.best, true)}`;
      if (r.second) second = `次佳 ${esc(r.second.card.shortName)} ${fmtRate(r.second.rate)}`;
      if (r.best.switchTo) second = `需切到「${esc(r.best.switchTo)}」` + (second ? ` · ${second}` : '');
    } else if (S().showRef && r.refBest) {
      right = `<span class="muted">參考 </span>${esc(r.refBest.card.shortName)}${rateHtml(r.refBest, false)}`;
      second = r.refBest.switchTo ? `需切到「${esc(r.refBest.switchTo)}」・待驗證` : '待驗證';
    } else right = '<span class="muted">待確認</span>';
    const open = openMerchant === m.id;
    return `<div class="res">
      <button class="res-head" data-m="${m.id}" aria-expanded="${open}">
        <span class="res-name">${esc(m.name)}</span><span class="res-best">${right}</span>
        <span class="res-cat">${esc(m.categoryName)}</span><span class="res-second">${second}</span>
      </button>
      ${open ? `<div class="res-body">${merchantBody(r)}</div>` : ''}
    </div>`;
  }).join('');
}
function merchantBody(r) {
  const lines = r.list.map((a) => {
    const ev = a.formal || a.reference;
    const o = ev.offer;
    if (!o) return `<div class="cardline"><div class="cl-top">${cdot(a.card)}<span class="grow">${esc(a.card.shortName)}</span><span class="muted">資料不足</span></div></div>`;
    const sub = [esc(o.title), describeCap(o.rewardCap), o.endDate ? `到 ${shortDate(o.endDate)}` : ''].filter(Boolean).join(' · ');
    const warn = [...ev.missing, ...(ev.hint ? [ev.hint] : [])].length ? `<br><span class="warn">${esc([...ev.missing, ...(ev.hint ? [ev.hint] : [])].join('、'))}</span>` : '';
    return `<div class="cardline">
      <div class="cl-top">${cdot(a.card)}<span class="grow">${esc(a.card.shortName)}</span>
        ${ev.switchTo ? `<span class="pill plan">切到 ${esc(ev.switchTo)}</span>` : ''}${statusPill(o)}${rateHtml(ev, ev.formal)}</div>
      <div class="cl-sub">${sub}${warn}</div>
      <div class="linkrow"><a href="#" data-detail="${esc(o.id)}">條件</a>${o.sourceUrl ? `<a href="${esc(o.sourceUrl)}" target="_blank" rel="noopener">官方頁面</a>` : '<span class="muted">無官方來源</span>'}
        ${a.ineligible.length ? `<span class="muted">另 ${a.ineligible.length} 筆不適用</span>` : ''}</div>
    </div>`;
  }).join('');
  return lines + `<div class="linkrow" style="margin-top:10px"><button class="btn ghost" data-calc="${r.merchant.id}">試算這家</button></div>`;
}

$('#q').addEventListener('input', (e) => { query = e.target.value; openMerchant = null; renderSearch(); });
$('#cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; openMerchant = null; renderSearch(); } });
$('#weekTip').addEventListener('click', () => switchTab('data'));
$('#plans').addEventListener('click', (e) => { const b = e.target.closest('[data-plan]'); if (b) openPlanSheet(b.dataset.plan); });
$('#results').addEventListener('click', (e) => {
  const d = e.target.closest('[data-detail]');
  if (d) { e.preventDefault(); openDetail(d.dataset.detail); return; }
  const c = e.target.closest('[data-calc]');
  if (c) { calc.merchant = c.dataset.calc; const m = MERCHANT[calc.merchant]; calc.country = m.country; calc.payment = m.defaultPaymentMethod || 'physical'; calcMode = 'buy'; switchTab('calc'); return; }
  const h = e.target.closest('[data-m]');
  if (h) { openMerchant = openMerchant === h.dataset.m ? null : h.dataset.m; renderSearch(); }
});

function openPlanSheet(cardId) {
  const c = CARD[cardId];
  const body = () => `
    ${c.levels ? `<div class="card-title">等級</div><div class="seg">${c.levels.map((l) => `<button data-lv="${l}" class="${(S().levels[c.id] || c.levels[0]) === l ? 'on' : ''}">Level ${l}</button>`).join('')}</div>
      <div class="hint">只套用該等級的回饋資料，未升級前請勿選 Level 2。</div>` : ''}
    <div class="card-title" style="margin-top:14px">目前方案</div>
    <div class="chips">${c.plans.map((p) => `<button class="chip ${S().plans[c.id] === p.id ? 'on' : ''}" data-p="${p.id}">${esc(p.name)}</button>`).join('')}</div>
    <div class="hint">${esc((c.plans.find((p) => p.id === S().plans[c.id]) || {}).switchReminder || '')}</div>`;
  openSheet(`${c.shortName} 方案`, body(), null, null, (e) => {
    const p = e.target.closest('[data-p]'), l = e.target.closest('[data-lv]');
    if (p) S().plans[c.id] = p.dataset.p;
    else if (l) S().levels[c.id] = +l.dataset.lv;
    else return;
    persist(); $('#sheetBody').innerHTML = body(); renderSearch();
  });
}

/* ================= 試算 ================= */
let calcMode = 'buy';
const calc = { merchant: 'pxmart', amount: 1000, country: 'TW', payment: 'pxpay', reg: 'auto', trips: 44, fare: 25, fuel: 2000, price: 30 };

function merchantOptions(sel) {
  return CATEGORIES.map((c) => `<optgroup label="${esc(c.name)}">${c.merchants.map((m) => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>`).join('');
}
function renderCalc() {
  $$('#calcSeg button').forEach((b) => b.classList.toggle('on', b.dataset.m === calcMode));
  const f = $('#calcForm');
  if (calcMode === 'buy') {
    f.innerHTML = `<div class="card form">
      <div class="full"><label>商店</label><select class="field" data-c="merchant">${merchantOptions(calc.merchant)}</select></div>
      <div class="full"><label>金額（台幣）</label><input class="field" type="number" inputmode="decimal" min="0" data-c="amount" value="${calc.amount}">
        <div class="quick">${[100, 500, 1000, 3000, 10000].map((v) => `<button class="chip sm" data-amt="${v}">${v.toLocaleString()}</button>`).join('')}</div></div>
      <div><label>國家</label><select class="field" data-c="country">${Object.entries(COUNTRY).map(([k, v]) => `<option value="${k}" ${k === calc.country ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>付款方式</label><select class="field" data-c="payment">${PAYMENTS.filter((p) => !['easycard', 'jcard-balance'].includes(p.id)).map((p) => `<option value="${p.id}" ${p.id === calc.payment ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="full"><label>活動登錄</label><div class="seg">${[['auto', '依設定'], ['yes', '已登錄'], ['no', '未登錄']].map(([v, l]) => `<button data-reg="${v}" class="${calc.reg === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    </div>`;
  } else if (calcMode === 'metro') {
    f.innerHTML = `<div class="card form">
      <div><label>每月搭乘次數</label><input class="field" type="number" inputmode="numeric" min="0" data-c="trips" value="${calc.trips}"></div>
      <div><label>每趟平均車資</label><input class="field" type="number" inputmode="decimal" min="0" data-c="fare" value="${calc.fare}"></div>
      <div class="full hint" style="margin:0">Richart Life → 台新 Pay → QR 乘車碼 → Richart 卡；每趟算一筆、逐筆取整</div>
    </div>`;
  } else {
    f.innerHTML = `<div class="card form">
      <div><label>每月加油金額</label><input class="field" type="number" inputmode="numeric" min="0" data-c="fuel" value="${calc.fuel}"></div>
      <div><label>油價（元／公升）</label><input class="field" type="number" inputmode="decimal" min="0" step="0.1" data-c="price" value="${calc.price}"></div>
    </div>`;
  }
  renderCalcOut();
}
const money = (v, d = 0) => (v === null || v === undefined ? '—' : `${fmtMoney(v, d)} 元`);
const warnBox = (list) => (list.length ? `<div class="warn-box"><ul>${list.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div>` : '');

function renderCalcOut() {
  const out = $('#calcOut');
  if (calcMode === 'buy') {
    const amt = Number(calc.amount);
    if (!(amt > 0)) { out.innerHTML = '<div class="empty">請輸入金額</div>'; return; }
    const r = calcAll(MERCHANT[calc.merchant], amt, offers(), S(), { country: calc.country, payment: calc.payment, registered: calc.reg === 'auto' ? null : calc.reg === 'yes' });
    const formal = !!r.best;
    const kpi = (x, label) => (x
      ? `<div class="kpi ${formal ? 'hl' : 'ref'}"><div class="k">${label}${formal ? '' : '（待驗證）'}</div><div class="v">${cdot(x.card)}${esc(x.card.shortName)}</div>
         <div class="s">淨回饋 ${money(x.net, 1)}${x.precise ? '' : '・無法精確計算'}${x.switchTo ? `・切到 ${esc(x.switchTo)}` : ''}</div></div>`
      : `<div class="kpi"><div class="k">${label}</div><div class="v muted">待確認</div></div>`);
    out.innerHTML = `<div class="kpis">${kpi(formal ? r.best : r.refBest, '最佳')}${kpi(formal ? r.second : r.refSecond, '次佳')}</div>
      <div class="card">${r.results.map((x) => `<div class="calc-row">
        <div>${cdot(x.card)}<b>${esc(x.card.shortName)}</b> ${x.offer ? statusPill(x.offer) : ''} ${x.capHit ? '<span class="pill soon">已達上限</span>' : ''}
          <div class="cl-sub">${esc(x.offer ? x.offer.title : '沒有適用的優惠資料')} · ${fmtRate(x.rate)}</div></div>
        <div class="num"><div class="net ${x.formal ? 'rate ok' : ''}">${money(x.net, 1)}</div>
          <div class="cl-sub">回饋 ${money(x.reward, 1)}${x.fee ? ` − 手續費 ${money(x.fee, 1)}` : ''}</div></div>
        ${x.missing.length || x.hint ? `<div style="grid-column:1/-1">${warnBox([...x.missing, ...(x.hint ? [x.hint] : [])])}</div>` : ''}
      </div>`).join('')}</div>`;
  } else if (calcMode === 'metro') {
    const r = metroCalc(calc.trips, calc.fare, offers(), S());
    const cardTxt = r.cardLow === null ? '資料不足' : r.cardLow === r.cardHigh ? money(r.cardLow) : `${fmtMoney(r.cardLow)}～${money(r.cardHigh)}`;
    const totTxt = r.totalLow === null ? '無法計算' : r.totalLow === r.totalHigh ? money(r.totalLow) : `${fmtMoney(r.totalLow)}～${money(r.totalHigh)}`;
    const P = PROGRAMS.taipeiMetro;
    out.innerHTML = `<div class="kpis">
        <div class="kpi"><div class="k">每月車資</div><div class="v">${money(r.spend)}</div></div>
        <div class="kpi"><div class="k">台新卡回饋 ${fmtRate(r.ev.rate)}</div><div class="v">${cardTxt}</div></div>
        <div class="kpi"><div class="k">常客優惠 ${r.tier ? fmtRate(r.tier.rate) : ''}</div><div class="v">${r.metro === null ? '資料不足' : money(r.metro)}</div>
          <div class="s">${r.elig === true ? '依前月次數決定級距' : r.elig === null ? '支付方式資格未確認，未計入' : '此支付方式不適用'}</div></div>
        <div class="kpi ${r.precise ? 'hl' : 'ref'}"><div class="k">預估總回饋</div><div class="v">${totTxt}</div></div>
      </div>
      ${r.precise ? '' : `<div class="card"><div class="card-title">無法精確計算</div>${warnBox(r.missing)}</div>`}
      <div class="card"><div class="card-title">常客優惠級距 ${statusPill(P)}</div>
        <table class="tiers"><tr class="${r.tier ? '' : 'on'}"><td>${P.tiers[0].minTrips - 1} 次以下</td><td style="text-align:right">無回饋</td></tr>${P.tiers.map((t) => `<tr class="${r.tier === t ? 'on' : ''}"><td>${t.maxTrips === null ? `${t.minTrips} 次以上` : `${t.minTrips}～${t.maxTrips} 次`}</td><td style="text-align:right">${fmtRate(t.rate)}</td></tr>`).join('')}</table>
        <div class="hint">${esc(P.notes)}<br>確認日期：${fullDate(P.lastVerified) || '尚未確認'}${P.sourceUrl ? ` · <a href="${esc(P.sourceUrl)}" target="_blank" rel="noopener">官方頁面</a>` : ''}</div></div>`;
  } else {
    const r = cpcCalc(calc.fuel, calc.price, offers(), S());
    const P = PROGRAMS.cpcJcard;
    const rows = (list) => list.map((x) => `<div class="calc-row"><div>${cdot(x.card)}<b>${esc(x.card.shortName)}</b> ${x.offer ? statusPill(x.offer) : ''}<div class="cl-sub">${fmtRate(x.rate)}${x.precise ? '' : ' · 無法精確計算'}</div></div>
      <div class="num net">${money(x.reward, 1)}</div></div>`).join('');
    out.innerHTML = `<div class="kpis">
        <div class="kpi ${r.pathAPrecise ? 'hl' : 'ref'}"><div class="k">A 儲值捷利卡→餘額加油</div><div class="v">${money(r.pathA, 1)}</div>
          <div class="s">${r.bestTopup ? `儲值刷 ${esc(r.bestTopup.card.shortName)}` : ''}${r.discount === null ? '・捷利卡折扣資料不足' : ''}</div></div>
        <div class="kpi ${r.bestDirect && r.bestDirect.formal ? 'hl' : 'ref'}"><div class="k">B 直接刷卡加油</div><div class="v">${money(r.bestDirect ? r.bestDirect.reward : null, 1)}</div>
          <div class="s">${r.bestDirect ? esc(r.bestDirect.card.shortName) : ''}</div></div>
      </div>
      <div class="warn-box" style="margin:0 0 14px">捷利卡儲值是否算 Richart 天天刷加碼未確認，不會自動套用。</div>
      <div class="card"><div class="card-title">① 儲值（刷卡）</div>${rows(r.topup)}</div>
      <div class="card"><div class="card-title">② 捷利卡餘額付油費 ${statusPill(P)}</div>
        <div class="cl-sub">不產生信用卡回饋。自助加油每公升折 ${P.fuelDiscountPerLiter === null ? '資料不足' : `${P.fuelDiscountPerLiter} 元`}（約 ${r.liters.toFixed(1)} 公升，折 ${money(r.discount)}）；單筆儲值滿 ${fmtMoney(P.topupMin || 0)} 元 ${fmtRate(P.topupBonusRate)} 紅利（${money(r.bonus)}）</div>
        <div class="hint">${esc(P.notes)}${P.sourceUrl ? ` · <a href="${esc(P.sourceUrl)}" target="_blank" rel="noopener">官方頁面</a>` : ''}</div></div>
      <div class="card"><div class="card-title">③ 直接刷卡加油</div>${rows(r.direct)}</div>`;
  }
}
$('#calcSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { calcMode = b.dataset.m; renderCalc(); } });
$('#calcForm').addEventListener('input', (e) => {
  const k = e.target.dataset.c; if (!k) return;
  calc[k] = e.target.type === 'number' ? e.target.valueAsNumber : e.target.value;
  if (k === 'merchant') { const m = MERCHANT[calc.merchant]; calc.country = m.country; calc.payment = m.defaultPaymentMethod || 'physical'; renderCalc(); return; }
  renderCalcOut();
});
$('#calcForm').addEventListener('click', (e) => {
  const a = e.target.closest('[data-amt]'), g = e.target.closest('[data-reg]');
  if (a) { calc.amount = +a.dataset.amt; $('[data-c="amount"]').value = calc.amount; renderCalcOut(); }
  if (g) { calc.reg = g.dataset.reg; renderCalc(); }
});

/* ================= 優惠資料（每月確認） ================= */
let dataCard = 'all';
let stFilter = 'all';
const ST_FILTERS = [['all', '全部'], ['check', '待確認'], ['verified', '已驗證'], ['pending', '待驗證'], ['soon', '即將到期'], ['expired', '已過期'], ['invalid', '已失效']];

/* ---------- 每週自動檢查報告（雲端排程每週一寫到 GitHub 的 claude/weekly-report 分支） ---------- */
const REPORT_URL = 'https://raw.githubusercontent.com/RoyChenSC/CreditCard/claude/weekly-report/report.json';
const REPORT_KEY = 'ccr-report';
let report = null;
try { report = JSON.parse(localStorage.getItem(REPORT_KEY)); } catch (e) { report = null; }
async function loadReport() {
  if (location.protocol === 'file:') return;
  try {
    const r = await fetch(`${REPORT_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    if (!d || !d.checkedAt) return;
    report = d;
    try { localStorage.setItem(REPORT_KEY, JSON.stringify(d)); } catch (e) { /* 略過 */ }
    if ($('#sheet').hidden) renderCurrent();
  } catch (e) { /* 離線：沿用上次的報告 */ }
}
/** 網站資料（data.js）更新時間晚於報告 → 報告列出的變動已處理 */
const reportHandled = () => !!(report && typeof DATA_UPDATED !== 'undefined' && report.checkedAt <= DATA_UPDATED);
/** 報告中「官方頁面與目前資料一致」、且目前仍是已驗證、確認日期比報告舊的項目 */
function reportConfirmable() {
  if (!report || !Array.isArray(report.confirmedIds)) return [];
  const day = report.checkedAt.slice(0, 10);
  return report.confirmedIds.filter((id) => {
    if (id.startsWith('prog:')) { const p = PROGRAMS[id.slice(5)]; return p && p.status === 'verified' && (p.lastVerified || '') < day; }
    const o = offers().find((x) => x.id === id);
    return o && effStatus(o) === 'verified' && (o.lastVerified || '') < day;
  });
}
function reportHtml() {
  if (!report) return '';
  const day = report.checkedAt.slice(0, 10);
  const age = daysBetween(day, todayKey());
  const changes = report.changes || [], fails = report.unreachable || [];
  const can = reportConfirmable();
  const list = changes.map((c) => {
    const card = CARD[c.cardId];
    return `<div class="check-row"><span class="grow">${card ? cdot(card) : ''}<b>${esc(c.title || c.offerId || '')}</b>
      <span class="cl-sub" style="display:block">${esc(c.field || '')}：${esc(c.old ?? '—')} → <b>${esc(c.new ?? '—')}</b>${c.note ? `・${esc(c.note)}` : ''}${c.sourceUrl ? ` · <a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">官方頁面</a>` : ''}</span></span>
      ${c.offerId && offers().some((o) => o.id === c.offerId) ? `<button class="text-btn" data-edit="${esc(c.offerId)}">改</button>` : ''}</div>`;
  }).join('');
  return `<div class="card-title">官方頁面自動檢查（${shortDate(day)}${age > 8 ? '，已超過一週沒更新' : ''}）</div>
    ${changes.length && reportHandled() ? `<div class="cl-sub">這份報告的 ${changes.length} 項變動已更新到網站資料（${shortDate(DATA_UPDATED.slice(0, 10))}）✓</div>`
      : changes.length ? `<div class="warn-box" style="margin:0 0 6px">有 ${changes.length} 項和目前資料不同或待確認，請確認後修改</div>${list}`
      : (report.confirmedIds || []).length ? '<div class="cl-sub">讀到的官方頁面和目前資料一致 ✓</div>' : '<div class="warn-box" style="margin:0">這次沒有讀到官方頁面，無法比對，請手動確認</div>'}
    ${fails.length ? `<details class="hint"><summary>讀不到 ${fails.length} 個頁面（請手動確認）</summary>${fails.map((f) => `<div>・${esc(f)}</div>`).join('')}</details>` : ''}
    ${report.summary ? `<div class="hint">${esc(report.summary)}</div>` : ''}
    ${can.length ? `<button class="btn" style="width:100%;margin-top:10px" data-okall="1">✓ 依報告確認 ${can.length} 筆沒變動的優惠</button>` : ''}
    <div style="height:14px"></div>`;
}
function confirmFromReport() {
  const ids = reportConfirmable();
  if (!ids.length) return;
  const day = report.checkedAt.slice(0, 10);
  const set = new Set(ids);
  saveOffers(offers().map((o) => (set.has(o.id) ? { ...o, lastVerified: day } : o)));
  ids.filter((id) => id.startsWith('prog:')).forEach((id) => saveProgram(id.slice(5), { lastVerified: day }));
  toast(`已確認 ${ids.length} 筆`); renderData();
}

function renderWeekCard() {
  const stale = staleVerified();
  const progs = programList().filter(({ p }) => needsCheck(p));
  const pend = offers().filter((o) => effStatus(o) === 'pending').length;
  const row = (o, id, label) => `<div class="check-row"><span class="grow">${label}
      <span class="cl-sub" style="display:block">${fmtRate(offerRate(o))} · 上次確認 ${shortDate(o.lastVerified) || '—'}${o.sourceUrl ? ` · <a href="${esc(o.sourceUrl)}" target="_blank" rel="noopener">官方頁面</a>` : ''}</span></span>
      <button class="ok-btn" data-ok="${id}">✓ 仍正確</button><button class="text-btn" data-edit="${id}">改</button></div>`;
  const items = [
    ...stale.map((o) => row(o, o.id, `${cdot(CARD[o.cardId])}${esc(o.title)}`)),
    ...progs.filter(({ p }) => p.status === 'verified').map(({ key, p }) => row({ ...p, totalRate: null }, `prog:${key}`, esc(p.name))),
  ];
  $('#weekCard').innerHTML = `${reportHtml()}<div class="card-title">每月確認（每 ${S().staleDays} 天）</div>
    ${items.length ? items.join('') : `<div class="cl-sub">已驗證的優惠都在 ${S().staleDays} 天內確認過 ✓</div>`}
    <div class="hint">超過 ${S().staleDays} 天沒確認的優惠會暫停推薦。到官方頁面看過後按「✓ 仍正確」；有變動按「改」。${pend ? `<br>另有 ${pend} 筆待驗證：填入官方網址並改成「已驗證」後才會正式推薦。` : ''}</div>`;
}
function renderData() {
  renderWeekCard();
  $('#cardSeg').innerHTML = [['all', '全部'], ...CARDS.map((c) => [c.id, c.shortName])]
    .map(([v, l]) => `<button data-card="${v}" class="${dataCard === v ? 'on' : ''}">${esc(l)}</button>`).join('');
  $('#stFilter').innerHTML = ST_FILTERS.map(([v, l]) => `<button class="chip sm ${stFilter === v ? 'on' : ''}" data-st="${v}">${l}</button>`).join('');
  const list = offers().filter((o) => (dataCard === 'all' || o.cardId === dataCard) && (
    stFilter === 'all' ? true : stFilter === 'check' ? needsCheck(o) : stFilter === 'soon' ? expiringSoon(o, S().soonDays) : effStatus(o) === stFilter));
  $('#offerList').innerHTML = list.length ? `<div class="list">${list.map((o) => {
    const card = CARD[o.cardId];
    const meta = [fmtRate(offerRate(o)), planName(o.cardId, o.planId), o.level ? `L${o.level}` : '', o.endDate ? `到 ${shortDate(o.endDate)}` : ''].filter(Boolean).join(' · ');
    return `<button class="offer" data-detail="${esc(o.id)}">${cdot(card)}<span class="grow"><span class="t" style="display:block">${esc(o.title)}</span><span class="m">${esc(meta)}</span></span>${soonPill(o)}${statusPill(o)}</button>`;
  }).join('')}</div>` : '<div class="empty">沒有符合的優惠</div>';
  renderWeekTip();
}
function confirmOk(id) {
  const today = todayKey();
  if (id.startsWith('prog:')) { saveProgram(id.slice(5), { lastVerified: today }); }
  else {
    const o = offers().find((x) => x.id === id);
    if (!o) return;
    if (!o.sourceUrl) { toast('請先填官方網址'); openEditor(o.id); return; }
    saveOffers(offers().map((x) => (x.id === id ? { ...x, lastVerified: today } : x)));
  }
  toast('已確認'); renderData();
}
$('#weekCard').addEventListener('click', (e) => {
  const ok = e.target.closest('[data-ok]'), ed = e.target.closest('[data-edit]');
  if (e.target.closest('[data-okall]')) { confirmFromReport(); return; }
  if (ok) confirmOk(ok.dataset.ok);
  if (ed) { if (ed.dataset.edit.startsWith('prog:')) toast('北捷／捷利卡請修改 data.js 的 PROGRAMS'); else openEditor(ed.dataset.edit); }
});
$('#cardSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-card]'); if (b) { dataCard = b.dataset.card; renderData(); } });
$('#stFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (b) { stFilter = b.dataset.st; renderData(); } });
$('#offerList').addEventListener('click', (e) => { const b = e.target.closest('[data-detail]'); if (b) openDetail(b.dataset.detail); });
$('#addOffer').addEventListener('click', () => openEditor(null));

/* ---------- 優惠詳情 ---------- */
function detailHtml(o) {
  const card = CARD[o.cardId];
  const scope = o.merchantIds.length ? o.merchantIds.map((m) => (MERCHANT[m] || {}).name || m).join('、')
    : o.categoryId ? `${(CATEGORIES.find((c) => c.id === o.categoryId) || {}).name}（整個分類）` : '一般消費';
  const dr = (k, v) => `<div class="dr"><dt>${k}</dt><dd>${v}</dd></div>`;
  const split = o.baseRate !== null && o.bonusRate !== null ? `（基本 ${fmtRate(o.baseRate)}＋加碼 ${fmtRate(o.bonusRate)}）` : '';
  const conds = [o.requiresRegistration ? `需登錄${S().registered.includes(o.id) ? '（已登錄）' : '（未登錄）'}` : '', o.conditions && o.conditions.requiresAutoDebit ? '需自動扣繳' : '', ROUNDING[o.rounding]].filter(Boolean).join('、');
  return `<div class="detail"><div style="margin-bottom:6px">${cdot(card)}<b>${esc(card.shortName)}</b> ${statusPill(o)} ${soonPill(o)}</div><dl>
    ${dr('回饋率', `<b>${fmtRate(offerRate(o))}</b> ${split} ${esc(o.rewardType)}`)}
    ${o.planId || o.level ? dr('方案／等級', esc([planName(o.cardId, o.planId), o.level ? `Level ${o.level}` : ''].filter(Boolean).join(' · '))) : ''}
    ${dr('期限', o.startDate || o.endDate ? `${fullDate(o.startDate) || '未公告'} ～ ${fullDate(o.endDate) || '未公告'}` : '常態')}
    ${dr('上限', describeCap(o.rewardCap))}
    ${dr('門檻', o.minSpendKnown ? (o.minSpend ? `單筆滿 ${fmtMoney(o.minSpend)} 元` : '無') : '未確認')}
    ${dr('適用', esc(scope) + (o.countries.length ? `（${o.countries.map((c) => COUNTRY[c]).join('、')}）` : ''))}
    ${dr('付款', o.paymentMethods.length ? esc(o.paymentMethods.map(payName).join('、')) : '不限')}
    ${dr('條件', esc(conds))}
    ${o.exclusions.length ? dr('排除', esc(o.exclusions.join('；'))) : ''}
    ${dr('官方來源', o.sourceUrl ? `<a href="${esc(o.sourceUrl)}" target="_blank" rel="noopener">開啟</a>` : '<span class="muted">無（資料不足）</span>')}
    ${dr('確認日期', fullDate(o.lastVerified) || '尚未確認')}
    ${o.notes ? dr('備註', esc(o.notes)) : ''}
  </dl>${effStatus(o) === 'verified' && o.sourceUrl ? `<button class="btn" style="margin-top:12px;width:100%" data-ok="${esc(o.id)}">✓ 今天確認仍正確</button>` : ''}</div>`;
}
function openDetail(id) {
  const o = offers().find((x) => x.id === id);
  if (!o) return;
  openSheet(o.title, detailHtml(o), '編輯', () => openEditor(id), (e) => {
    const b = e.target.closest('[data-ok]');
    if (b) { confirmOk(b.dataset.ok); closeSheet(); renderCurrent(); }
  });
}

/* ---------- 新增／編輯優惠 ---------- */
let ed = null;
function newOffer() {
  const c = CARDS[0];
  return { id: `${c.id}-${Date.now().toString(36)}`, cardId: c.id, cardName: c.name, planId: null, level: null, title: '', categoryId: null, merchantIds: [], excludedMerchantIds: [], countries: [], paymentMethods: [],
    baseRate: null, bonusRate: null, totalRate: null, rewardType: '現金回饋', rewardCap: { kind: 'unknown' }, minSpend: null, minSpendKnown: false, requiresRegistration: false, rounding: 'unknown',
    conditions: {}, startDate: null, endDate: null, sourceUrl: '', lastVerified: null, status: 'pending', exclusions: [], notes: '' };
}
function editorHtml(errs = []) {
  const o = ed.o, card = CARD[o.cardId];
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  const chips = (key, items) => `<div class="chips">${items.map(([v, l]) => `<button class="chip sm ${o[key].includes(v) ? 'on' : ''}" data-arr="${key}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
  const num = (k, l) => `<div class="f"><label>${l}</label><input class="field" type="number" step="0.01" data-k="${k}" data-num="1" value="${o[k] ?? ''}" placeholder="空白＝資料不足"></div>`;
  const capAmt = o.rewardCap.kind === 'reward' || o.rewardCap.kind === 'spend';
  return `<div class="ed">${errs.length ? `<div class="errs">${errs.map(esc).join('<br>')}</div>` : ''}
    <div class="f"><label>標題</label><input class="field" data-k="title" value="${esc(o.title)}"></div>
    <div class="two"><div class="f"><label>信用卡</label><select class="field" data-k="cardId">${CARDS.map((c) => opt(c.id, c.shortName, o.cardId)).join('')}</select></div>
      <div class="f"><label>狀態</label><select class="field" data-k="status">${['verified', 'pending', 'expired', 'invalid'].map((s) => opt(s, STATUS[s], o.status)).join('')}</select></div></div>
    ${card.plans || card.levels ? `<div class="two">
      ${card.plans ? `<div class="f"><label>方案</label><select class="field" data-k="planId">${opt('', '不限', o.planId)}${card.plans.map((p) => opt(p.id, p.name, o.planId)).join('')}</select></div>` : '<div></div>'}
      ${card.levels ? `<div class="f"><label>等級</label><select class="field" data-k="level" data-num="1">${opt('', '不限', o.level)}${card.levels.map((l) => opt(l, `Level ${l}`, o.level)).join('')}</select></div>` : ''}</div>` : ''}
    <div class="two">${num('baseRate', '基本 %')}${num('bonusRate', '加碼 %')}</div>
    <div class="two">${num('totalRate', '總回饋 %（空白自動加總）')}
      <div class="f"><label>回饋類型</label><select class="field" data-k="rewardType">${['現金回饋', '點數', '小樹點', 'LINE POINTS', '台新Point', '哩程', '其他'].map((t) => opt(t, t, o.rewardType)).join('')}</select></div></div>
    <div class="f"><label>官方網址（已驗證必填）</label><input class="field" type="url" data-k="sourceUrl" value="${esc(o.sourceUrl)}" placeholder="https://"></div>
    <div class="two"><div class="f"><label>確認日期</label><input class="field" type="date" data-k="lastVerified" value="${o.lastVerified || ''}"></div>
      <div class="f"><label>&nbsp;</label><button class="btn ghost" data-today="1" style="width:100%">今天</button></div></div>
    <div class="two"><div class="f"><label>開始</label><input class="field" type="date" data-k="startDate" value="${o.startDate || ''}"></div>
      <div class="f"><label>結束</label><input class="field" type="date" data-k="endDate" value="${o.endDate || ''}"></div></div>
    <div class="two"><div class="f"><label>回饋上限</label><select class="field" data-cap="kind">${[['unknown', '未確認'], ['none', '無上限'], ['reward', '回饋金額上限'], ['spend', '消費金額上限']].map(([v, l]) => opt(v, l, o.rewardCap.kind)).join('')}</select></div>
      ${capAmt ? `<div class="f"><label>上限金額</label><input class="field" type="number" data-cap="amount" value="${o.rewardCap.amount}"></div>` : '<div></div>'}</div>
    ${capAmt ? `<div class="two"><div class="f"><label>週期</label><select class="field" data-cap="period">${Object.entries(PERIOD).map(([v, l]) => opt(v, l, o.rewardCap.period)).join('')}</select></div>
      <div class="f"><label>適用</label><select class="field" data-cap="appliesTo">${opt('bonus', '只限加碼', o.rewardCap.appliesTo)}${opt('total', '總回饋', o.rewardCap.appliesTo)}</select></div></div>` : ''}
    <div class="two"><div class="f"><label>最低消費</label><select class="field" data-k="minSpendKnown" data-bool="1">${opt('false', '未確認', String(o.minSpendKnown))}${opt('true', '已確認', String(o.minSpendKnown))}</select></div>
      ${o.minSpendKnown ? num('minSpend', '單筆門檻（空白＝無）') : '<div></div>'}</div>
    <div class="two"><div class="f"><label>取整</label><select class="field" data-k="rounding">${Object.entries(ROUNDING).map(([v, l]) => opt(v, l, o.rounding)).join('')}</select></div>
      <div class="f"><label>其他條件</label><div class="chips">
        <button class="chip sm ${o.requiresRegistration ? 'on' : ''}" data-flag="requiresRegistration">需登錄</button>
        <button class="chip sm ${o.conditions.requiresAutoDebit ? 'on' : ''}" data-flag="autoDebit">需自動扣繳</button></div></div></div>
    <div class="f"><label>分類（沒選商店時適用整個分類；都空白＝一般消費）</label><select class="field" data-k="categoryId">${opt('', '不限', o.categoryId)}${CATEGORIES.map((c) => opt(c.id, c.name, o.categoryId)).join('')}</select></div>
    <div class="f"><label>適用商店（${o.merchantIds.length}）</label>${CATEGORIES.map((c) => `<div class="grp">${esc(c.name)}</div>${chips('merchantIds', c.merchants.map((m) => [m.id, m.name]))}`).join('')}</div>
    <div class="f"><label>國家（不選＝不限）</label>${chips('countries', Object.entries(COUNTRY))}</div>
    <div class="f"><label>指定付款（不選＝不限）</label>${chips('paymentMethods', PAYMENTS.map((p) => [p.id, p.name]))}</div>
    <div class="f"><label>排除條件（每行一項）</label><textarea class="field" data-k="exclusions" data-lines="1">${esc(o.exclusions.join('\n'))}</textarea></div>
    <div class="f"><label>備註</label><textarea class="field" data-k="notes">${esc(o.notes)}</textarea></div>
    ${ed.isNew ? '' : '<button class="text-btn danger del" data-del="1">刪除這筆</button>'}
  </div>`;
}
function openEditor(id) {
  const src = id ? offers().find((x) => x.id === id) : null;
  ed = { o: JSON.parse(JSON.stringify(src || newOffer())), isNew: !src };
  ed.o.conditions = ed.o.conditions || {};
  openSheet(ed.isNew ? '新增優惠' : '編輯優惠', editorHtml(), '儲存', saveEditor, (e) => {
    const o = ed.o;
    const a = e.target.closest('[data-arr]'), fl = e.target.closest('[data-flag]');
    if (a) { const k = a.dataset.arr, v = a.dataset.v; o[k] = o[k].includes(v) ? o[k].filter((x) => x !== v) : [...o[k], v]; }
    else if (fl) { if (fl.dataset.flag === 'autoDebit') o.conditions.requiresAutoDebit = !o.conditions.requiresAutoDebit || undefined; else o.requiresRegistration = !o.requiresRegistration; }
    else if (e.target.closest('[data-today]')) o.lastVerified = todayKey();
    else if (e.target.closest('[data-del]')) {
      if (!confirm('刪除這筆？（建議改成「已失效」保留紀錄）')) return;
      saveOffers(offers().filter((x) => x.id !== o.id)); closeSheet(); toast('已刪除'); renderCurrent(); return;
    } else return;
    rerenderEditor();
  }, (e) => {
    const t = e.target, o = ed.o;
    if (t.dataset.cap) {
      const k = t.dataset.cap;
      if (k === 'kind') o.rewardCap = ['none', 'unknown'].includes(t.value) ? { kind: t.value } : { kind: t.value, amount: o.rewardCap.amount || 0, period: o.rewardCap.period || 'month', appliesTo: o.rewardCap.appliesTo || 'bonus' };
      else o.rewardCap[k] = k === 'amount' ? (t.valueAsNumber || 0) : t.value;
      if (k === 'kind') rerenderEditor();
      return;
    }
    const k = t.dataset.k; if (!k) return;
    let v = t.value;
    if (t.dataset.num) v = v === '' ? null : Number(v);
    else if (t.dataset.bool) v = v === 'true';
    else if (t.dataset.lines) v = v.split('\n').map((s) => s.trim()).filter(Boolean);
    else if (['planId', 'categoryId', 'startDate', 'endDate', 'lastVerified'].includes(k)) v = v || null;
    else if (k === 'sourceUrl') v = v.trim();
    o[k] = v;
    if (k === 'cardId') { o.planId = null; o.level = null; o.cardName = CARD[v].name; }
    if (['cardId', 'minSpendKnown'].includes(k)) rerenderEditor();
  });
}
function rerenderEditor(errs) { $('#sheetBody').innerHTML = editorHtml(errs); }
function saveEditor() {
  const o = ed.o;
  if (o.totalRate === null && o.baseRate !== null && o.bonusRate !== null) o.totalRate = round2(o.baseRate + o.bonusRate);
  const errs = validateOffer(o);
  if (ed.isNew && offers().some((x) => x.id === o.id)) errs.push('ID 重複');
  if (errs.length) { rerenderEditor(errs); $('.sheet').scrollTop = 0; return; }
  saveOffers(ed.isNew ? [...offers(), o] : offers().map((x) => (x.id === o.id ? o : x)));
  closeSheet(); toast('已儲存'); renderCurrent();
}

/* ================= 設定 ================= */
const AUTO_DEBIT_LABEL = {
  'taishin-richart': ['台新帳戶自動扣繳卡費', '有設定＝Level 2（加碼 3.3%）；沒有＝Level 1（1.3%）'],
  'esun-kumamon': ['玉山帳戶自動扣繳＋帳單e化', '國內一般消費 0.5% 需要'],
};
const sw = (on, attr) => `<button class="switch ${on ? 'on' : ''}" ${attr} role="switch" aria-checked="${on}"></button>`;
function renderSettings() {
  const s = S();
  $('#cardSettings').innerHTML = CARDS.map((c) => {
    const on = s.enabled.includes(c.id);
    const rows = [`<div class="set-row"><span class="grow">${cdot(c)}<b>${esc(c.shortName)}</b><span class="sub">${esc(c.name)}</span></span>${sw(on, `data-enable="${c.id}"`)}</div>`];
    if (on) {
      if (AUTO_DEBIT_LABEL[c.id]) rows.push(`<div class="set-row"><span class="grow">${AUTO_DEBIT_LABEL[c.id][0]}<span class="sub">${AUTO_DEBIT_LABEL[c.id][1]}</span></span>${sw(autoDebitOf(s, c.id), `data-autodebit="${c.id}"`)}</div>`);
      if (c.levels) rows.push(`<div class="set-row"><span class="grow">等級</span><div class="seg" style="min-width:150px">${c.levels.map((l) => `<button data-level="${c.id}" data-v="${l}" class="${(s.levels[c.id] || c.levels[0]) === l ? 'on' : ''}">Level ${l}</button>`).join('')}</div></div>`);
      if (c.plans) rows.push(`<div class="set-row"><span class="grow">目前方案</span><select class="field" data-planset="${c.id}">${c.plans.map((p) => `<option value="${p.id}" ${s.plans[c.id] === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`);
      const feeSrc = c.foreignFeeSource ? `<span class="sub">官方 ${c.defaultForeignFeeRate}%・<a href="${esc(c.foreignFeeSource)}" target="_blank" rel="noopener">來源</a>・${shortDate(c.foreignFeeVerified)} 確認</span>` : '';
      rows.push(`<div class="set-row"><span class="grow">海外手續費 %${feeSrc}</span><input class="field" type="number" step="0.01" min="0" data-fee="${c.id}" value="${s.fees[c.id] ?? c.defaultForeignFeeRate}"></div>`);
      c.billingCurrencies.filter((x) => x !== 'TWD').forEach((cur) => {
        const k = `${c.id}:${cur}`;
        rows.push(`<div class="set-row"><span class="grow">${cur} 結帳手續費 %<span class="sub">雙幣卡外幣帳戶</span></span><input class="field" type="number" step="0.01" min="0" data-feecur="${k}" value="${s.feesCur[k] ?? (c.defaultForeignFeeByCurrency || {})[cur] ?? c.defaultForeignFeeRate}"></div>`);
      });
    }
    return `<div class="list pad">${rows.join('')}</div>`;
  }).join('');
  $('#prefs').innerHTML = `
    <div class="set-row"><span class="grow">比較所有方案<span class="sub">關閉＝只用目前方案</span></span>${sw(s.allPlans, 'data-pref="allPlans"')}</div>
    <div class="set-row"><span class="grow">顯示待驗證參考值</span>${sw(s.showRef, 'data-pref="showRef"')}</div>
    <div class="set-row"><span class="grow">幾天要重新確認<span class="sub">超過就暫停推薦</span></span><input class="field" type="number" min="1" max="60" data-num="staleDays" value="${s.staleDays}"></div>
    <div class="set-row"><span class="grow">到期前幾天提醒</span><input class="field" type="number" min="1" max="365" data-num="soonDays" value="${s.soonDays}"></div>`;
  const reg = offers().filter((o) => o.requiresRegistration && isLive(o));
  $('#regList').innerHTML = reg.length ? reg.map((o) => `<div class="set-row"><span class="grow">${cdot(CARD[o.cardId])}${esc(o.title)}</span>${sw(s.registered.includes(o.id), `data-reg="${esc(o.id)}"`)}</div>`).join('')
    : '<div class="empty">沒有需要登錄的活動</div>';
  let last = 0; try { last = Number(localStorage.getItem(BACKUP_KEY)) || 0; } catch (e) { /* 略過 */ }
  $('#backupInfo').textContent = last ? `上次備份 ${keyOf(new Date(last))}` : '還沒備份過';
  $('#verLine').textContent = `版本 ${VERSION} · 預設資料 ${DATA_VERSION}${data.offers ? ' · 使用自訂資料' : ''}`;
}
$('#view-settings').addEventListener('click', (e) => {
  const s = S(), t = e.target.closest('button'); if (!t || !t.closest('#cardSettings, #prefs, #regList')) return;
  const d = t.dataset;
  if (d.enable) s.enabled = s.enabled.includes(d.enable) ? s.enabled.filter((x) => x !== d.enable) : [...s.enabled, d.enable];
  else if (d.autodebit) s.autoDebits = { ...s.autoDebits, [d.autodebit]: !autoDebitOf(s, d.autodebit) };
  else if (d.level) s.levels[d.level] = +d.v;
  else if (d.pref) s[d.pref] = !s[d.pref];
  else if (d.reg) s.registered = s.registered.includes(d.reg) ? s.registered.filter((x) => x !== d.reg) : [...s.registered, d.reg];
  else return;
  persist(); renderSettings();
});
$('#view-settings').addEventListener('change', (e) => {
  const s = S(), t = e.target, d = t.dataset;
  if (d.planset) s.plans[d.planset] = t.value;
  else if (d.fee) s.fees[d.fee] = Math.max(0, t.valueAsNumber || 0);
  else if (d.feecur) s.feesCur[d.feecur] = Math.max(0, t.valueAsNumber || 0);
  else if (d.num) s[d.num] = Math.max(1, Math.round(t.valueAsNumber) || blankSettings()[d.num]);
  else return;
  persist(); renderSettings();
});

async function exportData() {
  const json = JSON.stringify({ app: 'credit-card-rewards', version: 1, exported: new Date().toISOString(), ...data, offers: offers() }, null, 2);
  const name = `信用卡回饋備份-${todayKey()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const done = () => { try { localStorage.setItem(BACKUP_KEY, String(Date.now())); } catch (e) { /* 略過 */ } renderSettings(); };
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); done(); toast('已匯出'); } catch (e) { if (e.name !== 'AbortError') toast('匯出失敗'); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  done(); toast('已下載備份檔');
}
$('#btnExport').addEventListener('click', exportData);
$('#btnImport').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const list = Array.isArray(d) ? d : d.offers;
    if (!Array.isArray(list)) throw new Error('格式錯誤');
    const errs = list.flatMap((o, i) => validateOffer(o).map((x) => `第 ${i + 1} 筆：${x}`));
    if (errs.length) { alert(`檔案有 ${errs.length} 個問題，未匯入：\n${errs.slice(0, 8).join('\n')}`); return; }
    if (!confirm(`用備份的 ${list.length} 筆優惠${d.settings ? '與設定' : ''}取代目前資料？`)) return;
    data.offers = list;
    if (d.settings) data.settings = migrateSettings(d.settings, d.ver);
    if (d.programs) data.programs = d.programs;
    applyPrograms(); persist(); renderCurrent(); toast('已匯入');
  } catch (err) { toast('無法讀取這個檔案'); }
});
$('#btnReset').addEventListener('click', () => {
  if (!confirm('優惠資料還原成預設？你修改過的優惠會消失（設定保留）。建議先匯出備份。')) return;
  data.offers = null; data.programs = null; applyPrograms(); persist(); renderCurrent(); toast('已還原');
});

/* ================= 面板 ================= */
let sheetOk = null, sheetClick = null, sheetInput = null;
function openSheet(title, html, okLabel, onOk, onClick, onInput) {
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = html;
  $('#sheetOk').textContent = okLabel || '';
  $('#sheetOk').hidden = !okLabel;
  sheetOk = onOk; sheetClick = onClick || null; sheetInput = onInput || null;
  $('#sheet').hidden = false;
  $('.sheet').scrollTop = 0;
}
function closeSheet() { $('#sheet').hidden = true; sheetOk = sheetClick = sheetInput = null; ed = null; }
$('#sheetCancel').addEventListener('click', () => { closeSheet(); renderCurrent(); });
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') { closeSheet(); renderCurrent(); } });
$('#sheetOk').addEventListener('click', () => { if (sheetOk) sheetOk(); });
$('#sheetBody').addEventListener('click', (e) => { if (sheetClick) sheetClick(e); });
$('#sheetBody').addEventListener('input', (e) => { if (sheetInput) sheetInput(e); });
$('#sheetBody').addEventListener('change', (e) => { if (sheetInput && e.target.tagName === 'SELECT') sheetInput(e); });

/* ================= 分頁 ================= */
const RENDER = { search: renderSearch, calc: renderCalc, data: renderData, settings: renderSettings };
let currentTab = 'search';
function switchTab(tab) {
  currentTab = tab;
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${tab}`));
  RENDER[tab]();
  window.scrollTo(0, 0);
}
function renderCurrent() { RENDER[currentTab](); renderWeekTip(); }
$$('.tab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
// 跨日或從背景回來時重新計算（到期、每月確認都依日期判斷）
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && $('#sheet').hidden) { renderCurrent(); loadReport(); } });

/* ================= 安裝引導（同運動 App） ================= */
const SHARE_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>';
const MENU_SVG = '<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h9"/></svg>';
const APP_URL = location.origin + location.pathname;
function initInstallGuide() {
  const ua = navigator.userAgent;
  const params = new URLSearchParams(location.search);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const ios = /iPhone|iPod/.test(ua);
  const isLine = /\bLine\//.test(ua);
  const inApp = isLine || /FBAN|FBAV|Instagram|MicroMessenger/.test(ua);
  const ver = Number((ua.match(/Version\/(\d+)/) || [])[1]) || 0;
  let mode = params.get('guide');
  if (!mode) {
    if (standalone || !ios) return;
    let later = false;
    try { later = sessionStorage.getItem('ccr-guide-later') === '1'; } catch (e) { /* 略過 */ }
    if (later) return;
    mode = inApp ? 'line' : /CriOS|EdgiOS|FxiOS/.test(ua) ? 'chrome' : ver >= 26 ? 'safari26' : 'safari';
  }
  if (mode === 'line' && isLine && !params.has('openExternalBrowser')) {
    let tried = false;
    try { tried = sessionStorage.getItem('ccr-ext-tried') === '1'; sessionStorage.setItem('ccr-ext-tried', '1'); } catch (e) { tried = true; }
    if (!tried) { location.replace(APP_URL + '?openExternalBrowser=1'); return; }
  }
  const STEPS = {
    line: ['點畫面<b>右上角或右下角的「⋯」</b>', '選<b>「用 Safari 開啟」</b>', '打開後，照畫面的說明加到桌面'],
    chrome: [`點網址旁邊的${SHARE_SVG}<b>「分享」</b>`, '往上滑，點<b>「加入主畫面」</b>', '點右上角<b>「新增」</b>'],
    safari: [`點最下面中間的${SHARE_SVG}<b>「分享」</b>`, '往上滑，點<b>「加入主畫面」</b>', '點右上角<b>「新增」</b>'],
    safari26: [`點下面網址<b>左邊的${MENU_SVG}</b><small>沒有的話，點右下角「⋯」</small>`, `點${SHARE_SVG}<b>「分享」</b>`, '往上滑，點<b>「加入主畫面」</b>', '點右上角<b>「新增」</b>'],
  };
  if (!STEPS[mode]) return;
  const notSafari = mode === 'line' || mode === 'chrome';
  $('#igTitle').innerHTML = notSafari ? '請改用 Safari 打開' : '把「刷哪張」<br>放到手機桌面';
  $('#igSteps').innerHTML = STEPS[mode].map((t) => `<li><span>${t}</span></li>`).join('');
  $('#igSafari').href = 'x-safari-' + APP_URL;
  $('#igSafari').hidden = !notSafari;
  $('#igLead').hidden = !notSafari;
  const arrow = $('#igArrow');
  arrow.setAttribute('class', 'ig-arrow ' + (mode === 'safari' ? 'center' : 'menu'));
  arrow.toggleAttribute('hidden', notSafari);
  $('#installGuide').hidden = false;
  $('#igLater').addEventListener('click', () => {
    $('#installGuide').hidden = true;
    try { sessionStorage.setItem('ccr-guide-later', '1'); } catch (e) { /* 略過 */ }
  });
}

renderSearch();
loadReport();
initInstallGuide();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
