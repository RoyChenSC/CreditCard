// 信用卡回饋資料（預設值）。修改後在 App 內的資料會存在 localStorage，這裡是「還原預設」時使用的版本。
// 原則：回饋率不確定就填 null（顯示「資料不足」，不當成 0%）；status：verified 已驗證／pending 待驗證／expired 已過期／invalid 已失效。
// 已驗證的資料必須有 sourceUrl（官方網址）與 lastVerified（確認日期）。

const DATA_VERSION = '2026-11-23';

// 信用卡
const CARDS = [
  { "id": "taishin-richart", "name": "台新 Richart GoGo 信用卡", "shortName": "Richart", "bank": "台新銀行", "color": "#e11d48", "billingCurrencies": ["TWD"], "defaultForeignFeeRate": 1.5, "plans": [{ "id": "pay", "name": "Pay 著刷", "description": "指定行動支付通路（適用支付工具待驗證）", "switchReminder": "方案切換規則（次數、生效時間）請以台新官方公告為準" }, { "id": "dining", "name": "好饗刷", "description": "餐飲、外送通路（適用範圍待驗證）", "switchReminder": "方案切換規則請以台新官方公告為準" }, { "id": "daily", "name": "天天刷", "description": "超市、超商、交通通路（適用範圍待驗證）", "switchReminder": "方案切換規則請以台新官方公告為準" }, { "id": "digital", "name": "數趣刷", "description": "網購、數位訂閱通路（適用範圍待驗證）", "switchReminder": "方案切換規則請以台新官方公告為準" }, { "id": "big", "name": "大筆刷", "description": "百貨、指定品牌通路（適用範圍待驗證）", "switchReminder": "方案切換規則請以台新官方公告為準" }, { "id": "travel", "name": "玩旅刷", "description": "海外、旅遊通路（適用範圍待驗證）", "switchReminder": "方案切換規則請以台新官方公告為準" }, { "id": "chill", "name": "Chill 刷", "description": "休閒、運動等通路（適用範圍待驗證）", "switchReminder": "方案切換規則請以台新官方公告為準" }], "officialUrl": "", "notes": "加碼回饋需台新帳戶自動扣繳等條件，實際條件請以官方公告為準。" },
  { "id": "cathay-cube", "name": "國泰世華 CUBE 信用卡", "shortName": "CUBE", "bank": "國泰世華銀行", "color": "#0d9488", "billingCurrencies": ["TWD"], "defaultForeignFeeRate": 1.5, "levels": [1, 2], "plans": [{ "id": "select", "name": "集精選", "description": "超市、超商、加油等日常通路（適用範圍待驗證）", "switchReminder": "權益切換規則請以國泰世華官方公告為準" }, { "id": "dining", "name": "樂饗購", "description": "餐飲、外送、百貨通路（適用範圍待驗證）", "switchReminder": "權益切換規則請以國泰世華官方公告為準" }, { "id": "digital", "name": "玩數位", "description": "網購、數位訂閱通路（適用範圍待驗證）", "switchReminder": "權益切換規則請以國泰世華官方公告為準" }, { "id": "travel", "name": "趣旅行", "description": "海外、旅遊通路（適用範圍待驗證）", "switchReminder": "權益切換規則請以國泰世華官方公告為準" }], "officialUrl": "", "notes": "Level 1 與 Level 2 回饋率分開記錄，未升級前不得套用 Level 2。" },
  { "id": "ctbc-allme", "name": "中國信託 ALL ME 信用卡", "shortName": "ALL ME", "bank": "中國信託銀行", "color": "#16a34a", "billingCurrencies": ["TWD"], "defaultForeignFeeRate": 1.5, "officialUrl": "", "notes": "一般消費及指定支付通路。" },
  { "id": "esun-kumamon", "name": "玉山熊本熊雙幣信用卡（日圓）", "shortName": "熊本熊", "bank": "玉山銀行", "color": "#ea580c", "billingCurrencies": ["TWD", "JPY"], "defaultForeignFeeRate": 1.5, "defaultForeignFeeByCurrency": { "JPY": 1.5 }, "officialUrl": "", "notes": "日圓雙幣卡。日圓交易手續費預設與一般海外相同，若確認有減免請於個人設定調整。" },
];

