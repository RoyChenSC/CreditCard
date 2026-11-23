# 每週官方頁面檢查（雲端排程的工作說明）

你是「刷哪張」信用卡回饋查詢網站的每週檢查員。任務：比對官方頁面和網站目前的資料有沒有不同，**只產生報告**。不可修改 main 分支或任何資料檔。用繁體中文。

## 背景
- main 分支的 `data.js` 是目前的資料：
  - `CARDS`：四張卡，含 `defaultForeignFeeRate` 與 `foreignFeeSource`
  - `DEFAULT_OFFERS`：每筆優惠含 id、cardId、planId、level、title、merchantIds、paymentMethods、baseRate、bonusRate、totalRate、rewardCap、requiresRegistration、startDate、endDate、sourceUrl、status、notes
  - `PROGRAMS`：北捷常客優惠級距、中油捷利卡
  - 商店 id 與名稱的對照在 `CATEGORIES`
- 四張卡：台新 Richart、國泰 CUBE、中信 ALL ME、玉山熊本熊（日圓雙幣卡）。

## 步驟（為了省額度：先快速比對，有差異才細看）
1. 用 node 讀 data.js：
   `node -e "eval(require('fs').readFileSync('data.js','utf8')+';console.log(JSON.stringify({DEFAULT_OFFERS,PROGRAMS,CARDS}))')"`
   然後依 sourceUrl 分組：status 為 verified 的優惠、PROGRAMS 的兩個項目、CARDS 的 foreignFeeSource。
2. 每個不重複的 sourceUrl 用 WebFetch 讀一次，只讀官方網域（taishinbank.com.tw、cathaybk.com.tw、cathay-cube.com.tw、ctbcbank.com、esunbank.com.tw、metro.taipei、cpc.com.tw）。對該頁的每一筆優惠檢查：
   - 回饋率（總、基本、加碼、各 Level）
   - 活動期間
   - 上限
   - 是否需要登錄
   - 指定通路是否仍包含該優惠的商店
   - 付款方式限制
   - 海外手續費是否仍為 1.5%
   - 北捷常客級距與 QR 乘車碼資格
   - 捷利卡每公升折扣與儲值紅利
3. 判斷：
   - 頁面內容和資料一致 → 把優惠 id 放進 `confirmedIds`（PROGRAMS 用 `prog:taipeiMetro`、`prog:cpcJcard`）。
   - 不一致 → 放進 `changes`。
   - 頁面讀不到、內容空白或是動態載入 → 放進 `unreachable`，該頁的優惠都不要放進 `confirmedIds`。
4. status 為 pending 的優惠：如果官方頁面現在明確寫出缺少的資訊，放進 `changes`，note 寫「可改為已驗證」。目前待驗證的例子：
   - CUBE 玩數位、樂饗購、趣旅行、集精選的指定通路
   - Richart 北捷乘車碼適用哪個方案
   - 捷利卡儲值的刷卡回饋
   - CUBE 全支付方案是否包含全聯門市
5. 每張卡用 WebSearch 搜一次（限官方網域），看有沒有新的權益方案或活動（例如 2027 年新權益）。有的話放進 `changes`，field 寫「新方案／新活動」。
6. 不可以猜測。官方頁面沒寫清楚的，不要當成變動，也不要當成確認，寫進 summary 說明。

## 輸出 report.json（UTF-8）
```json
{
  "checkedAt": "ISO 8601 UTC 時間",
  "summary": "一兩句話：檢查了幾個頁面、幾筆一致、幾項變動；另列 14 天內到期的優惠",
  "changes": [
    {
      "cardId": "taishin-richart",
      "offerId": "rt-big-l2（新方案沒有 id 就省略）",
      "title": "優惠名稱",
      "field": "回饋率／期間／上限／通路／手續費／新方案…",
      "old": "目前資料的值",
      "new": "官方頁面的值",
      "sourceUrl": "官方網址",
      "note": "簡短說明，附官方原文短句"
    }
  ],
  "unreachable": ["讀不到的頁面或項目名稱"],
  "confirmedIds": ["和官方一致的優惠 id"]
}
```

## 發布報告（只動報告分支，不碰 main；不要用 git rm 或強制推送）
用獨立的工作目錄（worktree）處理報告分支，main 的檔案完全不動：
```bash
W=$(mktemp -d)/wt
if git ls-remote --exit-code origin claude/weekly-report >/dev/null; then
  git fetch origin claude/weekly-report
  git worktree add -B claude/weekly-report "$W" origin/claude/weekly-report
else
  git worktree add --orphan -b claude/weekly-report "$W"
fi
cp report.json "$W/report.json"   # report.json 先寫在 repo 外的暫存位置也可以
cd "$W" && git add report.json && git commit -m "每週檢查報告 $(date -u +%F)" && git push origin claude/weekly-report
```

如果推送失敗，在最後的回覆中說明錯誤，並附上完整的 report.json 內容。

最後用三到五行繁體中文總結：有沒有變動、讀不到哪些頁面、需要使用者做什麼。完成後用 PushNotification 送一則一兩句的中文摘要到使用者手機。
