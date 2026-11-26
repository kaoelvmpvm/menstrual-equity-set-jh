/**
 * SET｜平權觀點展示牆（獨立、教師專用 Google Apps Script 專案）
 *
 * 注意：
 * 1. 本專案絕對不要與學生公開收件端 doPost 放在同一個 Apps Script 專案。
 * 2. 建議部署為「執行身分：我／存取：只有我」。
 * 3. 專案設定 → 指令碼屬性：
 *    SET_SPREADSHEET_ID = 教師學習紀錄試算表的 ID
 *    SET_WALL_TEACHERS = 唯一授權教師的 Google 電子郵件（多位以半形逗號分隔）
 * 4. 每個公開可呼叫的方法都要先驗證教師；未通過驗證不可回傳學生資料。
 */

const WALL_SOURCE_TAB = '進階分析';
const WALL_REVIEW_TAB = '展示審核';
const WALL_HEADERS = [
  '學習代碼','偏見展示核准','資源展示核准',
  '偏見公開文字','資源公開文字',
  '偏見展示標籤','資源展示標籤','審核更新時間','審核教師','偏見來源指紋','資源來源指紋'
];
const WALL_MAX_ROWS = 1500;
const WALL_MAX_TEXT = 800;

function wallTeacher_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const raw = PropertiesService.getScriptProperties().getProperty('SET_WALL_TEACHERS') || '';
  const allowed = raw.split(/[,;\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!email || allowed.indexOf(email) < 0) {
    throw new Error('無法確認教師身分，或此帳號未列入 SET_WALL_TEACHERS 授權名單。');
  }
  return email;
}

function wallSpreadsheet_() {
  const id = String(PropertiesService.getScriptProperties().getProperty('SET_SPREADSHEET_ID') || '').trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) throw new Error('請先設定 SET_SPREADSHEET_ID。');
  const ss = SpreadsheetApp.openById(id);
  if (!ss.getSheetByName(WALL_SOURCE_TAB)) throw new Error('找不到「進階分析」分頁。');
  return ss;
}

function wallReviewSheet_(ss) {
  const sheet = ss.getSheetByName(WALL_REVIEW_TAB);
  if (!sheet) throw new Error('找不到「展示審核」分頁，請按照部署指南先建立。');
  const actual = sheet.getRange(1,1,1,WALL_HEADERS.length).getDisplayValues()[0];
  if (!WALL_HEADERS.every((h,i)=>h === actual[i])) {
    throw new Error('「展示審核」欄位名稱或順序不符，請按照部署指南檢查 A1:I1。');
  }
  return sheet;
}

function wallReadRows_(sheet, ncol) {
  const n = sheet.getLastRow() - 1;
  if (n <= 0) return [];
  const count = Math.min(n, WALL_MAX_ROWS);
  return sheet.getRange(n-count+2,1,count,ncol).getDisplayValues();
}

function wallFingerprint_(title, text) {
  const contents = String(title || '') + '\u241f' + String(text || '');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, contents, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest);
}

function wallSaveText_(value) {
  const txt = String(value == null ? '' : value).trim();
  if (txt.length > WALL_MAX_TEXT) throw new Error('展示文字不得超過 800 字。');
  // 將使用者文字儲存為文字，不讓試算表當成公式執行。
  return /^[\s]*[=+\-@]/.test(txt) ? "'" + txt : txt;
}

function wallRawText_(value) {
  return String(value == null ? '' : value).trim();
}

function doGet() {
  try {
    wallTeacher_();
    const ss = wallSpreadsheet_();
    wallReviewSheet_(ss);
    return HtmlService.createHtmlOutputFromFile('Teacher')
      .setTitle('SET｜平權觀點展示牆');
  } catch (error) {
    const text = String(error && error.message || '沒有權限');
    const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return HtmlService.createHtmlOutput('<meta charset="utf-8"><div style="font-family:sans-serif;max-width:660px;margin:12vh auto;padding:32px;border:1px solid #ddd;border-radius:14px"><h2>無法開啟教師展示牆</h2><p>' + safe + '</p><p>請以已授權的學校 Google 帳號登入，並確認指令碼屬性與部署權限。</p></div>');
  }
}

/**
 * 只有授權教師可呼叫；回傳教師審核資料。
 * 投影模式只在客戶端呈現明確核准的匿名文字，不公開原始試算表 URL/API。
 */
