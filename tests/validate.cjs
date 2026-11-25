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
assert.ok(html.includes('src="./assets/characters/prince.png"'),"首頁王子立繪缺漏");
assert.ok(html.includes('id="sceneImage"'),"遊戲情境圖片元件缺漏");
assert.ok(html.includes('id="speakerAvatar"'),"遊戲角色圖片元件缺漏");
assert.ok(app.includes('"./assets/scenes/"+q.id+".webp"'),"未依題號載入情境圖片");
assert.ok(app.includes('"./assets/characters/"+c.id+".png"'),"未依角色載入角色圖片");

const pngSig=Buffer.from([137,80,78,71,13,10,26,10]);
for(const c of data.characters){
  const p=path.join(root,"assets","characters",c.id+".png");
  assert.ok(fs.existsSync(p),"找不到角色立繪："+p);
  const bytes=fs.readFileSync(p);
  assert.ok(bytes.length>1000,"角色圖檔過小："+p);
  assert.ok(bytes.subarray(0,8).equals(pngSig),"角色圖不是有效 PNG："+p);
}
for(const q of data.questions){
  const p=path.join(root,"assets","scenes",q.id+".webp");
  assert.ok(fs.existsSync(p),"找不到情境插圖："+p);
  const bytes=fs.readFileSync(p);
  assert.ok(bytes.length>1000,"情境圖檔過小："+p);
  assert.equal(bytes.toString("ascii",0,4),"RIFF","情境圖 RIFF 標頭異常："+p);
  assert.equal(bytes.toString("ascii",8,12),"WEBP","情境圖 WebP 標頭異常："+p);
}
console.log("PASS: 10 題、4 章、4 名角色、14 張圖片格式、題目路徑與頁面元件均檢核通過");
