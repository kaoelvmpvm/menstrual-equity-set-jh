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

function doGet() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><head><meta charset="utf-8"></head>' +
    '<body>經彩同行 SET 學習紀錄接收端已啟用；僅接受遊戲送出的 POST 紀錄。</body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) throw Error('請從目標試算表的「擴充功能 → Apps Script」建立本程式');
      const summary = ss.getSheetByName(SET_TAB_SUMMARY);
      const attempts = ss.getSheetByName(SET_TAB_ATTEMPTS);
      const advanced = ss.getSheetByName(SET_TAB_ADVANCED);
      if (!summary || !attempts || !advanced) throw Error('找不到必要工作表：學習總覽、逐題作答軌跡、進階分析');

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
    return respond_(session, false, '資料未完成儲存，請下載備份或重新提交。');
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
function respond_(session, success, message) {
  const body = JSON.stringify({
    type:'SET_SHEET_RESPONSE',sessionId:session,
    success:!!success,message:message || ''
  }).replace(/</g,'\\u003c');
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>window.parent.postMessage(' + body + ', "*");</script>' +
    (success ? '學習紀錄已儲存' : '提交未完成') +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
