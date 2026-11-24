(function () {
  "use strict";
  var DATA = window.SET_CONTENT;
  if (!DATA || !Array.isArray(DATA.questions)) {
    document.body.innerHTML = "<p style='padding:32px'>題庫讀取失敗，請重新整理或檢查 data/questions.js。</p>";
    return;
  }
  var KEY = "menstrual-equity-set-jh.v2";
  var CONFIG = window.SET_CONFIG || {};
  var SHEET_URL = typeof CONFIG.collectionEndpoint==="string" ? CONFIG.collectionEndpoint.trim() : "";
  var CLOUD_READY = /^https:\/\/script\.google\.com\/(?:a\/macros\/[a-zA-Z0-9.-]+\/s|macros\/s)\/[a-zA-Z0-9_-]+\/exec$/.test(SHEET_URL);
  var cloudTimeout = null;
  var TOTAL = DATA.questions.length;
  var byId = function (id) { return document.getElementById(id); };
  var refs = {
    home:byId("homeScreen"),game:byId("gameScreen"),result:byId("resultScreen"),
    studentClass:byId("studentClass"),studentSeat:byId("studentSeat"),
    studentName:byId("studentName"),privacyConsent:byId("privacyConsent"),identityError:byId("identityError"),
    cloudConsent:byId("cloudConsent"),submitCloud:byId("submitCloudBtn"),
    cloudTitle:byId("cloudStatusTitle"),cloudDesc:byId("cloudStatusDescription"),
    submitFrame:byId("submissionFrame"),biasSelect:byId("biasSelect"),resourceSelect:byId("resourceSelect"),
    cast:byId("castGrid"),chapterPreview:byId("chapterPreview"),
    start:byId("startBtn"),resume:byId("resumeBtn"),reset:byId("resetBtn"),
    backHome:byId("backHomeBtn"),prev:byId("prevBtn"),next:byId("nextBtn"),
    options:byId("optionList"),feedback:byId("feedbackBox"),
    feedbackHeading:byId("feedbackHeading"),feedbackText:byId("feedbackText"),
    counter:byId("counterLabel"),chapter:byId("chapterLabel"),
    caseNo:byId("caseNo"),caseTopic:byId("caseTopic"),
    speakerName:byId("speakerName"),speakerRole:byId("speakerRole"),
    portraitName:byId("portraitName"),scene:byId("sceneText"),
    gameTitle:byId("gameTitle"),questionType:byId("questionType"),
    attemptsLabel:byId("attemptsLabel"),progress:byId("progressTrack"),
    progressFill:byId("progressFill"),
    first:byId("statFirst"),retry:byId("statRetry"),finish:byId("statFinish"),
    bias:byId("biasAnswer"),resource:byId("resourceAnswer"),
    reviewNote:byId("reviewNote"),saveAdvanced:byId("saveAdvancedBtn"),
    exportText:byId("exportTextBtn"),exportJson:byId("exportJsonBtn"),
    copySummary:byId("copySummaryBtn"),exportStatus:byId("exportStatus"),
    review:byId("reviewBtn"),restart:byId("restartBtn")
  };
  function validateQuestions() {
    if (TOTAL !== 10) return false;
    var ids = {};
    for (var i=0;i<TOTAL;i++) {
      var q=DATA.questions[i];
      if (!q.id || ids[q.id] || !q.title || !q.scene ||
          !q.speaker || !q.explanation || !q.principle ||
          !DATA.chapters.some(function (c) { return c.id===q.chapter; }) ||
          !DATA.characters.some(function (c) { return c.id===q.speaker; }) ||
          !Array.isArray(q.options) || q.options.length!==3 ||
          !Number.isInteger(q.correct) || q.correct<0 || q.correct>2 ||
          q.options.some(function (o) { return !o.text || !o.feedback; })) return false;
      ids[q.id]=true;
    }
    return true;
  }
  if (!validateQuestions()) {
    document.body.innerHTML="<p style='padding:32px'>題庫資料驗證失敗，請檢查十題及對應的情境資料。</p>";
    return;
  }
  var hasStorage=true;
  function newState() {
    return {version:DATA.version,runId:"SET-"+Math.random().toString(36).slice(2,10).toUpperCase(),
      startedAt:new Date().toISOString(),finishedAt:null,current:0,answers:{},
      student:{className:"",seatNo:"",name:"",consent:false},
      advanced:{biasOption:"",bias:"",resourceOption:"",resource:"",savedAt:null}};
  }
  function load() {
    try {
      var raw=localStorage.getItem(KEY);
      if (!raw) return newState();
      var obj=JSON.parse(raw);
      if (!obj || obj.version!==DATA.version || !obj.answers || !obj.advanced || !obj.student) return newState();
      obj.current=Math.max(0,Math.min(TOTAL-1,Number(obj.current)||0));
      return obj;
    } catch(e) {hasStorage=false;return newState();}
  }
  var state=load();
  function persist() {
    if (!hasStorage) return;
    try {localStorage.setItem(KEY,JSON.stringify(state));}
    catch(e) {hasStorage=false;}
  }
  function isDone(q) {
    var record=state.answers[q.id];
    return !!(record && record.correct===true);
  }
  function completedCount() {
    return DATA.questions.filter(isDone).length;
  }
  function allDone() {return completedCount()===TOTAL;}
  function firstCorrectCount() {
    return DATA.questions.filter(function (q) {
      var r=state.answers[q.id];
      return r && r.attempts && r.attempts.length===1 && r.correct;
    }).length;
  }
  function retryCount() {
    return DATA.questions.reduce(function (sum,q) {
      var r=state.answers[q.id];return sum+(r && r.attempts ? Math.max(0,r.attempts.length-1):0);
    },0);
  }
  function show(screen) {
    refs.home.hidden=screen!=="home";
    refs.game.hidden=screen!=="game";
    refs.result.hidden=screen!=="result";
    window.scrollTo({top:0,behavior:"auto"});
  }
  function makeNode(tag,cls,text) {
    var n=document.createElement(tag);
    if (cls) n.className=cls;
    if (text!=null) n.textContent=text;
    return n;
  }
  function setupHome() {
    refs.chapterPreview.replaceChildren();
    DATA.chapters.forEach(function(c) {
      var card=makeNode("article","chapter-card");
      card.append(makeNode("div","chapter-no",c.number),
                  makeNode("h3","",c.title),makeNode("p","",c.description),
                  makeNode("small","",c.count+" 項任務"));
      refs.chapterPreview.append(card);
    });
    refs.cast.replaceChildren();
    DATA.characters.forEach(function (c) {
      var card=makeNode("article","cast-card");
      var image=makeNode("div","cast-portrait");
      image.append(makeNode("span","shape","◇"),makeNode("span","","角色圖片待補"));
      var info=makeNode("div","cast-info");
      info.append(makeNode("h3","",c.name),makeNode("p","",c.description));
      card.append(image,info);refs.cast.append(card);
    });
    var hasProgress=completedCount()>0;
    refs.resume.hidden=!hasProgress;
    refs.start.textContent=hasProgress?"開始新一輪調查 →":"開始十項調查 →";
  }
  function home() {
    setupHome();
    refs.studentClass.value=state.student.className||"";
    refs.studentSeat.value=state.student.seatNo||"";
    refs.studentName.value=state.student.name||"";
    refs.privacyConsent.checked=!!state.student.consent;
    refs.identityError.textContent="";
    show("home");
  }
  function captureIdentity() {
    var className=refs.studentClass.value.trim();
    var seatNo=refs.studentSeat.value.trim();
    var name=refs.studentName.value.trim();
    if (!/^[\p{L}\p{N}\- ]{1,20}$/u.test(className)) {
      refs.identityError.textContent="請填寫班級（例如：815）。";refs.studentClass.focus();return false;
    }
    if (!/^\d{1,3}$/.test(seatNo) || Number(seatNo)<1 || Number(seatNo)>99) {
      refs.identityError.textContent="請填寫正確的座號。";refs.studentSeat.focus();return false;
    }
    if (!/^[\p{L}\p{M} ·．]{1,30}$/u.test(name)) {
      refs.identityError.textContent="請填寫正確姓名。";refs.studentName.focus();return false;
    }
    if (!refs.privacyConsent.checked) {
      refs.identityError.textContent="請先閱讀並勾選學習資料使用說明。";refs.privacyConsent.focus();return false;
    }
    state.student={className:className,seatNo:seatNo,name:name,consent:true};
    persist();refs.identityError.textContent="";return true;
  }
  function findChapter(id) {
    return DATA.chapters.find(function(c){return c.id===id;})||DATA.chapters[0];
  }
  function findCharacter(id) {
    return DATA.characters.find(function(c){return c.id===id;})||DATA.characters[0];
  }
  function goGame(index) {
    state.current=Math.max(0,Math.min(TOTAL-1,index));
    persist();
    renderGame();
    show("game");
  }
  function recordFor(q) {
    if (!state.answers[q.id]) state.answers[q.id]={attempts:[],correct:false};
    return state.answers[q.id];
  }
  var currentWrongIndex=null;
  function renderGame() {
    var q=DATA.questions[state.current];
    var chapter=findChapter(q.chapter);
    var person=findCharacter(q.speaker);
    var record=state.answers[q.id];
    var complete=isDone(q);
    currentWrongIndex=null;
    refs.chapter.textContent="第"+chapter.number+"章｜"+chapter.title;
    refs.counter.textContent=(state.current+1)+" / "+TOTAL;
    refs.caseNo.textContent="調查 "+String(state.current+1).padStart(2,"0");
    refs.caseTopic.textContent=q.tag;
    refs.speakerName.textContent=person.name;
    refs.speakerRole.textContent=person.role;
    refs.portraitName.textContent=person.name;
    refs.scene.textContent=q.scene;
    refs.gameTitle.textContent=q.title;
    refs.questionType.textContent=q.type;
    refs.attemptsLabel.textContent=complete?"本題已完成":"可重新嘗試";
    refs.progress.setAttribute("aria-valuenow",String(completedCount()));
    refs.progressFill.style.width=(completedCount()/TOTAL*100)+"%";
    refs.options.replaceChildren();
    q.options.forEach(function(opt,i) {
      var btn=makeNode("button","option-button");
      btn.type="button";
      var letter=makeNode("span","choice-letter",String.fromCharCode(65+i));
      btn.append(letter,makeNode("span","",opt.text));
      if (complete) {
        btn.disabled=true;
        if (i===q.correct) btn.classList.add("is-correct");
      } else if (record && record.attempts.some(function(a){return a.choice===i && !a.correct;})) {
        btn.disabled=true;
        btn.classList.add("is-wrong");
        btn.setAttribute("aria-label",opt.text+"；已嘗試，可改選其他答案");
      } else {
        btn.addEventListener("click",function(){choose(i);});
      }
      refs.options.append(btn);
    });
    refs.feedback.hidden=!complete;
    refs.feedback.classList.toggle("is-success",complete);
    if (complete) {
      refs.feedbackHeading.textContent="✓ 判斷完成｜"+q.principle;
      refs.feedbackText.textContent=q.explanation;
    } else {
      refs.feedbackHeading.textContent="";
      refs.feedbackText.textContent="";
    }
    refs.prev.disabled=state.current===0;
    refs.next.hidden=!complete;
    refs.next.textContent=state.current===TOTAL-1?"查看通關結果 →":"下一項任務 →";
  }
  function choose(index) {
    var q=DATA.questions[state.current];
    var r=recordFor(q);
    if (r.correct || index<0 || index>2) return;
    var correct=index===q.correct;
    r.attempts.push({choice:index,correct:correct,at:new Date().toISOString()});
    if (correct) {
      r.correct=true;
      r.correctAt=new Date().toISOString();
      if (allDone() && !state.finishedAt) state.finishedAt=new Date().toISOString();
      persist();
      renderGame();
    } else {
      persist();
      currentWrongIndex=index;
      var buttons=refs.options.querySelectorAll("button");
      buttons[index].disabled=true;
      buttons[index].classList.add("is-wrong");
      refs.feedback.hidden=false;
      refs.feedback.classList.remove("is-success");
      refs.feedbackHeading.textContent="再想一次｜這個推論需要修正";
      refs.feedbackText.textContent=q.options[index].feedback;
      refs.attemptsLabel.textContent="已嘗試 "+r.attempts.length+" 次";
    }
    refs.feedback.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  function next() {
    if (!isDone(DATA.questions[state.current])) return;
    if (state.current===TOTAL-1) {
      if (allDone()) result();
      return;
    }
    goGame(state.current+1);
  }
  function result() {
    if (!allDone()) {goGame(state.current);return;}
    refs.first.textContent=String(firstCorrectCount());
    refs.retry.textContent=String(retryCount());
    refs.finish.textContent=completedCount()+" / "+TOTAL;
    refs.biasSelect.value=state.advanced.biasOption||"";
    refs.resourceSelect.value=state.advanced.resourceOption||"";
    refs.bias.value=state.advanced.bias||"";
    refs.resource.value=state.advanced.resource||"";
    refs.reviewNote.classList.remove("is-saved");
    refs.reviewNote.textContent="";
    setupCloudStatus();
    refs.exportStatus.textContent="";
    setupHome();
    show("result");
  }
  function saveAdvanced() {
    var bias=refs.bias.value.trim();
    var resource=refs.resource.value.trim();
    state.advanced={biasOption:refs.biasSelect.value,bias:bias,
      resourceOption:refs.resourceSelect.value,resource:resource,savedAt:new Date().toISOString()};
    persist();
    refs.reviewNote.classList.add("is-saved");
    refs.reviewNote.textContent="已保存。";
  }
  function answerLabel(q,index) {
    return index>=0 && index<q.options.length ? String.fromCharCode(65+index)+"．"+q.options[index].text:"未作答";
  }
  function buildExport() {
    var advanced={
      biasOption:refs.result.hidden?state.advanced.biasOption:refs.biasSelect.value,
      bias:refs.result.hidden?state.advanced.bias:refs.bias.value.trim(),
      resourceOption:refs.result.hidden?state.advanced.resourceOption:refs.resourceSelect.value,
      resource:refs.result.hidden?state.advanced.resource:refs.resource.value.trim(),
      savedAt:state.advanced.savedAt
    };
    return {
      activity:DATA.title,version:DATA.version,anonymousSession:state.runId,
      runId:state.runId,student:{...state.student},consent:!!state.student.consent,
      startedAt:state.startedAt,finishedAt:state.finishedAt,
      grading:{basic:allDone()?"B（通關）":"C（未通關）",
        advanced:"A 等需教師閱讀學生文字後判定，不由系統自動給分"},
      stats:{completed:completedCount(),total:TOTAL,firstTryCorrect:firstCorrectCount(),revisions:retryCount()},
      questions:DATA.questions.map(function(q){
        var r=state.answers[q.id]||{attempts:[],correct:false};
        return {id:q.id,chapter:q.chapter,concept:q.principle,
          question:q.title,firstResponse:r.attempts.length?answerLabel(q,r.attempts[0].choice):"未作答",
          attempts:r.attempts.map(function (a) {
            return {choiceCode:String.fromCharCode(65+a.choice),
              selection:answerLabel(q,a.choice),correct:a.correct,at:a.at};
          }),
          correct:r.correct,finalResponse:r.correct?answerLabel(q,q.correct):"尚未通過"};
      }),advanced:advanced
    };
  }
  function summaryText() {
    var data=buildExport();
    var rows=[
      data.activity,"學習代碼："+data.anonymousSession,
      "班級："+data.student.className+"　座號："+data.student.seatNo+"　姓名："+data.student.name,
      "教材版本："+data.version,
      "作答開始："+data.startedAt,
      "完成時間："+(data.finishedAt||"尚未完成"),
      "評量狀態："+data.grading.basic,
      "首次答對："+data.stats.firstTryCorrect+"/"+TOTAL,
      "修正次數："+data.stats.revisions,"",
      "【十項調查歷程】"
    ];
    data.questions.forEach(function(q){
      rows.push(q.id+"｜"+q.question,
        "　第一次作答："+q.firstResponse,
        "　作答次數："+q.attempts.length+"；結果："+(q.correct?"通過":"尚未通過"));
      q.attempts.forEach(function(a,i) {
        rows.push("　"+(i+1)+"次："+a.selection+"（"+(a.correct?"答對":"已回饋重試")+"）");
      });
    });
    rows.push("","【A等進階分析】",
      "偏見問題選擇：",data.advanced.biasOption||"（未選擇）",
      "原因與可能影響：",data.advanced.bias||"（未填寫）",
      "資源障礙選擇：",data.advanced.resourceOption||"（未選擇）",
      "原因與可能影響：",data.advanced.resource||"（未填寫）",
      "","提醒：A等由教師評閱，不由系統自動核定。",
      "資料保存：作答歷程先暫存於裝置。教師設定完成後可手動送交試算表。");
    return rows.join("\n");
  }
  function download(filename,contents,mime) {
    var blob=new Blob([contents],{type:mime});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=url;a.download=filename;
    document.body.append(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},2000);
    refs.exportStatus.textContent="已啟動下載。請依瀏覽器的下載設定檢查檔案。";
  }
  function filename(ext) {
    return "SET-學習紀錄-"+new Date().toISOString().slice(0,10)+"-"+state.runId+"."+ext;
  }
  function copySummary() {
    var content=summaryText();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(content).then(function(){
        refs.exportStatus.textContent="已複製學習紀錄摘要。";
      }).catch(function(){fallbackCopy(content);});
    } else fallbackCopy(content);
  }
  function fallbackCopy(s) {
    var t=document.createElement("textarea");
    t.value=s;t.style.position="fixed";t.style.opacity="0";document.body.append(t);t.select();
    var ok=false;try {ok=document.execCommand("copy");}catch(e){}
    t.remove();
    refs.exportStatus.textContent=ok?"已複製學習紀錄摘要。":"無法自動複製，請改用下載文字檔。";
  }
  function restart() {
    if (!window.confirm("確定重新開始嗎？此裝置的舊作答與進階分析將被清除。建議先匯出學習紀錄。")) return;
    state=newState();
    persist();home();
  }

  function setupCloudStatus() {
    refs.submitCloud.disabled=!CLOUD_READY;
    refs.cloudTitle.textContent=CLOUD_READY?"已設定 Google 試算表接收網址":"Google 試算表尚未連線";
    refs.cloudDesc.textContent=CLOUD_READY?
      "完成後可按「送出學習紀錄」；第一次使用請先確認資料確實出現在教師試算表。":
      "老師完成 Google Apps Script 連線設定後即可送出；目前仍可下載紀錄備份。";
  }
  function captureAdvanced() {
    state.advanced={
      biasOption:refs.biasSelect.value,
      bias:refs.bias.value.trim(),
      resourceOption:refs.resourceSelect.value,
      resource:refs.resource.value.trim(),
      savedAt:new Date().toISOString()
    };
    persist();
  }
  function submitToCloud() {
    if (!CLOUD_READY || !allDone()) return;
    if (!state.student || !state.student.className || !state.student.seatNo ||
        !state.student.name || !state.student.consent) {
      refs.exportStatus.textContent="學習身分資料尚未完整，請回首頁填寫。";
      return;
    }
    if (!refs.cloudConsent.checked) {
      refs.exportStatus.textContent="請先確認是否同意將學習紀錄送交教師。";
      return;
    }
    captureAdvanced();
    var data=buildExport();
    var payload={
      runId:data.runId,version:data.version,student:data.student,
      consent:true,startedAt:data.startedAt,finishedAt:data.finishedAt,
      stats:data.stats,advanced:data.advanced,questions:data.questions
    };
    // 使用跨來源表單 POST 與隱藏 iframe，避免公開存放試算表憑證。
    // 僅伺服器確認回傳 success:true 才顯示已儲存。
    var form=document.createElement("form");
    form.method="POST";form.action=SHEET_URL;form.target="setSubmissionFrame";
    form.style.display="none";
    var field=document.createElement("input");
    field.type="hidden";field.name="payload";field.value=JSON.stringify(payload);
    form.append(field);
    document.body.append(form);
    refs.submitCloud.disabled=true;
    refs.exportStatus.textContent="正在送出學習紀錄……";
    if (cloudTimeout) clearTimeout(cloudTimeout);
    cloudTimeout=setTimeout(function(){
      refs.submitCloud.disabled=false;
      refs.exportStatus.textContent="目前無法確認雲端是否儲存成功。請檢查教師試算表，或先下載備份。";
      cloudTimeout=null;
    },18000);
    try {form.submit();} catch(err) {
      if (cloudTimeout) clearTimeout(cloudTimeout);
      cloudTimeout=null;
      refs.submitCloud.disabled=false;
      refs.exportStatus.textContent="無法送出，請先下載學習紀錄備份。";
    }
    form.remove();
  }
  window.addEventListener("message",function(event){
    if (!refs.submitFrame || event.source!==refs.submitFrame.contentWindow) return;
    var data=event.data;
    if (!data || data.type!=="SET_SHEET_RESPONSE" || data.sessionId!==state.runId) return;
    if (cloudTimeout) clearTimeout(cloudTimeout);
    cloudTimeout=null;
    refs.submitCloud.disabled=false;
    refs.exportStatus.textContent=data.success?
      "教師試算表已確認收到學習紀錄。":"雲端儲存未完成。請稍後再送一次，或下載備份。";
  });
  refs.submitCloud.addEventListener("click",submitToCloud);

  refs.start.addEventListener("click",function() {
    if (!captureIdentity()) return;
    var currentStudent={...state.student};
    if (completedCount()>0) {
      if (!window.confirm("將開始新一輪並清除目前進度。建議先完成或匯出；確定嗎？")) return;
      state=newState();
      state.student=currentStudent;
    }
    persist();goGame(0);
  });
  refs.resume.addEventListener("click",function(){
    if (!captureIdentity()) return;
    if (allDone()) {result();return;}
    var firstUnfinished=DATA.questions.findIndex(function(q){return !isDone(q);});
    goGame(firstUnfinished<0?state.current:firstUnfinished);
  });
  refs.backHome.addEventListener("click",home);
  refs.prev.addEventListener("click",function(){if(state.current>0)goGame(state.current-1);});
  refs.next.addEventListener("click",next);
  refs.reset.addEventListener("click",restart);
  refs.restart.addEventListener("click",restart);
  refs.review.addEventListener("click",function(){goGame(0);});
  refs.saveAdvanced.addEventListener("click",saveAdvanced);
  refs.exportText.addEventListener("click",function(){
    state.advanced.bias=refs.bias.value.trim();
    state.advanced.resource=refs.resource.value.trim();persist();
    download(filename("txt"),summaryText(),"text/plain;charset=utf-8");
  });
  refs.exportJson.addEventListener("click",function(){
    state.advanced.bias=refs.bias.value.trim();
    state.advanced.resource=refs.resource.value.trim();persist();
    download(filename("json"),JSON.stringify(buildExport(),null,2),"application/json;charset=utf-8");
  });
  refs.copySummary.addEventListener("click",function(){
    state.advanced.bias=refs.bias.value.trim();
    state.advanced.resource=refs.resource.value.trim();persist();
    copySummary();
  });
  // 維持進階文字在頁面內的狀態：其他分頁或重新整理時可保留已編輯內容。
  refs.biasSelect.addEventListener("change",function(){state.advanced.biasOption=refs.biasSelect.value;persist();});
  refs.resourceSelect.addEventListener("change",function(){state.advanced.resourceOption=refs.resourceSelect.value;persist();});
  refs.bias.addEventListener("input",function(){state.advanced.bias=refs.bias.value;persist();});
  refs.resource.addEventListener("input",function(){state.advanced.resource=refs.resource.value;persist();});
  // 按鈕可透過鍵盤操作，答對後須自行選擇下一題，避免自動跳頁。
  if (allDone()) result(); else home();
})();