// 消費分類與商店（新增商店直接加在這裡）
const CATEGORIES = [
  { id: "daily", name: "日常購物", icon: "shopping-cart", country: "TW", merchants: [
    { "id": "tw-general-store", "name": "一般實體商店", "aliases": ["一般消費", "實體"], "defaultPaymentMethod": "physical" },
    { "id": "linepay-merchant", "name": "LINE Pay", "aliases": ["linepay", "line pay"], "defaultPaymentMethod": "line-pay" },
    { "id": "pxmart", "name": "全聯", "aliases": ["全聯福利中心", "pxmart"], "defaultPaymentMethod": "pxpay" },
    { "id": "pxmart-plus", "name": "大全聯", "aliases": ["大全聯"], "defaultPaymentMethod": "pxpay" },
    { "id": "seven-eleven", "name": "7-ELEVEN", "aliases": ["711", "7-11", "統一超商", "小七"], "defaultPaymentMethod": "physical" },
    { "id": "familymart", "name": "全家", "aliases": ["全家便利商店", "familymart"], "defaultPaymentMethod": "physical" },
  ] },
  { id: "dining", name: "餐飲", icon: "utensils", country: "TW", merchants: [
    { "id": "tw-restaurant", "name": "一般餐廳", "aliases": ["餐廳", "吃飯"], "defaultPaymentMethod": "physical" },
    { "id": "mcdonalds", "name": "麥當勞", "aliases": ["mcdonalds", "麥當當"], "defaultPaymentMethod": "physical" },
    { "id": "kfc", "name": "肯德基", "aliases": ["kfc"], "defaultPaymentMethod": "physical" },
    { "id": "mos", "name": "摩斯漢堡", "aliases": ["mos", "摩斯"], "defaultPaymentMethod": "physical" },
    { "id": "ubereats", "name": "Uber Eats", "aliases": ["ubereats", "uber"], "defaultPaymentMethod": "online" },
    { "id": "foodpanda", "name": "foodpanda", "aliases": ["熊貓", "panda"], "defaultPaymentMethod": "online" },
  ] },
  { id: "department", name: "百貨", icon: "building-2", country: "TW", merchants: [
    { "id": "big-city", "name": "新竹巨城", "aliases": ["巨城", "big city"], "defaultPaymentMethod": "physical" },
    { "id": "skm", "name": "新光三越", "aliases": ["skm", "新光"], "defaultPaymentMethod": "physical" },
    { "id": "sogo", "name": "SOGO", "aliases": ["sogo", "太平洋sogo", "遠東sogo"], "defaultPaymentMethod": "physical" },
  ] },
  { id: "online", name: "網路消費", icon: "globe", country: "TW", merchants: [
    { "id": "shopee", "name": "蝦皮", "aliases": ["shopee", "蝦皮購物"], "defaultPaymentMethod": "online" },
    { "id": "momo", "name": "momo", "aliases": ["momo購物", "富邦momo"], "defaultPaymentMethod": "online" },
    { "id": "pchome", "name": "PChome", "aliases": ["pchome 24h"], "defaultPaymentMethod": "online" },
    { "id": "chatgpt", "name": "ChatGPT 訂閱", "aliases": ["openai", "chatgpt plus"], "country": "OTHER", "defaultPaymentMethod": "online" },
    { "id": "claude", "name": "Claude 訂閱", "aliases": ["anthropic", "claude pro"], "country": "OTHER", "defaultPaymentMethod": "online" },
  ] },
  { id: "transport", name: "交通", icon: "train-front", country: "TW", merchants: [
    { "id": "taipei-metro", "name": "台北捷運", "aliases": ["北捷", "捷運", "mrt"], "defaultPaymentMethod": "taishin-pay-qr" },
    { "id": "taipei-bus", "name": "台北公車", "aliases": ["公車"], "defaultPaymentMethod": "taishin-pay-qr" },
    { "id": "thsr", "name": "高鐵", "aliases": ["台灣高鐵", "thsr"], "defaultPaymentMethod": "online" },
    { "id": "tra", "name": "臺鐵", "aliases": ["台鐵", "火車"], "defaultPaymentMethod": "online" },
    { "id": "cpc-direct", "name": "中油直營站", "aliases": ["中油", "加油", "cpc"], "defaultPaymentMethod": "physical" },
    { "id": "cpc-jcard-topup", "name": "中油捷利卡儲值", "aliases": ["捷利卡", "儲值"], "defaultPaymentMethod": "physical" },
  ] },
  { id: "sports", name: "運動", icon: "dumbbell", country: "TW", merchants: [
    { "id": "fitness-factory", "name": "健身工廠", "aliases": ["fitness factory"], "defaultPaymentMethod": "auto-debit" },
    { "id": "nike", "name": "Nike", "aliases": ["耐吉"], "defaultPaymentMethod": "physical" },
    { "id": "adidas", "name": "Adidas", "aliases": ["愛迪達"], "defaultPaymentMethod": "physical" },
    { "id": "hoka", "name": "HOKA", "aliases": ["hoka one one"], "defaultPaymentMethod": "physical" },
  ] },
  { id: "bills", name: "帳單", icon: "receipt", country: "TW", merchants: [
    { "id": "cht", "name": "中華電信月租費", "aliases": ["中華電信", "電信費"], "defaultPaymentMethod": "auto-debit" },
    { "id": "telecom-other", "name": "其他電信費", "aliases": ["台灣大哥大", "遠傳"], "defaultPaymentMethod": "auto-debit" },
    { "id": "utilities", "name": "水電瓦斯費", "aliases": ["水費", "電費", "瓦斯費"], "defaultPaymentMethod": "pxpay" },
  ] },
  { id: "japan", name: "日本旅遊", icon: "plane", country: "JP", merchants: [
    { "id": "jp-general", "name": "日本一般實體消費", "aliases": ["日本"], "defaultPaymentMethod": "physical" },
    { "id": "jp-restaurant", "name": "日本餐廳", "aliases": ["日本餐飲"], "defaultPaymentMethod": "physical" },
    { "id": "jp-convenience", "name": "日本便利商店", "aliases": ["日本超商", "lawson", "7-11 japan"], "defaultPaymentMethod": "physical" },
    { "id": "jp-donki", "name": "唐吉訶德", "aliases": ["驚安殿堂", "don quijote", "donki"], "defaultPaymentMethod": "physical" },
    { "id": "jp-biccamera", "name": "BicCamera", "aliases": ["必酷", "bic camera"], "defaultPaymentMethod": "physical" },
    { "id": "jp-matsukiyo", "name": "松本清", "aliases": ["matsukiyo", "藥妝"], "defaultPaymentMethod": "physical" },
    { "id": "jp-uniqlo", "name": "UNIQLO（日本）", "aliases": ["uniqlo"], "defaultPaymentMethod": "physical" },
    { "id": "jp-gu", "name": "GU（日本）", "aliases": ["gu"], "defaultPaymentMethod": "physical" },
    { "id": "jp-paypay", "name": "PayPay（日本）", "aliases": ["paypay"], "defaultPaymentMethod": "paypay" },
    { "id": "jp-hotel", "name": "日本飯店", "aliases": ["日本住宿"], "defaultPaymentMethod": "physical" },
  ] },
  { id: "australia", name: "澳洲旅遊", icon: "map", country: "AU", merchants: [
    { "id": "au-general", "name": "澳洲一般實體消費", "aliases": ["澳洲"], "defaultPaymentMethod": "physical" },
    { "id": "au-coles", "name": "Coles", "aliases": ["coles"], "defaultPaymentMethod": "physical" },
    { "id": "au-woolworths", "name": "Woolworths", "aliases": ["woolies"], "defaultPaymentMethod": "physical" },
    { "id": "au-restaurant", "name": "澳洲餐廳", "aliases": [], "defaultPaymentMethod": "physical" },
    { "id": "au-cafe", "name": "澳洲咖啡廳", "aliases": ["cafe"], "defaultPaymentMethod": "physical" },
    { "id": "au-fuel", "name": "澳洲加油站", "aliases": ["加油"], "defaultPaymentMethod": "physical" },
    { "id": "au-hotel", "name": "澳洲飯店", "aliases": ["澳洲住宿"], "defaultPaymentMethod": "physical" },
    { "id": "au-car-rental", "name": "澳洲租車", "aliases": ["租車"], "defaultPaymentMethod": "physical" },
  ] },
];

