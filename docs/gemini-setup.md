# Gemini 免費層串接

1. 到 https://aistudio.google.com/apikey 登入並建立 API 金鑰。
2. 確認金鑰所屬專案顯示 **Free Tier**，未啟用付費帳務。學生版 Google AI Pro 不代表 API 無限免費。
3. 在本機閱讀網站右欄按「Gemini 設定」，貼上金鑰並按「儲存並測試連線」。金鑰不要貼到聊天裡。
4. 匯入 PDF 後按「翻譯全文」。每頁依序翻譯，可暫停及繼續；重複內容使用本機快取。

目前模型：`gemini-2.5-flash-lite`。免費層供應及額度由 Google 管理；網站遇到 429 會停止，由使用者在額度恢復後繼續，不會切換服務或開通帳務。網站無法從金鑰判斷專案是否已付費，必須在 AI Studio 確認。

金鑰存在不公開且 Git 忽略的 `.local/gemini.json`，並非加密保管庫，請勿分享該資料夾。翻譯快取存在 `.local/gemini-translations/`。免費層文字可能用於改善 Google 產品；不要傳送機密內容。

模型同時提供譯文及詞語對應，程式檢查對應字串及出現次數，定位到原始 PDF 選字；位置檢查不能保證語意完全正確。沒有有效對應時不會框選整段。掃描 PDF 需先 OCR。

API 文件：https://ai.google.dev/gemini-api/docs/generate-content/structured-output

價格與免費層：https://ai.google.dev/gemini-api/docs/pricing

尚無真實金鑰，開發測試使用 Gemini 格式的模擬回應；真實翻譯品質及帳號可用性須完成設定後確認。
