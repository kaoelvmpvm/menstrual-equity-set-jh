/**
 * 經彩同行 SET｜Google 試算表接收程式
 * 使用方式：在教師專用 Google 試算表中，開啟「擴充功能 → Apps Script」
 * 將本檔貼入程式碼編輯器，部署為網頁應用程式：
 * 「執行身分：我」、「誰可以存取：任何人」。
 * 隨後將部署網址（以 /exec 結尾）放入 GitHub config.js。
 *
 * 注意：這是公開收件端點。任何知道網址的人理論上都可提交資料；
 * 不能將其當成學生身分驗證或保密系統。勿在公開 Repository
 * 放 Google 密碼、帳號存取權杖或其他私人金鑰。
 */
const SET_TAB_SUMMARY = '學習總覽';
const SET_TAB_ATTEMPTS = '逐題作答軌跡';
const SET_TAB_ADVANCED = '進階分析';
const SET_MAX_PAYLOAD = 65000;
const SET_MAX_ATTEMPTS_PER_QUESTION = 20;

function targetSpreadsheet_() {
  // 從目標試算表建立的「綁定型」Apps Script，會直接使用該試算表。
  // 如果是由 script.google.com 單獨建立的專案，需於指令碼屬性設定
  // SET_SPREADSHEET_ID，並確保部署帳號對該試算表有編輯權限。
  const id = PropertiesService.getScriptProperties().getProperty('SET_SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function checkDestination_() {
  const ss = targetSpreadsheet_();
  if (!ss) throw new Error('NO_SPREADSHEET');
  for (const tab of [SET_TAB_SUMMARY, SET_TAB_ATTEMPTS, SET_TAB_ADVANCED]) {
    if (!ss.getSheetByName(tab)) throw new Error('MISSING_TAB');
  }
  return ss;
}

function doGet() {
  let ok = false;
  let message = '';
  try {
    checkDestination_();
    ok = true;
    message = '接收端已找到目標試算表及三個必要分頁，可進行送件測試。';
  } catch (err) {
    console.error(err);
    message = publicError_(err);
  }
  return receiptPage_(ok, message, '', true);
}

function doPost(e) {
  let session = '';
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (typeof raw !== 'string' || !raw || raw.length > SET_MAX_PAYLOAD) throw Error('提交資料無效或過大');
    const data = JSON.parse(raw);
    session = String(data.runId || '');
    validate_(data);

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) throw Error('目前提交人數較多，請稍後重試');
    try {
      const ss = checkDestination_();
      const summary = ss.getSheetByName(SET_TAB_SUMMARY);
      const attempts = ss.getSheetByName(SET_TAB_ATTEMPTS);
      const advanced = ss.getSheetByName(SET_TAB_ADVANCED);

      const identity = data.student;
      const stamp = new Date();
      const stats = data.stats;
      const report = data.advanced || {};
      const biasOption = clean_(report.biasOption, 80);
      const biasReason = clean_(report.bias, 800);
      const resourceOption = clean_(report.resourceOption, 80);
      const resourceReason = clean_(report.resource, 800);
      const common = [
        stamp, safe_(session), safe_(identity.className), safe_(identity.seatNo),
        safe_(identity.name)
      ];
      const summaryRow = common.concat([
        safe_(data.version), safe_(data.startedAt), safe_(data.finishedAt),
        Number(stats.completed), Number(stats.firstTryCorrect),
        Number(stats.revisions), safe_('B（通關）'),
        safe_(biasOption), safe_(biasReason),
        safe_(resourceOption), safe_(resourceReason), '', ''
      ]);
      const reportRow = common.concat([
        safe_(biasOption), safe_(biasReason),
        safe_(resourceOption), safe_(resourceReason), '', ''
      ]);

      // 以一次學習 runId 去重：重複提交更新總覽和分析，但不重複追加完整軌跡。
      const summaryIndex = findSessionRow_(summary, session);
      if (summaryIndex) {
        const existingTeacherGrade = summary.getRange(summaryIndex, 17, 1, 2).getValues()[0];
        summaryRow[16] = existingTeacherGrade[0];
        summaryRow[17] = existingTeacherGrade[1];
        summary.getRange(summaryIndex, 1, 1, summaryRow.length).setValues([summaryRow]);
      } else {
        summary.appendRow(summaryRow);
      }

      const advanceIndex = findSessionRow_(advanced, session);
      if (advanceIndex) {
        const existingTeacherAssessment = advanced.getRange(advanceIndex, 10, 1, 2).getValues()[0];
        reportRow[9] = existingTeacherAssessment[0];
        reportRow[10] = existingTeacherAssessment[1];
        advanced.getRange(advanceIndex, 1, 1, reportRow.length).setValues([reportRow]);
      } else {
        advanced.appendRow(reportRow);
      }

      // 每題每次作答一列，保留原始選擇順序和答案修正軌跡。
      // 即使再次提交同一 runId 也不重複增添軌跡。
      const traceIndex = findSessionRow_(attempts, session);
      if (!traceIndex) {
        const rows = [];
        data.questions.forEach(q => {
          (q.attempts || []).forEach((a, idx) => {
            rows.push(common.concat([
              safe_(q.id), safe_(q.chapter), safe_(q.concept),
              safe_(q.question), idx + 1,
              safe_(a.choiceCode), safe_(a.selection),
              !!a.correct, safe_(a.at), !!q.correct
            ]));
          });
        });
        if (rows.length) {
          attempts.getRange(attempts.getLastRow() + 1, 1, rows.length, 15).setValues(rows);
        }
      }
    } finally {
      lock.releaseLock();
    }
    return respond_(session, true, '');
  } catch (err) {
    // 不回傳內部設定或試算表資訊給公開網站。
    console.error(err);
    return respond_(session, false, publicError_(err));
  }
}

