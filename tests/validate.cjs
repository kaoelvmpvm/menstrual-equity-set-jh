const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const sandbox={window:{}};
vm.runInNewContext(read("data/questions.js"),sandbox);
const data=sandbox.window.SET_CONTENT;
assert.ok(data,"題庫無法載入");
assert.equal(data.questions.length,10,"題目應為十題");
assert.equal(data.characters.length,4,"角色應為四名");
assert.equal(data.chapters.length,4,"章節應為四章");

const chapters=new Map(data.chapters.map(c=>[c.id,c]));
const characters=new Set(data.characters.map(c=>c.id));
const ids=new Set();
const tally={};
for(const q of data.questions){
  assert.ok(!ids.has(q.id),"題號重複："+q.id);ids.add(q.id);
  assert.ok(chapters.has(q.chapter),"章節未知："+q.id);
  assert.ok(characters.has(q.speaker),"角色未知："+q.id);
  assert.equal(q.options.length,3,"選項必須有三個："+q.id);
  assert.ok(Number.isInteger(q.correct)&&q.correct>=0&&q.correct<3,"正解索引錯誤："+q.id);
  assert.ok(q.scene&&q.title&&q.explanation&&q.principle,"題目文字缺漏："+q.id);
  for(const o of q.options)assert.ok(o.text&&o.feedback,"選項或回饋缺漏："+q.id);
  tally[q.chapter]=(tally[q.chapter]||0)+1;
}
for(const ch of data.chapters)assert.equal(tally[ch.id],ch.count,"章節題數不符："+ch.id);

new vm.Script(read("assets/app.js"));
const html=read("index.html");
const app=read("assets/app.js");
const htmlIds=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
for(const match of app.matchAll(/byId\("([^"]+)"\)/g)){
  assert.ok(htmlIds.has(match[1]),"頁面元件 ID 缺漏："+match[1]);
}
assert.ok(!html.includes("<img"),"本版角色圖應維持空白佔位，勿提前置入圖片");
console.log("PASS: 10 題、4 章、4 名角色、答案、回饋、章節數量與頁面元件均檢核通過");
