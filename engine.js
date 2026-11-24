// ============================================================
// 回饋計算引擎（純函式，不碰畫面；tools/test_app.py 直接呼叫這些函式測試）
// 原則：
// 1. 已過期／已失效／尚未開始的優惠不參與。
// 2. 只有「已驗證」且條件齊全的優惠可當正式推薦；其他只能當「參考」。
// 3. 回饋率是 null → 資料不足，不當成 0%。
// 4. 條件不明 → 列出缺少的條件，不給確定數字。
// ============================================================

const pad2 = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayKey = () => keyOf(new Date());
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
const round2 = (n) => Math.round(n * 100) / 100;

const STATUS = { verified: '已驗證', pending: '待驗證', expired: '已過期', invalid: '已失效', upcoming: '尚未開始' };
const ROUNDING = { round: '逐筆四捨五入', floor: '逐筆無條件捨去', ceil: '逐筆無條件進位', none: '不逐筆取整', unknown: '取整規則未確認' };
const PERIOD = { transaction: '每筆', month: '每月（每期帳單）', quarter: '每季', campaign: '活動期間', year: '每年' };
const COUNTRY = { TW: '台灣', JP: '日本', AU: '澳洲', OTHER: '其他海外' };

const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));
const PAY = Object.fromEntries(PAYMENTS.map((p) => [p.id, p]));
const MERCHANTS = CATEGORIES.flatMap((c) => c.merchants.map((m) => ({ ...m, categoryId: c.id, categoryName: c.name, country: m.country || c.country })));
const MERCHANT = Object.fromEntries(MERCHANTS.map((m) => [m.id, m]));
const payName = (id) => (PAY[id] ? PAY[id].name : id);
const planName = (cardId, planId) => {
  if (!planId) return null;
  const p = ((CARD[cardId] || {}).plans || []).find((x) => x.id === planId);
  return p ? p.name : planId;
};

/** 依日期推算實際狀態：超過結束日的已驗證資料自動視為已過期 */
function effStatus(o, today = todayKey()) {
  if (o.status === 'invalid' || o.status === 'expired') return o.status;
  if (o.endDate && o.endDate < today) return 'expired';
  if (o.startDate && o.startDate > today) return 'upcoming';
  return o.status;
}
const isLive = (o, today) => ['verified', 'pending'].includes(effStatus(o, today));
const daysLeft = (o, today = todayKey()) => (o.endDate ? daysBetween(today, o.endDate) : null);
/** 已驗證但超過 S.staleDays（預設 30）天沒重新確認 → 需重新確認，不當正式推薦 */
const staleDays = (S) => (S && S.staleDays) || 30;
const isStale = (o, S, today = todayKey()) => effStatus(o, today) === 'verified' && (!o.lastVerified || daysBetween(o.lastVerified, today) > staleDays(S));
const expiringSoon = (o, days, today = todayKey()) => { const d = daysLeft(o, today); return isLive(o, today) && d !== null && d >= 0 && d <= days; };

/** 總回饋率；資料不足回傳 null */
function offerRate(o) {
  if (o.totalRate !== null && o.totalRate !== undefined && isFinite(o.totalRate)) return o.totalRate;
  if (o.baseRate !== null && o.bonusRate !== null && o.baseRate !== undefined && o.bonusRate !== undefined) return round2(o.baseRate + o.bonusRate);
  return null;
}
const fmtRate = (r) => (r === null || r === undefined || !isFinite(r) ? '資料不足' : `${round2(r)}%`);
const fmtMoney = (v, d = 0) => (v === null || v === undefined ? '—' : v.toLocaleString('zh-TW', { minimumFractionDigits: d, maximumFractionDigits: d }));

function describeCap(c) {
  if (!c || c.kind === 'unknown') return '上限未確認';
  if (c.kind === 'none') return '無上限';
  const part = c.appliesTo === 'bonus' ? '加碼' : '';
  return `${PERIOD[c.period] || ''}${part}${c.kind === 'reward' ? '回饋' : '消費'}上限 ${fmtMoney(c.amount)} 元`;
}

/** 優惠是否適用此商店（不看個人條件） */
function matches(o, m, country = m.country) {
  if ((o.excludedMerchantIds || []).includes(m.id)) return false;
  if (o.countries.length && !o.countries.includes(country)) return false;
  if (o.merchantIds.length) return o.merchantIds.includes(m.id);
  if (o.categoryId) return o.categoryId === m.categoryId;
  return true;
}

