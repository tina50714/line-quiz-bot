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

// 使用者暫存 session
const userSessions = {};

// 測驗題目
const questions = [
  {
    q: '傷口看起來的顏色',
    options: ['紅紅嫩嫩，好像新鮮的肉色', '顏色有點暗淡、不太亮', '黃黃或黑黑一大片'],
    scores: [0, 1, 2]
  },
  {
    q: '傷口有沒有流水？',
    options: ['幾乎沒什麼，像清水，沒味道', '有一點點，顏色黃黃的，味道不明顯', '流很多，膿膿的，還有臭味'],
    scores: [0, 1, 2]
  },
  {
    q: '這一週比起上週，傷口變化如何？',
    options: ['看起來有縮小，還有新皮慢慢長出來', '差不多，沒什麼改變', '反而變大，或更深'],
    scores: [0, 1, 2]
  },
  {
    q: '傷口周圍的皮膚',
    options: ['邊緣平平順順，皮膚看起來正常', '皮膚有點硬，邊緣翹起來', '紅紅腫腫，還會痛，皮膚破掉'],
    scores: [0, 1, 2]
  }
];

// 分數對應角色圖卡與建議
const results = [
  { min: 0, max: 2, name: '增生期', img: 'https://tina50714.github.io/role-cards/1.png', advice: '傷口正在長肉，穩定變好，繼續加油。' },
  { min: 3, max: 4, name: '停滯期', img: 'https://tina50714.github.io/role-cards/2.png', advice: '傷口暫時停住了，可能需要調整換藥或手術。' },
  { min: 5, max: 6, name: '發炎期', img: 'https://tina50714.github.io/role-cards/3.png', advice: '傷口紅腫、流水變多，可能在發炎，建議盡快聯繫醫院。' },
  { min: 7, max: 8, name: '壞死期', img: 'https://tina50714.github.io/role-cards/4.png', advice: '傷口黑黑黃黃一大片，需要手術清除腐肉，傷口才能好。' }
];

app.post('/webhook', async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const userId = event.source.userId;
    const text = event.message.text.trim();

    // 使用者輸入「試煉開始」
    if (text === '試煉開始') {
      userSessions[userId] = { currentQuestion: 0, score: 0 };
      const firstQ = questions[0];
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `🗡️ 武林試煉開始！\n第一題：${firstQ.q}\nA) ${firstQ.options[0]}\nB) ${firstQ.options[1]}\nC) ${firstQ.options[2]}`
      });
      continue;
    }

    // 若使用者已啟動測驗
    if (userSessions[userId]) {
      const session = userSessions[userId];
      const currentQ = questions[session.currentQuestion];

      // 解析答案
      const answerMap = { A: 0, B: 1, C: 2 };
      const answerIndex = answerMap[text.toUpperCase()];
      if (answerIndex === undefined) {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '請輸入 A / B / C 選擇答案。'
        });
        continue;
      }

      // 計分
      session.score += currentQ.scores[answerIndex];
      session.currentQuestion += 1;

      // 檢查是否還有下一題
      if (session.currentQuestion < questions.length) {
        const nextQ = questions[session.currentQuestion];
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `下一題：${nextQ.q}\nA) ${nextQ.options[0]}\nB) ${nextQ.options[1]}\nC) ${nextQ.options[2]}`
        });
      } else {
        // 計算結果
        const total = session.score;
        const result = results.find(r => total >= r.min && total <= r.max);
        await client.replyMessage(event.replyToken, [
          {
            type: 'image',
            originalContentUrl: result.img,
            previewImageUrl: result.img
          },
          {
            type: 'text',
            text: `🧭 結果：${result.name}\n${result.advice}`
          }
        ]);
        delete userSessions[userId]; // 測驗結束，清除 session
      }
      continue;
    }

    // 非測驗文字回覆（只在未啟動測驗時回覆）
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '請點擊「武林試煉榜」來啟動測驗，或直接選擇題目選項 A/B/C。'
    });
  }
  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
