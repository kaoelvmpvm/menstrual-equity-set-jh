# 經彩同行 SET｜王子的平權偵察隊（國中版）

《一片衛生棉的校園旅行》的認知評量教材。依《王子脫魯記》延伸故事情境，對應性 J3（偏見與歧視）及性 J10（資源運用與分配不平等）。

網站：https://kaoelvmpvm.github.io/menstrual-equity-set-jh/

## 學習流程

1. 首頁填入班級、座號與姓名，閱讀資料使用說明後開始。
2. 完成四章十題：基礎認知2題、J3四題、J10三題、整合1題。每題三選一，答錯可即時回饋與重新選擇。
3. 十題通關為 B；尚未通關為 C。A 等在結算頁先勾選一項月經偏見、一項用品取得障礙，再寫各自的原因與可能影響，交教師判讀。
4. 可下載含身分與完整作答軌跡的 TXT/JSON；教師配置 Apps Script 後，可按「送出學習紀錄」將資料交給私人 Google 試算表。

## 老師的 Google 試算表

已建立四分頁：「學習總覽」「逐題作答軌跡」「進階分析」「展示審核」。前三個為原始學習資料，新增分頁只保存匿名展示核准與修改後的展示文字。
請參閱 [部署與測試指南](google-apps-script/DEPLOY.md) 並使用 [Google Apps Script 接收程式](google-apps-script/Code.gs)。
接收端已填入 config.js。若尚未成功寫入，請將 google-apps-script/Code.gs 的最新版複製至 Apps Script、指定 SET_SPREADSHEET_ID、部署新版本。網站現在以新分頁顯示 Google 回執，並提供「先檢查 Google 接收端是否正常」的診斷連結。
config.js 已設定新北市教育網域 Apps Script 的正式 /exec 網址，之前已成功完成單人作答與試算表寫入測試。多人同時提交仍需另行負載測試。

## 穩定性修正（2026-11-24）

- **共用裝置資料隔離：**「繼續上次進度」會比對班級、座號、姓名，避免接到他人的作答；重新開始時不會先覆寫原學習者的身分。
- **錯題可續作：** 尚未答對的題目也能保存進度；返回題目時保留先前的錯誤回饋。
- **上傳選擇：** 送交 Google 試算表需由學生勾選確認，未預先勾選。
- **清除本機資料：** 提供明確按鈕清除班級、座號、姓名與本機作答資料，特別適合班級共用電腦。
- **試算表可讀性：**「逐題作答軌跡」接收時間已統一顯示日期及時間，方便追查同時提交的紀錄。
- **維持資料相容：** 題庫、教材版本、現有雲端接收介面及試算表欄位均未修改，**不需重新部署 Apps Script**；既有學生紀錄亦不受影響。
- 新增自動化流程檢查：`node tests/smoke.cjs`，可驗證續作、身分比對、錯題回饋與本機資料清除。

## 資料與安全

- 班級、座號、姓名與作答紀錄均為學生學習資料。**不可公開分享教師試算表**，請依學校個資規範處理。
- 學生按「送出學習紀錄」才會一次上傳；未送出前紀錄保留在目前裝置的 localStorage 中。
- 使用公開 Apps Script endpoint 無法直接驗證班級、座號或學生真實身分，需由教師檢核。
- 同一學習代碼重複送出時，接收程式會更新總覽與進階分析，避免重複新增作答軌跡。
- 首頁、角色介紹與題目均已接入圖片；角色採透明 PNG，題目採 WebP 情境圖。


## 教師用「平權觀點展示牆」（2026-11-26 新增）

- 學生仍使用原本的 SET 網站送交學習成果，無須再次填答。
- 教師資料從私有的「進階分析」分頁讀取；新「展示審核」分頁保留逐則核准狀態與經教師編輯過的匿名展示文字。
- 教師可依班級、問題類型、審核狀態與關鍵字篩選學生文字。
- 投影模式只呈現已核准的匿名卡片，提供兩則觀點並排比較、每30秒更新。
- 學生重交並修改原始回覆後，舊核准自動失效，避免未經重新審核的內容公開。
- **教師平台必須使用獨立、非公開的 Apps Script 專案部署，不能與現有對學生公開的 Code.gs 接收端合併。**
- 程式碼：teacher-wall/Code.gs、teacher-wall/Teacher.html。
- **[教師展示牆部署指南](teacher-wall/SETUP.md)**：包含建立新的獨立 Apps Script 專案、設定教師白名單、只有我存取與第一次核准測試。
- **[教師展示牆示範預覽](https://kaoelvmpvm.github.io/menstrual-equity-set-jh/teacher-wall/demo.html)**：使用四筆虛構學生資料，現在可測試教師審核、匿名展示與兩則比較；不會讀取真實學生資料。
- 回歸測試：node teacher-wall/tests/smoke.cjs。
- GitHub 現已提供完整程式和資料分頁，但**Google 教師端部署需由帳號持有人登入並授權，完成前還沒有正式可用的展示網址**。不需重新部署學生原本的 Apps Script。

## 檔案

- index.html：學生端三頁式介面。
- config.js：教師設定接收端點，不可在此放入密碼或私有金鑰。
- assets/style.css：繪本風格排版。
- assets/app.js：遊戲流程、重試與評量、文字分析、紀錄與送出。
- data/questions.js：十題劇本、選項及回饋。
- google-apps-script/Code.gs：寫入教師試算表的接收程式。
- google-apps-script/DEPLOY.md：教師設定與檢驗步驟。
- tests/validate.cjs：題庫、頁面元件與 14 張圖片 PNG/WebP 格式檢查。
- tests/smoke.cjs：答題、續作及資料清除流程的回歸測試。

## 發布

GitHub Settings → Pages → Deploy from a branch → main → /(root) → Save。首次公開前請確認校方學生資料蒐集及告知規範。

## 圖像素材（2026-11-25）

- `assets/characters/prince.png`：首頁主視覺、角色介紹及王子出場任務頭像。
- `assets/characters/cinderella.png`、`rapunzel.png`、`matchgirl.png`：角色介紹與各自的任務頭像。
- `assets/scenes/Q01.webp`～`Q10.webp`：依據題號自動顯示每題對應情境圖。
- 角色 PNG 為 1122×1402、含透明度；情境 WebP 為 1536×1024（3:2）。
- 若圖片載入失敗，遊戲顯示替代文字，仍可閱讀題目並繼續作答。
- 本次只修改 `index.html`、`assets/app.js`、`assets/style.css` 及教材檢查，不更動作答資料格式與 Google Apps Script 接收程式；不需要重新部署 Google Apps Script。