/** 檢查個人條件：回傳 { ok, reasons（不適用原因）, missing（未確認條件）, switchTo（需切換的方案） } */
function checkOffer(o, card, ctx, S) {
  const today = ctx.today || todayKey();
  const reasons = [], missing = [];
  let switchTo = null;
  const st = effStatus(o, today);
  if (st === 'expired') reasons.push('已過期');
  if (st === 'invalid') reasons.push('已失效');
  if (st === 'upcoming') reasons.push('活動尚未開始');
  if (!matches(o, ctx.merchant, ctx.country)) reasons.push('不適用此商店／國家');
  if (o.level !== null && card.levels) {
    const lv = S.levels[card.id] || card.levels[0];
    if (o.level !== lv) reasons.push(`限 Level ${o.level}（目前 Level ${lv}）`);
  }
  if (o.planId && card.plans) {
    if (o.planId !== S.plans[card.id]) {
      const plan = card.plans.find((x) => x.id === o.planId) || {};
      if (plan.lock) reasons.push(`需切到「${plan.name}」（切換後鎖定到年底，不列入比較）`);
      else if (S.allPlans) switchTo = planName(card.id, o.planId);
      else reasons.push(`需切換到「${planName(card.id, o.planId)}」`);
    }
  }
  const usePm = ctx.payment || ctx.merchant.defaultPaymentMethod || null;
  if (usePm && PAY[usePm] && PAY[usePm].cards && !PAY[usePm].cards.includes(card.id)) reasons.push(`${payName(usePm)} 不能綁這張卡`);
  if (o.paymentMethods.length) {
    const pm = usePm;
    const names = o.paymentMethods.map(payName).join('、');
    if (!pm) missing.push(`需用 ${names} 付款`);
    else if (!o.paymentMethods.includes(pm)) reasons.push(`限 ${names} 付款`);
  }
  if (o.conditions && o.conditions.requiresAutoDebit && !autoDebitOf(S, card.id)) reasons.push('需設定該行帳戶自動扣繳卡費');
  if (o.conditions && o.conditions.requiresNoAutoDebit && autoDebitOf(S, card.id)) reasons.push('已設定自動扣繳，改適用 Level 2');
  if (o.requiresRegistration) {
    const reg = ctx.registered === null || ctx.registered === undefined ? S.registered.includes(o.id) : ctx.registered;
    if (!reg) reasons.push('尚未登錄活動');
  }
  if (offerRate(o) === null) missing.push('回饋率資料不足');
  return { ok: reasons.length === 0, reasons, missing, switchTo };
}

function toEval(card, cand, ctx, unknownSibling, S) {
  if (!cand) return { card, offer: null, rate: null, status: null, formal: false, switchTo: null, missing: ['沒有適用的優惠資料（資料不足）'] };
  const st = effStatus(cand.o, ctx.today || todayKey());
  const rate = offerRate(cand.o);
  const missing = [...cand.c.missing];
  if (unknownSibling) missing.push('另有回饋率不明的優惠，實際回饋可能不同');
  const stale = isStale(cand.o, S, ctx.today || todayKey());
  if (stale) missing.push(`超過 ${staleDays(S)} 天沒重新確認`);
  return { card, offer: cand.o, rate, status: st, stale, formal: st === 'verified' && !stale && rate !== null && cand.c.missing.length === 0, switchTo: cand.c.switchTo, missing };
}

