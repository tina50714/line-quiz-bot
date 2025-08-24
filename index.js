require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
};

const client = new line.Client(config);
const app = express();

// 儲存用戶答案暫存
const userSessions = {};

// 小測驗題目與分數對應
const questions = [
  {
    q: 'Q1. 傷口看起來的顏色？',
    options: {
      A: '紅紅嫩嫩，好像新鮮的肉色',
      B: '顏色有點暗淡、不太亮',
      C: '黃黃或黑黑一大片'
    },
    scores: { A: 0, B: 1, C: 2 }
  },
  {
    q: 'Q2. 傷口有沒有流水？',
    options: {
      A: '幾乎沒什麼，像清水，沒味道',
      B: '有一點點，顏色黃黃的，味道不明顯',
      C: '流很多，膿膿的，還有臭味'
    },
    scores: { A: 0, B: 1, C: 2 }
  },
  {
    q: 'Q3. 這一週比起上週，傷口變化如何？',
    options: {
      A: '看起來有縮小，還有新皮慢慢長出來',
      B: '差不多，沒什麼改變',
      C: '反而變大，或更深'
    },
    scores: { A: 0, B: 1, C: 2 }
  },
  {
    q: 'Q4. 傷口周圍的皮膚？',
    options: {
      A: '邊緣平平順順，皮膚看起來正常',
      B: '皮膚有點硬，邊緣翹起來',
      C: '紅紅腫腫，還會痛，皮膚破掉'
    },
    scores: { A: 0, B: 1, C: 2 }
  }
];

// 結果對應（依總分區間）
function getResult(totalScore) {
  if (totalScore <= 2)
    return ' 🧭增生期（生肌行者）\n👉 傷口正在長肉，穩定變好，繼續加油。';
  else if (totalScore <= 4)
    return ' 🧭停滯期（卡關小俠）\n👉 傷口暫時停住了，可能需要調整換藥或壓力。';
  else if (totalScore <= 6)
    return ' 🧭發炎期（紅腫小魔王）\n👉 傷口紅腫、流水變多，可能在發炎，建議快回報醫護。';
  else
    return '🧭 壞死期（枯木宗者）\n👉 傷口黑黑黃黃一大片，需要專業清掉壞肉，讓傷口才能好。';
}

// 用按鈕傳送題目
function sendQuestion(event, q) {
  const actions = Object.entries(q.options).map(([k, v]) => ({
    type: 'message',
    label: `${k}: ${v}`,
    text: k // 點擊後傳回 A/B/C
  }));

  return client.replyMessage(event.replyToken, {
    type: 'template',
    altText: q.q,
    template: {
      type: 'buttons',
      text: q.q,
      actions: actions
    }
  });
}

// Webhook
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
});

// 事件處理
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  const userId = event.source.userId;
  if (!userSessions[userId]) userSessions[userId] = { step: 0, answers: [] };
  const session = userSessions[userId];

  const msg = event.message.text.trim();

  // 判斷是否點擊「試煉開始」
  if (msg === '試煉開始') {
    session.step = 0;
    session.answers = [];
    return sendQuestion(event, questions[0]);
  } 
  // 如果已經開始測驗，接收 A/B/C
  else if (['A', 'B', 'C'].includes(msg.toUpperCase())) {
    session.answers.push(msg.toUpperCase());
    session.step++;

    if (session.step < questions.length) {
      return sendQuestion(event, questions[session.step]);
    }

    // 計算總分
    let totalScore = 0;
    session.answers.forEach((ans, idx) => {
      totalScore += questions[idx].scores[ans] || 0;
    });

    const resultText = getResult(totalScore);

    // 清空 session
    session.step = 0;
    session.answers = [];

    // 回傳結果 + 重新測驗按鈕
    return client.replyMessage(event.replyToken, {
      type: 'template',
      altText: '測驗完成',
      template: {
        type: 'buttons',
        text: `🎯 測驗完成！\n總分: ${totalScore}\n${resultText}`,
        actions: [
          {
            type: 'message',
            label: '重新試煉',
            text: '試煉開始'
          }
        ]
      }
    });
  } 

  // 其他情況 → 不回覆
  return null;
}

// 啟動伺服器
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`LINE Bot running at port ${port}`));