// 付款方式
const PAYMENTS = [
  { "id": "physical", "name": "實體刷卡／感應", "isWallet": false },
  { "id": "apple-pay", "name": "Apple Pay", "isWallet": true },
  { "id": "google-pay", "name": "Google Pay", "isWallet": true },
  { "id": "line-pay", "name": "LINE Pay", "isWallet": true },
  { "id": "taishin-pay", "name": "台新 Pay", "isWallet": true },
  { "id": "taishin-pay-qr", "name": "台新 Pay QR 乘車碼", "isWallet": true },
  { "id": "jkopay", "name": "街口支付", "isWallet": true },
  { "id": "pxpay", "name": "全支付", "isWallet": true },
  { "id": "easywallet", "name": "悠遊付", "isWallet": true },
  { "id": "paypay", "name": "PayPay", "isWallet": true },
  { "id": "online", "name": "線上刷卡", "isWallet": false },
  { "id": "auto-debit", "name": "信用卡自動扣繳", "isWallet": false },
  { "id": "easycard", "name": "悠遊卡（非信用卡）", "isWallet": false },
  { "id": "jcard-balance", "name": "捷利卡餘額（非信用卡）", "isWallet": false },
];

// 回饋優惠（全部為開發用範例，待驗證）
const DEFAULT_OFFERS = [
  { "id": "rt-base-domestic", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": null, "level": null, "title": "Richart 國內一般消費基本回饋", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["TW"], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 0, "totalRate": 0.3, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": ["繳稅、儲值、保費等排除項目依官方公告"], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "rt-base-overseas", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": null, "level": null, "title": "Richart 海外一般消費基本回饋", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["JP", "AU", "OTHER"], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 0, "totalRate": 0.3, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "rt-pay", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": "pay", "level": null, "title": "Pay 著刷：指定行動支付加碼", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["TW"], "paymentMethods": ["taishin-pay", "line-pay", "jkopay", "pxpay", "easywallet"], "baseRate": 0.3, "bonusRate": 3.5, "totalRate": 3.8, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": { "requiresAutoDebit": true }, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "適用支付工具清單待確認。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "rt-dining", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": "dining", "level": null, "title": "好饗刷：餐飲外送加碼", "categoryId": "dining", "merchantIds": ["tw-restaurant", "mcdonalds", "kfc", "mos", "ubereats", "foodpanda"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 3, "totalRate": 3.3, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": { "requiresAutoDebit": true }, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "rt-daily", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": "daily", "level": null, "title": "天天刷：超市超商交通加碼", "categoryId": null, "merchantIds": ["pxmart", "pxmart-plus", "seven-eleven", "familymart", "taipei-metro", "taipei-bus", "thsr", "tra", "cpc-direct"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 3, "totalRate": 3.3, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": { "requiresAutoDebit": true }, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "交通類是否限定台新 Pay／乘車碼待確認。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "rt-daily-jcard", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": "daily", "level": null, "title": "天天刷：中油捷利卡儲值（資格未確認）", "categoryId": null, "merchantIds": ["cpc-jcard-topup"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": { "requiresAutoDebit": true }, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "捷利卡儲值是否符合天天刷加碼資格未確認，不可假設適用。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "rt-digital", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": "digital", "level": null, "title": "數趣刷：網購數位訂閱加碼", "categoryId": null, "merchantIds": ["shopee", "momo", "pchome", "chatgpt", "claude"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 3, "totalRate": 3.3, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": { "requiresAutoDebit": true }, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "ChatGPT／Claude 屬海外交易，可能另計手續費。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "rt-big", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": "big", "level": null, "title": "大筆刷：百貨指定品牌加碼", "categoryId": null, "merchantIds": ["big-city", "skm", "sogo", "nike", "adidas", "hoka"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 3, "totalRate": 3.3, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": { "requiresAutoDebit": true }, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "rt-travel", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": "travel", "level": null, "title": "玩旅刷：海外消費加碼", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["JP", "AU"], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 3, "totalRate": 3.3, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": { "requiresAutoDebit": true }, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "rt-chill", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": "chill", "level": null, "title": "Chill 刷：休閒運動加碼", "categoryId": null, "merchantIds": ["fitness-factory"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 3, "totalRate": 3.3, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": { "requiresAutoDebit": true }, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "健身工廠是否列入 Chill 刷待確認。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "rt-bills", "cardId": "taishin-richart", "cardName": "台新 Richart GoGo 信用卡", "planId": null, "level": null, "title": "電信費自動扣繳", "categoryId": null, "merchantIds": ["cht", "telecom-other"], "excludedMerchantIds": [], "countries": [], "paymentMethods": ["auto-debit"], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "台新Point", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": { "requiresAutoDebit": true }, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "是否適用加碼方案資料不足。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "cube-base", "cardId": "cathay-cube", "cardName": "國泰世華 CUBE 信用卡", "planId": null, "level": null, "title": "CUBE 一般消費基本回饋", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 0, "totalRate": 0.3, "rewardType": "小樹點", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "cube-l1-select", "cardId": "cathay-cube", "cardName": "國泰世華 CUBE 信用卡", "planId": "select", "level": 1, "title": "集精選（Level 1）", "categoryId": null, "merchantIds": ["pxmart", "pxmart-plus", "seven-eleven", "familymart", "cpc-direct"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 1.7, "totalRate": 2, "rewardType": "小樹點", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "cube-l1-dining", "cardId": "cathay-cube", "cardName": "國泰世華 CUBE 信用卡", "planId": "dining", "level": 1, "title": "樂饗購（Level 1）", "categoryId": null, "merchantIds": ["tw-restaurant", "mcdonalds", "kfc", "mos", "ubereats", "foodpanda", "big-city", "skm", "sogo"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 2.7, "totalRate": 3, "rewardType": "小樹點", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "cube-l1-digital", "cardId": "cathay-cube", "cardName": "國泰世華 CUBE 信用卡", "planId": "digital", "level": 1, "title": "玩數位（Level 1）", "categoryId": null, "merchantIds": ["shopee", "momo", "pchome", "chatgpt", "claude"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 2.7, "totalRate": 3, "rewardType": "小樹點", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "cube-l1-travel", "cardId": "cathay-cube", "cardName": "國泰世華 CUBE 信用卡", "planId": "travel", "level": 1, "title": "趣旅行（Level 1）", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["JP", "AU"], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 2.7, "totalRate": 3, "rewardType": "小樹點", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "cube-l2-select", "cardId": "cathay-cube", "cardName": "國泰世華 CUBE 信用卡", "planId": "select", "level": 2, "title": "集精選（Level 2）", "categoryId": null, "merchantIds": ["pxmart", "pxmart-plus", "seven-eleven", "familymart", "cpc-direct"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "小樹點", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "Level 2 回饋率尚無可靠來源。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "cube-l2-dining", "cardId": "cathay-cube", "cardName": "國泰世華 CUBE 信用卡", "planId": "dining", "level": 2, "title": "樂饗購（Level 2）", "categoryId": null, "merchantIds": ["tw-restaurant", "mcdonalds", "kfc", "mos", "ubereats", "foodpanda", "big-city", "skm", "sogo"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "小樹點", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "Level 2 回饋率尚無可靠來源。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "cube-l2-digital", "cardId": "cathay-cube", "cardName": "國泰世華 CUBE 信用卡", "planId": "digital", "level": 2, "title": "玩數位（Level 2）", "categoryId": null, "merchantIds": ["shopee", "momo", "pchome", "chatgpt", "claude"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "小樹點", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "Level 2 回饋率尚無可靠來源。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "cube-l2-travel", "cardId": "cathay-cube", "cardName": "國泰世華 CUBE 信用卡", "planId": "travel", "level": 2, "title": "趣旅行（Level 2）", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["JP", "AU"], "paymentMethods": [], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "小樹點", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "Level 2 回饋率尚無可靠來源。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "allme-general", "cardId": "ctbc-allme", "cardName": "中國信託 ALL ME 信用卡", "planId": null, "level": null, "title": "ALL ME 國內一般消費", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["TW"], "paymentMethods": [], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "一般消費回饋率資料不足。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "allme-pay", "cardId": "ctbc-allme", "cardName": "中國信託 ALL ME 信用卡", "planId": null, "level": null, "title": "ALL ME 指定支付通路", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["TW"], "paymentMethods": ["line-pay", "pxpay", "easywallet", "jkopay"], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": true, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "指定支付通路清單與回饋率資料不足。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "allme-overseas", "cardId": "ctbc-allme", "cardName": "中國信託 ALL ME 信用卡", "planId": null, "level": null, "title": "ALL ME 海外一般消費", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["JP", "AU", "OTHER"], "paymentMethods": [], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "kuma-domestic", "cardId": "esun-kumamon", "cardName": "玉山熊本熊雙幣信用卡（日圓）", "planId": null, "level": null, "title": "熊本熊卡 國內一般消費", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["TW"], "paymentMethods": [], "baseRate": 0.5, "bonusRate": 0, "totalRate": 0.5, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "kuma-jp-general", "cardId": "esun-kumamon", "cardName": "玉山熊本熊雙幣信用卡（日圓）", "planId": null, "level": null, "title": "熊本熊卡 日本實體消費", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["JP"], "paymentMethods": [], "baseRate": 1, "bonusRate": 1.5, "totalRate": 2.5, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "是否需以日圓結帳、是否需登錄待確認。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "kuma-jp-designated", "cardId": "esun-kumamon", "cardName": "玉山熊本熊雙幣信用卡（日圓）", "planId": null, "level": null, "title": "熊本熊卡 日本指定商店加碼", "categoryId": null, "merchantIds": ["jp-donki", "jp-biccamera", "jp-matsukiyo", "jp-uniqlo", "jp-gu"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": true, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "指定商店名單與加碼比率資料不足。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "kuma-jp-paypay", "cardId": "esun-kumamon", "cardName": "玉山熊本熊雙幣信用卡（日圓）", "planId": null, "level": null, "title": "熊本熊卡 PayPay 綁定", "categoryId": null, "merchantIds": ["jp-paypay"], "excludedMerchantIds": [], "countries": [], "paymentMethods": ["paypay"], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "PayPay 綁卡是否計入回饋資料不足。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "kuma-pxpay-bills", "cardId": "esun-kumamon", "cardName": "玉山熊本熊雙幣信用卡（日圓）", "planId": null, "level": null, "title": "熊本熊卡 全支付繳費", "categoryId": null, "merchantIds": ["utilities", "telecom-other", "cht"], "excludedMerchantIds": [], "countries": [], "paymentMethods": ["pxpay"], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": true, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "全支付繳費活動條件資料不足。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "kuma-overseas-other", "cardId": "esun-kumamon", "cardName": "玉山熊本熊雙幣信用卡（日圓）", "planId": null, "level": null, "title": "熊本熊卡 其他海外消費", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["AU", "OTHER"], "paymentMethods": [], "baseRate": null, "bonusRate": null, "totalRate": null, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "demo-expired-kuma-jp-2025", "cardId": "esun-kumamon", "cardName": "玉山熊本熊雙幣信用卡（日圓）", "planId": null, "level": null, "title": "【示範】已過期的日本加碼活動", "categoryId": null, "merchantIds": [], "excludedMerchantIds": [], "countries": ["JP"], "paymentMethods": [], "baseRate": 1, "bonusRate": 5, "totalRate": 6, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": true, "rounding": "unknown", "conditions": {}, "startDate": "2025-07-01", "endDate": "2025-12-31", "sourceUrl": "", "lastVerified": null, "status": "expired", "exclusions": [], "notes": "示範「已過期」狀態，不參與推薦。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "demo-expiring-cube-jp", "cardId": "cathay-cube", "cardName": "國泰世華 CUBE 信用卡", "planId": "travel", "level": 1, "title": "【示範】即將到期的日本藥妝加碼", "categoryId": null, "merchantIds": ["jp-matsukiyo"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0.3, "bonusRate": 4.7, "totalRate": 5, "rewardType": "小樹點", "rewardCap": { "kind": "reward", "amount": 300, "period": "campaign", "appliesTo": "bonus" }, "minSpend": 1000, "minSpendKnown": true, "requiresRegistration": true, "rounding": "round", "conditions": {}, "startDate": "2026-10-01", "endDate": "2026-12-15", "sourceUrl": "", "lastVerified": null, "status": "pending", "exclusions": [], "notes": "示範「即將到期」、登錄、門檻、上限與取整的計算。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
  { "id": "demo-invalid-allme", "cardId": "ctbc-allme", "cardName": "中國信託 ALL ME 信用卡", "planId": null, "level": null, "title": "【示範】已失效的外送加碼", "categoryId": null, "merchantIds": ["ubereats", "foodpanda"], "excludedMerchantIds": [], "countries": [], "paymentMethods": [], "baseRate": 0, "bonusRate": 5, "totalRate": 5, "rewardType": "點數", "rewardCap": { "kind": "unknown" }, "minSpend": null, "minSpendKnown": false, "requiresRegistration": false, "rounding": "unknown", "conditions": {}, "startDate": null, "endDate": null, "sourceUrl": "", "lastVerified": null, "status": "invalid", "exclusions": [], "notes": "示範「已失效」狀態，不參與推薦。 開發用範例值，未經官方確認，請至官方網站核對後再改為「已驗證」。" },
];

// 北捷常客優惠、中油捷利卡（null 代表資料不足）
const PROGRAMS = {
  "taipeiMetro": {
    "id": "taipei-metro-frequent-rider",
    "name": "台北捷運常客優惠",
    "status": "pending",
    "sourceUrl": "",
    "lastVerified": null,
    "startDate": null,
    "endDate": null,
    "tiers": [
      {
        "minTrips": 1,
        "maxTrips": 10,
        "rate": 0
      },
      {
        "minTrips": 11,
        "maxTrips": 20,
        "rate": 10
      },
      {
        "minTrips": 21,
        "maxTrips": 40,
        "rate": 15
      },
      {
        "minTrips": 41,
        "maxTrips": null,
        "rate": 20
      }
    ],
    "paymentEligibility": {
      "easycard": true,
      "taishin-pay-qr": null
    },
    "rewardForm": "回饋方式（電子票證回饋或其他）待確認",
    "notes": "級距與比率為開發用範例值，未經官方確認。台新 Pay QR 乘車碼是否計入常客優惠尚未確認。"
  },
  "cpcJcard": {
    "id": "cpc-jcard",
    "name": "中油捷利卡",
    "status": "pending",
    "sourceUrl": "",
    "lastVerified": null,
    "startDate": null,
    "endDate": null,
    "fuelDiscountPerLiter": null,
    "topupBonusRate": null,
    "notes": "捷利卡餘額加油折扣、儲值贈送比率資料不足。"
  }
};
