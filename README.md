# 經彩同行 SET｜王子的平權偵察隊（國中版）

《一片衛生棉的校園旅行》的認知評量教材。依《王子脫魯記》延伸故事情境，對應性 J3（偏見與歧視）及性 J10（資源運用與分配不平等）。

網站：https://kaoelvmpvm.github.io/menstrual-equity-set-jh/

## 學習流程

1. 首頁填入班級、座號與姓名，閱讀資料使用說明後開始。
2. 完成四章十題：基礎認知2題、J3四題、J10三題、整合1題。每題三選一，答錯可即時回饋與重新選擇。
3. 十題通關為 B；尚未通關為 C。A 等在結算頁先勾選一項月經偏見、一項用品取得障礙，再寫各自的原因與可能影響，交教師判讀。
4. 可下載含身分與完整作答軌跡的 TXT/JSON；教師配置 Apps Script 後，可按「送出學習紀錄」將資料交給私人 Google 試算表。

## 老師的 Google 試算表

已建立三分頁：「學習總覽」「逐題作答軌跡」「進階分析」。
請參閱 [部署與測試指南](google-apps-script/DEPLOY.md) 並使用 [Google Apps Script 接收程式](google-apps-script/Code.gs)。
教師必須在自己的試算表內部署 Apps Script，將正式 /exec 網址填入 config.js 才能正式送出。
目前 config.js 未填接收網址，因此網站會顯示「Google 試算表尚未連線」，不會偽稱已成功傳送。

## 資料與安全

- 班級、座號、姓名與作答紀錄均為學生學習資料。**不可公開分享教師試算表**，請依學校個資規範處理。
- 學生按「送出學習紀錄」才會一次上傳；未送出前紀錄保留在目前裝置的 localStorage 中。
- 使用公開 Apps Script endpoint 無法直接驗證班級、座號或學生真實身分，需由教師檢核。
- 同一學習代碼重複送出時，接收程式會更新總覽與進階分析，避免重複新增作答軌跡。
- 人物立繪均先顯示空白佔位框。

## 檔案

- index.html：學生端三頁式介面。
- config.js：教師設定接收端點，不可在此放入密碼或私有金鑰。
- assets/style.css：繪本風格排版。
- assets/app.js：遊戲流程、重試與評量、文字分析、紀錄與送出。
- data/questions.js：十題劇本、選項及回饋。
- google-apps-script/Code.gs：寫入教師試算表的接收程式。
- google-apps-script/DEPLOY.md：教師設定與檢驗步驟。
- tests/validate.cjs：題庫與頁面元件結構檢查。

## 發布

GitHub Settings → Pages → Deploy from a branch → main → /(root) → Save。首次公開前請確認校方學生資料蒐集及告知規範。