/** 評估一張卡在某商店的所有優惠 */
function assess(card, offers, ctx, S) {
  const all = offers.filter((o) => o.cardId === card.id && matches(o, ctx.merchant, ctx.country)).map((o) => ({ o, c: checkOffer(o, card, ctx, S) }));
  const rateOf = (x) => { const r = offerRate(x.o); return r === null ? -1 : r; };
  const ok = all.filter((x) => x.c.ok).sort((a, b) => rateOf(b) - rateOf(a));
  const unknown = (chosen) => ok.some((x) => x !== chosen && offerRate(x.o) === null);
  const today = ctx.today || todayKey();
  const formalTop = ok.find((x) => effStatus(x.o, today) === 'verified' && !isStale(x.o, S, today) && offerRate(x.o) !== null && x.c.missing.length === 0);
  const refTop = ok.find((x) => offerRate(x.o) !== null) || ok[0] || null;
  // 已驗證的最佳之外，另有回饋率更高的待驗證優惠 → 提示（不影響正式推薦）
  const betterPending = (chosen) => { const r = chosen ? offerRate(chosen.o) : null; const x = chosen && ok.find((y) => y !== chosen && offerRate(y.o) !== null && offerRate(y.o) > r); return x ? `另有待驗證：${x.o.title} ${fmtRate(offerRate(x.o))}` : null; };
  const withHint = (ev, chosen) => (ev ? { ...ev, hint: betterPending(chosen) } : ev);
  return {
    card,
    formal: formalTop ? withHint(toEval(card, formalTop, ctx, unknown(formalTop), S), formalTop) : null,
    reference: toEval(card, refTop, ctx, refTop && unknown(refTop), S),
    eligible: ok.map((x) => toEval(card, x, ctx, unknown(x), S)),
    ineligible: all.filter((x) => !x.c.ok).map((x) => ({ offer: x.o, reasons: x.c.reasons })),
  };
}

/** 各卡是否設定該銀行帳戶自動扣繳卡費 */
const autoDebitOf = (S, cardId) => !!(S.autoDebits || {})[cardId];
const enabledCards = (S) => CARDS.filter((c) => S.enabled.includes(c.id));

/** 某商店的最佳／次佳（正式只看已驗證；ref 為含待驗證的參考排名） */
function rankMerchant(m, offers, S, opt = {}) {
  const ctx = { merchant: m, country: opt.country || m.country, payment: opt.payment || null, registered: opt.registered ?? null, today: opt.today };
  const list = enabledCards(S).map((c) => assess(c, offers, ctx, S));
  const byRate = (a, b) => (b.rate ?? -1) - (a.rate ?? -1);
  const formal = list.filter((a) => a.formal).map((a) => a.formal).sort(byRate);
  const ref = list.map((a) => a.reference).filter((e) => e.rate !== null).sort(byRate);
  return { merchant: m, list, best: formal[0] || null, second: formal[1] || null, refBest: ref[0] || null, refSecond: ref[1] || null };
}

/** 海外交易手續費率（雙幣卡日本消費用日圓帳戶的設定） */
function feeRate(card, country, S) {
  if (country === 'TW') return 0;
  if (country === 'JP' && card.billingCurrencies.includes('JPY')) {
    const v = S.feesCur[`${card.id}:JPY`];
    if (v !== undefined) return v;
    if (card.defaultForeignFeeByCurrency && card.defaultForeignFeeByCurrency.JPY !== undefined) return card.defaultForeignFeeByCurrency.JPY;
  }
  return S.fees[card.id] ?? card.defaultForeignFeeRate;
}

function applyRounding(v, rule) {
  if (rule === 'round') return Math.round(v);
  if (rule === 'floor') return Math.floor(v);
  if (rule === 'ceil') return Math.ceil(v);
  return round2(v);
}

/** 單筆試算：門檻、上限、取整、手續費 */
function calcEval(ev, amount, country, S) {
  const fr = ev.offer && ev.offer.waivesForeignFee ? 0 : feeRate(ev.card, country, S);
  const fee = round2(amount * fr / 100);
  const missing = [...ev.missing];
  const base = { ...ev, amount, reward: null, fee, feeRate: fr, net: null, capHit: false, precise: false, missing };
  const o = ev.offer;
  if (!o || ev.rate === null) return base;

  let bonusOk = true;
  if (o.minSpendKnown && o.minSpend !== null && amount < o.minSpend) {
    bonusOk = false;
    missing.push(`未達單筆 ${fmtMoney(o.minSpend)} 元門檻，加碼不適用`);
  } else if (!o.minSpendKnown && (o.bonusRate || 0) > 0) missing.push('最低消費門檻未確認');

  const split = o.baseRate !== null && o.bonusRate !== null;
  let b = split ? amount * o.baseRate / 100 : 0;
  let x = split ? amount * o.bonusRate / 100 : amount * ev.rate / 100;
  if (!bonusOk) {
    if (split) x = 0;
    else { missing.push('沒有拆分基本／加碼回饋，無法計算未達門檻時的回饋'); return base; }
  }

  let capHit = false;
  const cap = o.rewardCap || { kind: 'unknown' };
  if (cap.kind === 'unknown') missing.push('回饋上限未確認');
  else if (cap.kind === 'reward' || cap.kind === 'spend') {
    const bonusOnly = cap.appliesTo === 'bonus' && split;
    if (cap.kind === 'reward') {
      if (bonusOnly) { if (x > cap.amount) { x = cap.amount; capHit = true; } }
      else if (b + x > cap.amount) { const k = cap.amount / (b + x); b *= k; x *= k; capHit = true; }
    } else {
      const capped = Math.min(amount, cap.amount);
      capHit = amount > cap.amount;
      if (bonusOnly) x = bonusOk ? capped * o.bonusRate / 100 : 0;
      else { b = split ? capped * o.baseRate / 100 : 0; x = split ? capped * o.bonusRate / 100 : capped * ev.rate / 100; }
    }
    if (cap.period !== 'transaction') missing.push('上限只算這一筆，沒扣掉本期已拿到的回饋');
  }
  if (o.rounding === 'unknown') missing.push(ROUNDING.unknown);
  const reward = applyRounding(b + x, o.rounding);
  const precise = missing.every((s) => s.startsWith('上限只算這一筆'));
  return { ...base, reward, net: round2(reward - fee), capHit, precise, formal: ev.formal && precise };
}