function validate_(data) {
  if (!data || typeof data !== 'object') throw Error('資料不存在');
  if (typeof data.runId !== 'string' || !/^SET-[A-Z0-9]{6,30}$/.test(data.runId)) throw Error('學習代碼不正確');
  if (typeof data.version !== 'string' || data.version.length > 40) throw Error('教材版本不正確');
  const p = data.student || {};
  if (!/^[\p{L}\p{N}\- ]{1,20}$/u.test(String(p.className || ''))) throw Error('班級不正確');
  if (!/^\d{1,3}$/.test(String(p.seatNo || '')) || +p.seatNo < 1 || +p.seatNo > 99) throw Error('座號不正確');
  if (!/^[\p{L}\p{M} ·．]{1,30}$/u.test(String(p.name || ''))) throw Error('姓名不正確');
  if (!data.consent) throw Error('尚未同意資料送交');
  if (!Array.isArray(data.questions) || data.questions.length !== 10) throw Error('題目數量不符');
  if (!data.stats || data.stats.completed !== 10) throw Error('尚未通過全部題目');
  if (typeof data.advanced !== 'object') throw Error('進階資料不正確');

  let retry = 0, firstCorrect = 0;
  const seen = new Set();
  data.questions.forEach((q) => {
    if (!/^Q\d{2}$/.test(String(q.id || '')) || seen.has(q.id)) throw Error('題號重複或不正確');
    seen.add(q.id);
    if (!q.correct || !Array.isArray(q.attempts) ||
        q.attempts.length < 1 || q.attempts.length > SET_MAX_ATTEMPTS_PER_QUESTION) throw Error('作答紀錄不完整');
    if (!q.attempts[q.attempts.length - 1].correct) throw Error('最後一次作答未通過');
    if (q.attempts[0].correct) firstCorrect++;
    retry += q.attempts.length - 1;
    q.attempts.forEach(a => {
      if (!/^[ABC]$/.test(String(a.choiceCode || ''))) throw Error('選項代碼不正確');
      if (typeof a.correct !== 'boolean') throw Error('答題狀態不正確');
      if (typeof a.selection !== 'string' || a.selection.length > 350) throw Error('選項文字過長');
      if (typeof a.at !== 'string' || a.at.length > 45) throw Error('時間資訊不正確');
    });
  });
  if (data.stats.firstTryCorrect !== firstCorrect || data.stats.revisions !== retry) throw Error('統計數據不一致');
}