function wallGetData() {
  const email = wallTeacher_();
  const ss = wallSpreadsheet_();
  const source = ss.getSheetByName(WALL_SOURCE_TAB);
  const review = wallReviewSheet_(ss);
  const reviewMap = Object.create(null);
  wallReadRows_(review, 11).forEach(row => {
    const id = String(row[0] || '');
    if (id) reviewMap[id] = row;
  });
  const rows = wallReadRows_(source, 11).map(row => {
    const id = String(row[1] || '').trim();
    if (!/^SET-[A-Z0-9]{6,30}$/.test(id)) return null;
    const note = reviewMap[id] || [];
    return {
      id: id,
      receivedAt: wallRawText_(row[0]),
      className: wallRawText_(row[2]),
      seat: wallRawText_(row[3]),
      name: wallRawText_(row[4]),
      biasOption: wallRawText_(row[5]),
      biasText: wallRawText_(row[6]),
      resourceOption: wallRawText_(row[7]),
      resourceText: wallRawText_(row[8]),
      biasApproved: note[1] === '是' && note[9] === wallFingerprint_(row[5], row[6]),
      resourceApproved: note[2] === '是' && note[10] === wallFingerprint_(row[7], row[8]),
      biasPublic: wallRawText_(note[3]),
      resourcePublic: wallRawText_(note[4]),
      biasTitle: wallRawText_(note[5]),
      resourceTitle: wallRawText_(note[6]),
      reviewAt: wallRawText_(note[7])
    };
  }).filter(Boolean).filter(row =>
    row.biasOption || row.biasText || row.resourceOption || row.resourceText
  );
  rows.reverse();
  return { records: rows, teacher: email, readAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss') };
}

/** 單項獨立審核；不得直接修改原始學生回答、教師成績或其他分頁。 */
function wallSaveApproval(input) {
  const teacher = wallTeacher_();
  if (!input || typeof input !== 'object') throw new Error('審核資料格式不正確。');
  const id = String(input.id || '').trim();
  const topic = String(input.topic || '');
  const approve = input.approved === true;
  if (!/^SET-[A-Z0-9]{6,30}$/.test(id)) throw new Error('學習代碼無效。');
  if (topic !== 'bias' && topic !== 'resource') throw new Error('審核類型無效。');
  if (typeof input.approved !== 'boolean') throw new Error('核准狀態無效。');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('其他審核操作正在進行，請重新操作。');
  try {
    const ss = wallSpreadsheet_();
    const source = ss.getSheetByName(WALL_SOURCE_TAB);
    const review = wallReviewSheet_(ss);
    const end = source.getLastRow();
    if (end < 2) throw new Error('找不到學生的進階分析紀錄。');
    const found = source.getRange(2,2,end-1,1).createTextFinder(id).matchEntireCell(true).findNext();
    if (!found) throw new Error('找不到這筆學習紀錄，請重新整理。');
    const origin = source.getRange(found.getRow(),1,1,11).getDisplayValues()[0];
    const title = wallRawText_(topic === 'bias' ? origin[5] : origin[7]);
    const response = wallRawText_(topic === 'bias' ? origin[6] : origin[8]);
    if (!title || !response) throw new Error('這一類學生回答尚未完成，不可核准展示。');

    const edit = wallSaveText_(input.publicText);
    if (approve && !edit) throw new Error('核准前必須先確認並填寫匿名展示文字。');

    const reviewEnd = review.getLastRow();
    const foundReview = reviewEnd > 1
      ? review.getRange(2,1,reviewEnd-1,1).createTextFinder(id).matchEntireCell(true).findNext()
      : null;
    const at = foundReview ? foundReview.getRow() : reviewEnd + 1;
    const prior = foundReview ? review.getRange(at,1,1,11).getValues()[0] :
      [id,'否','否','','','','','',teacher,'',''];
    prior[0] = id;
    if (topic === 'bias') {
      prior[1] = approve ? '是' : '否';
      prior[3] = edit;
      prior[5] = wallSaveText_(title);
      prior[9] = wallFingerprint_(title, response);
    } else {
      prior[2] = approve ? '是' : '否';
      prior[4] = edit;
      prior[6] = wallSaveText_(title);
      prior[10] = wallFingerprint_(title, response);
    }
    prior[7] = new Date();
    prior[8] = teacher;
    review.getRange(at,1,1,11).setValues([prior]);
    SpreadsheetApp.flush();
    return {ok:true};
  } finally {
    lock.releaseLock();
  }
}