/** 試算所有卡：每張卡逐一計算所有符合的優惠，取實際淨回饋最高者（不只看名目回饋率） */
function calcAll(m, amount, offers, S, opt) {
  const ctx = { merchant: m, country: opt.country, payment: opt.payment, registered: opt.registered ?? null };
  const byNet = (a, b) => (b.net ?? -Infinity) - (a.net ?? -Infinity);
  const results = enabledCards(S).map((card) => {
    const a = assess(card, offers, ctx, S);
    const done = a.eligible.map((ev) => calcEval(ev, amount, opt.country, S)).sort(byNet);
    const pick = done.find((r) => r.formal) || done.find((r) => r.net !== null) || calcEval(a.reference, amount, opt.country, S);
    const better = pick.formal && done.find((r) => !r.formal && r.net !== null && r.net > pick.net);
    if (better) pick.hint = `另有待驗證：${better.offer.title}（${fmtMoney(better.net, 1)} 元）`;
    return { ...pick, ineligible: a.ineligible };
  }).sort(byNet);
  const formal = results.filter((r) => r.formal);
  const ref = results.filter((r) => r.net !== null);
  return { results, best: formal[0] || null, second: formal[1] || null, refBest: ref[0] || null, refSecond: ref[1] || null };
}

/** 北捷：Richart 信用卡逐趟回饋＋常客優惠（級距與資格來自 PROGRAMS） */
function metroCalc(trips, fare, offers, S) {
  const P = PROGRAMS.taipeiMetro;
  const payId = 'taishin-pay-qr';
  const t = Math.max(0, Math.floor(trips || 0)), f = Math.max(0, fare || 0), spend = t * f;
  const card = CARD['taishin-richart'];
  const a = assess(card, offers, { merchant: MERCHANT['taipei-metro'], country: 'TW', payment: payId, registered: null }, S);
  const ev = a.formal || a.reference;
  let cardLow = null, cardHigh = null;
  if (ev.rate !== null && ev.offer) {
    const per = f * ev.rate / 100;
    if (ev.offer.rounding === 'unknown') { cardLow = Math.floor(per) * t; cardHigh = Math.ceil(per) * t; }
    else cardLow = cardHigh = applyRounding(per, ev.offer.rounding) * t;
  }
  const tier = P.tiers.find((x) => t >= x.minTrips && (x.maxTrips === null || t <= x.maxTrips)) || null;
  const elig = P.paymentEligibility[payId] ?? null;
  const pst = effStatus(P);
  const minTier = Math.min(...P.tiers.map((x) => x.minTrips));
  const metro = tier ? (tier.rate !== null ? Math.round(spend * tier.rate / 100) : null) : (t < minTier ? 0 : null);
  const metroCounts = elig === true && metro !== null && pst !== 'expired' && pst !== 'invalid';
  const missing = [];
  if (!S.enabled.includes(card.id)) missing.push('Richart 卡已在設定停用');
  if (ev.rate === null) missing.push('台新卡回饋率資料不足');
  if (ev.offer && ev.offer.rounding === 'unknown') missing.push('逐筆取整規則未確認，以區間表示');
  if (!ev.formal) missing.push(ev.stale ? '台新卡優惠需重新確認' : '台新卡優惠尚未驗證');
  ev.missing.filter((m) => m.startsWith('另有')).forEach((m) => missing.push(`台新卡：${m}`));
  if (elig === null) missing.push(`${payName(payId)} 是否算進常客優惠未確認`);
  if (elig === false) missing.push(`${payName(payId)} 不適用常客優惠`);
  if (pst !== 'verified') missing.push('常客優惠級距尚未驗證');
  else if (isStale(P, S)) missing.push('常客優惠級距需重新確認');
  if (tier && tier.rate === null) missing.push('此級距回饋率資料不足');
  const add = metroCounts ? metro : 0;
  return {
    trips: t, fare: f, spend, ev, assessment: a, cardLow, cardHigh, tier, elig, metro, metroCounts, programStatus: pst,
    totalLow: cardLow === null ? null : cardLow + add, totalHigh: cardHigh === null ? null : cardHigh + add,
    precise: missing.length === 0, missing,
  };
}