function findSessionRow_(sheet, session) {
  if (sheet.getLastRow() < 2) return 0;
  const cell = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1)
    .createTextFinder(session).matchEntireCell(true).findNext();
  return cell ? cell.getRow() : 0;
}
function clean_(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
function safe_(v) {
  const s = String(v == null ? '' : v);
  // 防止提交內容被 Google 試算表誤認為公式。
  return /^[\s]*[=+\-@]/.test(s) ? "'" + s : s;
}
function publicError_(err) {
  const msg = String(err && err.message || '');
  if (msg.includes('NO_SPREADSHEET')) return '找不到綁定的試算表。請在 Google Apps Script 指令碼屬性設定 SET_SPREADSHEET_ID，或從目標試算表開啟 Apps Script。';
  if (msg.includes('MISSING_TAB')) return '找不到「學習總覽」「逐題作答軌跡」「進階分析」其中一個分頁，請確認試算表。';
  if (/permission|access|authorization|權限|授權|You do not have/i.test(msg)) return '部署帳號沒有目標試算表的存取或編輯權限，請確認共用權限與執行身分。';
  if (msg.includes('提交資料無效或過大')) return '送出資料格式錯誤或超過大小限制，請下載學習紀錄備份。';
  if (msg.includes('作答紀錄') || msg.includes('統計數據') || msg.includes('題目數量')) return '作答資料驗證失敗，請回遊戲檢查通關狀態後重新送出。';
  if (msg.includes('目前提交人數較多')) return '同時提交的人數較多，請稍後再試。';
  return 'Google 試算表未完成儲存。請由教師到 Apps Script 的「執行作業」查看錯誤紀錄。';
}

function receiptPage_(success, message, session, isHealth) {
  const title = success ? (isHealth ? '連線診斷通過' : '學習紀錄已儲存') :
    (isHealth ? '接收端尚未準備完成' : '學習紀錄送出失敗');
  const safeText = String(message || '').replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const payload = JSON.stringify({
    type:'SET_SHEET_RESPONSE',
    sessionId:String(session || ''),
    success:!!success,
    message:String(message || '')
  }).replace(/</g, '\\u003c');
  const html = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:sans-serif;background:#f5f3ee;color:#25334a;margin:0;padding:30px;}' +
    'main{max-width:560px;background:white;padding:32px;margin:6vh auto;border:1px solid #d9ddd9;border-radius:16px;}' +
    'h1{font-size:25px}p{line-height:1.9}.status{color:' + (success?'#23754e':'#b34942') +
    ';font-weight:bold}.note{font-size:13px;color:#697484}</style></head><body><main>' +
    '<div class="status">' + (success ? '● 已通過' : '● 未通過') + '</div>' +
    '<h1>' + title + '</h1><p>' + safeText + '</p>' +
    '<p class="note">' + (isHealth ? '此頁只驗證連線，未寫入學生紀錄。' :
      '若送出失敗，請先從原遊戲下載學習紀錄備份。') + '</p>' +
    '</main><script>' +
    'try{if(window.opener)window.opener.postMessage(' + payload +
      ', "https://kaoelvmpvm.github.io");}catch(e){}' +
    'try{if(window.parent&&window.parent!==window)window.parent.postMessage(' + payload +
      ', "https://kaoelvmpvm.github.io");}catch(e){}' +
    '</script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function respond_(session, success, message) {
  return receiptPage_(success, message || (success ? '資料已寫入教師的學習歷程試算表。' : ''), session, false);
}
