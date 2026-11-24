/*
 * SET browser workflow smoke test (no real student data or network requests).
 * Run locally: node tests/smoke.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = filename => fs.readFileSync(path.join(root, filename), "utf8");

class FakeElement {
  constructor(tag="div") {
    this.tagName=tag.toLowerCase(); this.children=[]; this.hidden=false;
    this.disabled=false; this.checked=false; this.value=""; this.textContent="";
    this.events={}; this.attrs={}; this.style={}; this.contentWindow={};
    const c=new Set();
    this.classList={add:v=>c.add(v),remove:v=>c.delete(v),contains:v=>c.has(v),toggle:(v,on)=>on?c.add(v):c.delete(v)};
  }
  addEventListener(type,fn){this.events[type]=fn}
  click(){if(!this.disabled&&this.events.click)this.events.click()}
  focus(){this.focused=true}
  append(...items){this.children.push(...items)}
  remove(){}
  replaceChildren(...items){this.children=items}
  setAttribute(k,v){this.attrs[k]=v}
  querySelectorAll(t){return this.children.filter(e=>e.tagName===t)}
  scrollIntoView(){}
  submit(){this.submitted=true}
}
const html=read("index.html");
const idList=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const nodes=Object.fromEntries(idList.map(id=>[id,new FakeElement()]));
const document={
  getElementById:id=>nodes[id],
  createElement:tag=>new FakeElement(tag),
  body:new FakeElement("body")
};
const memory=new Map();
const localStorage={getItem:k=>memory.get(k)||null,setItem:(k,value)=>memory.set(k,value)};
const window={confirm:()=>true,scrollTo(){},open:()=>({}),addEventListener(){},isSecureContext:true};
const context={window,document,localStorage,navigator:{},URL:{
  createObjectURL:()=>"blob:local",revokeObjectURL(){}
},Blob:class Blob{constructor(parts){this.parts=parts}},setTimeout:()=>1,clearTimeout(){}};
vm.runInNewContext(read("data/questions.js"),context);
vm.runInNewContext(read("config.js"),context);
vm.runInNewContext(read("assets/app.js"),context);
const data=window.SET_CONTENT.questions;
const state=()=>JSON.parse(memory.get("menstrual-equity-set-jh.v2"));

assert.equal(nodes.cloudConsent.checked,false,"cloud upload must be explicitly opted into");
nodes.studentClass.value="815";
nodes.studentSeat.value="08";
nodes.studentName.value="測試者";
nodes.privacyConsent.checked=true;
nodes.startBtn.click();
assert.equal(nodes.gameScreen.hidden,false,"start game");

nodes.optionList.children[0].click();
assert.equal(nodes.feedbackBox.hidden,false,"show error feedback");
nodes.backHomeBtn.click();
assert.equal(nodes.resumeBtn.hidden,false,"a wrong-only attempt is resumable");
nodes.studentName.value="另一名同學";
nodes.resumeBtn.click();
assert.equal(nodes.gameScreen.hidden,true,"block wrong-identity resume");
assert.equal(state().student.name,"測試者","do not overwrite saved identity");
nodes.studentName.value="測試者";
nodes.resumeBtn.click();
assert.equal(nodes.gameScreen.hidden,false);
assert.equal(nodes.feedbackBox.hidden,false,"restore error explanation on resume");
nodes.optionList.children[data[0].correct].click();
for(let i=1;i<data.length;i++){
  nodes.nextBtn.click();
  nodes.optionList.children[data[i].correct].click();
}
nodes.nextBtn.click();
assert.equal(nodes.resultScreen.hidden,false,"display completion screen");
assert.equal(nodes.statFirst.textContent,"9");
assert.equal(nodes.statRetry.textContent,"1");
assert.equal(state().student.name,"測試者");

nodes.resetBtn.click();
assert.equal(state().student.name,"","clear local identity after user confirmation");
assert.equal(Object.keys(state().answers).length,0,"clear answers locally");

console.log("PASS: cloud consent, wrong-only resume, identity guard, restored feedback, 10-question completion, and local data clearance");