/** 中油：①儲值刷卡 ②捷利卡餘額付油費 ③直接刷卡，分開計算 */
function cpcCalc(amount, price, offers, S) {
  const P = PROGRAMS.cpcJcard;
  const a = Math.max(0, amount || 0);
  const run = (mid) => enabledCards(S).map((card) => {
    const x = assess(card, offers, { merchant: MERCHANT[mid], country: 'TW', payment: 'physical', registered: null }, S);
    return calcEval(x.formal || x.reference, a, 'TW', S);
  });
  const best = (list) => list.filter((r) => r.reward !== null).sort((p, q) => q.reward - p.reward)[0] || null;
  // 儲值只有官方明列「捷利卡儲值」的優惠才算確定；一般消費回饋是否涵蓋儲值未確認
  const topup = run('cpc-jcard-topup').map((r) => (r.offer && r.offer.merchantIds.includes('cpc-jcard-topup') ? r
    : { ...r, formal: false, precise: false, missing: [...r.missing, '儲值是否算一般消費未確認'] }));
  const direct = run('cpc-direct');
  const liters = price > 0 ? a / price : 0;
  const discount = P.fuelDiscountPerLiter === null ? null : Math.round(liters * P.fuelDiscountPerLiter);
  const bonus = P.topupBonusRate === null ? null : a >= (P.topupMin || 0) ? Math.round(a * P.topupBonusRate / 100) : 0;
  const bt = best(topup), bd = best(direct);
  return {
    amount: a, liters, topup, direct, discount, bonus, bestTopup: bt, bestDirect: bd, programStatus: effStatus(P),
    pathA: bt ? round2(bt.reward + (discount || 0) + (bonus || 0)) : null,
    pathAPrecise: !!(bt && bt.precise && discount !== null && bonus !== null),
  };
}

/** 驗證一筆優惠，回傳錯誤清單 */
function validateOffer(o) {
  const e = [];
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!o.id) e.push('缺少 ID');
  if (!CARD[o.cardId]) e.push(`信用卡不存在：${o.cardId}`);
  if (!o.title) e.push('缺少標題');
  if (!['verified', 'pending', 'expired', 'invalid'].includes(o.status)) e.push('狀態不正確');
  if (o.categoryId && !CATEGORIES.some((c) => c.id === o.categoryId)) e.push(`分類不存在：${o.categoryId}`);
  [...(o.merchantIds || []), ...(o.excludedMerchantIds || [])].forEach((m) => { if (!MERCHANT[m]) e.push(`商店不存在：${m}`); });
  ['baseRate', 'bonusRate', 'totalRate'].forEach((k) => { const v = o[k]; if (v !== null && v !== undefined && !(typeof v === 'number' && v >= 0 && v <= 100)) e.push(`${k} 需為 0–100 或空白`); });
  ['startDate', 'endDate', 'lastVerified'].forEach((k) => { if (o[k] && !isDate(o[k])) e.push(`${k} 日期格式錯誤`); });
  if (o.startDate && o.endDate && o.startDate > o.endDate) e.push('開始日期晚於結束日期');
  if (o.sourceUrl && !/^https?:\/\//.test(o.sourceUrl)) e.push('官方網址需以 http(s):// 開頭');
  if (o.status === 'verified' && !o.sourceUrl) e.push('「已驗證」必須填官方來源網址');
  if (o.status === 'verified' && !o.lastVerified) e.push('「已驗證」必須填確認日期');
  return e;
}
