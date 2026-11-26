/** SET 教師審核平台回歸測試：node teacher-wall/tests/smoke.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const serverCode = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8');
const page = fs.readFileSync(path.join(root, 'Teacher.html'), 'utf8');
new vm.Script(serverCode, {filename:'Code.gs'});
const clientCode = page.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(clientCode, 'Teacher.html must contain client script');
new vm.Script(clientCode[1], {filename:'Teacher.html'});

const sourceHeader = ['接收時間','學習代碼','班級','座號','姓名','偏見選擇','偏見原因及影響','資源障礙選擇','資源障礙原因及影響','教師判讀','回饋備註'];
const reviewHeader = ['學習代碼','偏見展示核准','資源展示核准','偏見公開文字','資源公開文字','偏見展示標籤','資源展示標籤','審核更新時間','審核教師','偏見來源指紋','資源來源指紋'];
const store = {
 '進階分析': [
  sourceHeader,
  ['2026/11/26 08:00:00','SET-AA123456','815','08','示範學生',
   '拿月經開玩笑','嘲笑可能使人不敢求助','領取缺乏隱私','學生可能不願公開領取','','']
 ],
 '展示審核':[reviewHeader]
};
class FakeRange {
 constructor(rows,r,c,nr,nc){Object.assign(this,{rows,r,c,nr,nc})}
 getValues(){return Array.from({length:this.nr},(_,i)=>Array.from({length:this.nc},(_,j)=>this.rows[this.r-1+i]?.[this.c-1+j]??''))}
 getDisplayValues(){return this.getValues().map(row=>row.map(v=>String(v??'')))}
 setValues(values){values.forEach((row,i)=>{while(this.rows.length<this.r+i)this.rows.push([]);row.forEach((value,j)=>this.rows[this.r-1+i][this.c-1+j]=value)})}
 createTextFinder(needle){const current=this;return {matchEntireCell(){return this},findNext(){for(let i=0;i<current.nr;i++)if(String(current.rows[current.r-1+i]?.[current.c-1])===needle)return {getRow:()=>current.r+i};return null}}}
}
const book={getSheetByName:n=>store[n]?{
 getLastRow:()=>store[n].length,
 getRange:(r,c,nr,nc)=>new FakeRange(store[n],r,c,nr,nc)
}:null};
let email='teacher@example.org';
const context={
 Session:{
  getActiveUser:()=>({getEmail:()=>email}),
  getScriptTimeZone:()=>'Asia/Taipei'
 },
 PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='SET_WALL_TEACHERS'?'teacher@example.org':'123456789abcdefghijklmnopqrst'})},
 SpreadsheetApp:{openById:()=>book,flush(){}},
 Utilities:{
  DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
  computeDigest:(_,v)=>[...crypto.createHash('sha256').update(v,'utf8').digest()],
  base64EncodeWebSafe:arr=>Buffer.from(arr).toString('base64url'),
  formatDate:()=>new Date().toISOString()
 },
 LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
 HtmlService:{createHtmlOutput:s=>({html:s}),createHtmlOutputFromFile:()=>({setTitle:()=>({})})},
 console
};
vm.createContext(context);vm.runInContext(serverCode,context);
const data=()=>context.wallGetData().records;
assert.equal(data().length,1,'original reflection visible to teacher');
assert.equal(data()[0].biasApproved,false,'default approval must be off');
assert.equal(data()[0].resourceApproved,false,'default resource approval must be off');
const initialSource=JSON.stringify(store['進階分析']);
context.wallSaveApproval({id:'SET-AA123456',topic:'bias',approved:true,publicText:'匿名內容：不應嘲笑'});
assert.equal(data()[0].biasApproved,true,'approved bias becomes eligible');
assert.equal(data()[0].resourceApproved,false,'other category remains private');
assert.equal(data()[0].biasTitle,'拿月經開玩笑');
assert.equal(data()[0].biasPublic,'匿名內容：不應嘲笑');
assert.equal(JSON.stringify(store['進階分析']),initialSource,'original sheet must remain untouched');
store['進階分析'][1][6]='重新提交的新回答';
assert.equal(data()[0].biasApproved,false,'new student reply must invalidate old approval');
context.wallSaveApproval({id:'SET-AA123456',topic:'bias',approved:true,publicText:'重新核准的匿名內容'});
assert.equal(data()[0].biasApproved,true,'reapproval of updated source works');
context.wallSaveApproval({id:'SET-AA123456',topic:'bias',approved:false,publicText:'重新核准的匿名內容'});
assert.equal(data()[0].biasApproved,false,'revocation works');
context.wallSaveApproval({id:'SET-AA123456',topic:'resource',approved:true,publicText:'取得方式應考慮隱私'});
assert.equal(data()[0].resourceApproved,true,'resource category can be approved independently');
assert.equal(data()[0].biasApproved,false,'independent approval did not reapprove bias');
assert.throws(()=>context.wallSaveApproval({id:'SET-AA123456',topic:'resource',approved:true,publicText:''}),/必須先確認/);
assert.throws(()=>context.wallSaveApproval({id:'SET-AA123456',topic:'wrong',approved:true,publicText:'無效'}),/類型無效/);
email='unauthorized@example.org';
assert.throws(()=>context.wallGetData(),/未列入/,'other accounts cannot read private records');
assert.throws(()=>context.wallSaveApproval({id:'SET-AA123456',topic:'bias',approved:true,publicText:'不應寫入'}),/未列入/,'other accounts cannot write approval');
console.log('PASS: Teacher wall syntax, auth, approvals, reapproval, revocation, source change invalidation, and source-sheet preservation');
