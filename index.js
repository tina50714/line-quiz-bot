require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
};

const client = new line.Client(config);
const app = express();
app.use(express.json());

// 儲存用戶測驗進度
const userSessions = {};

// 測驗題目
const questions = [
  {
    q: '1. 傷口看起來的顏色',
    options: ['0 分：紅紅嫩嫩，好像新鮮的肉色', 
              '1 分：顏色有點暗淡、不太亮', 
              '2 分：黃黃或黑黑一大片']
  },
  {
    q: '2. 傷口有沒有流水？',
    options: ['0 分：幾乎沒什麼，像清水，沒味道', 
              '1 分：有一點點，顏色黃黃的，味道不明顯', 
              '2 分：流很多，膿膿的，還有臭味']
  },
  {
    q: '3. 這一週比起上週，傷口變化如何？',
    options: ['0 分：看起來有縮小，還有新皮慢慢長出來', 
              '1 分：差不多，沒什麼改變', 
              '2 分：反而變大，或更深']
  },
  {
    q: '4. 傷口周圍的皮膚',
    options: ['0 分：邊緣平平順順，皮膚看起來正常', 
              '1 分：皮膚有點硬，邊緣翹起來', 
              '2 分：紅紅腫腫，還會痛，皮膚破掉']
  }
];

// 測驗結果對應圖卡與建議
const results = [
  { range: [0, 2], name: '增生期', image: 'https://tina50714.github.io/role-cards/1.png ', advice: '傷口正在長肉，穩定變好，繼續加油。' },
  { range: [3, 4], name: '停滯期', image: 'https://tina50714.github.io/role-cards/2.png ', advice: '傷口暫時停住了，可能需要調整換藥或壓力。' },
  { range: [5, 6], name: '發炎期', image: 'https://tina50714.github.io/role-cards/3.png ', advice: '傷口紅腫、流水變多，可能在發炎，建議快回報醫護。' },
  { range: [7, 8], name: '壞死期', image: 'https://tina50714.github.io/role-cards/4.png ', advice: '傷口黑黑黃黃一大片，需要專業清掉壞肉，讓傷口才能好。' },
];

// 處理 LINE webhook
app.post('/webhook', async (req, res) => {
  const events = req.body.events;

  for (let event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;
    const userId = event.source.userId;
    const text = event.message.text.trim();

    // 啟動測驗
    if (text === '武林試煉榜') {
      userSessions[userId] = { currentQ: 0, score: 0 };
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `測驗開始！\n${questions[0].q}\nA. ${questions[0].options[0]}\nB. ${questions[0].options[1]}\nC. ${questions[0].options[2]}`
      });
      continue;
    }

    // 檢查是否在測驗中
    if (!userSessions[userId]) continue; // 非測驗文字不回應

    // 解析答案 (A/B/C)
    const ansMap = { A: 0, B: 1, C: 2 };
    const ans = ansMap[text.toUpperCase()];
    if (ans === undefined) {
      await client.replyMessage(event.replyToken, { type: 'text', text: '請輸入 A、B 或 C 選擇答案。' });
      continue;
    }

    // 累計分數
    userSessions[userId].score += ans;
    userSessions[userId].currentQ++;

    // 下一題或結束
    if (userSessions[userId].currentQ < questions.length) {
      const q = questions[userSessions[userId].currentQ];
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `${q.q}\nA. ${q.options[0]}\nB. ${q.options[1]}\nC. ${q.options[2]}`
      });
    } else {
      // 計算結果
      const total = userSessions[userId].score;
      const result = results.find(r => total >= r.range[0] && total <= r.range[1]);

      // 回傳角色圖卡與建議文字
      await client.replyMessage(event.replyToken, [
        {
          type: 'image',
          originalContentUrl: result.image,
          previewImageUrl: result.image
        },
        {
          type: 'text',
          text: `測驗結果：${result.name}\n${result.advice}`
        }
      ]);

      // 清除使用者測驗狀態
      delete userSessions[userId];
    }
  }

  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`LINE Bot running on port ${port}`));
