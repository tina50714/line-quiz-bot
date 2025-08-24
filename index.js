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

// 用戶測驗狀態
const userSessions = {};

// 測驗題目
const questions = [
  {
    q: '1.換藥時，傷口「顏色」看起來如何？',
    options: {
      A: '紅紅嫩嫩，好像新鮮的肉色',
      B: '顏色有點暗淡、不太亮',
      C: '黃色或黑色一大片'
    },
    score: { A: 0, B: 1, C: 2 }
  },
  {
    q: '2.換藥時，傷口有沒有「滲出液」？',
    options: {
      A: '沒有或像清水，沒味道',
      B: '有一點點，顏色黃黃的，味道不明顯',
      C: '很多滲液，黃色/綠色、濃稠的，還有臭味'
    },
    score: { A: 0, B: 1, C: 2 }
  },
  {
    q: '3.這一週比起上週，傷口變化如何？',
    options: {
      A: '看起來有縮小，還有新皮慢慢長出來',
      B: '差不多，沒什麼改變',
      C: '傷口反而變大，或更深狀態'
    },
    score: { A: 0, B: 1, C: 2 }
  },
  {
    q: '4.觀察傷口「周圍的皮膚」狀態？',
    options: {
      A: '邊緣平平順順，皮膚看起來正常',
      B: '皮膚有點硬，邊緣翹起來',
      C: '紅紅腫腫，還會痛，皮膚破皮'
    },
    score: { A: 0, B: 1, C: 2 }
  }
];

// 測驗結果對應
const results = [
  { min: 0, max: 2, title: '📌 建議', advice: '傷口正在長肉，穩定成長且變好，繼續加油。', img: 'https://tina50714.github.io/role-cards/1.png' },
  { min: 3, max: 4, title: '📌 建議', advice: '傷口暫時原地踏步了，可能需要調整換藥方式或注意慢性病控制情況。', img: 'https://tina50714.github.io/role-cards/2.png' },
  { min: 5, max: 6, title: '📌 建議', advice: '傷口紅腫、滲液變多，可能在發炎，建議盡快電話諮詢醫院或前往急診治療。', img: 'https://tina50714.github.io/role-cards/3.png' },
  { min: 7, max: 8, title: '📌 建議', advice: '傷口黑黑黃黃一大片，需要手術清掉壞肉，讓傷口長好肉', img: 'https://tina50714.github.io/role-cards/4.png' }
];

// 發送題目按鈕
function sendQuestion(event, qIndex) {
  const q = questions[qIndex];
  const actions = Object.entries(q.options).map(([k, v]) => ({
    type: 'message',
    label: `${k}: ${v}`,
    text: k
  }));

  return client.replyMessage(event.replyToken, {
    type: 'template',
    altText: q.q,
    template: { type: 'buttons', text: q.q, actions }
  });
}

// 計算結果
function calcResult(score) {
  return results.find(r => score >= r.min && score <= r.max);
}

// 優化 webhook
app.post('/webhook', async (req, res) => {
  try {
    for (const event of req.body.events) {
      await handleEvent(event);
    }
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userId = event.source.userId;
  const userInput = event.message.text.trim();

  if (!userSessions[userId]) userSessions[userId] = { inQuiz: false, currentQ: 0, score: 0 };
  const session = userSessions[userId];

  // 啟動測驗
  if (userInput === '試煉開始') {
    session.inQuiz = true;
    session.currentQ = 0;
    session.score = 0;
    return sendQuestion(event, 0);
  }

  if (session.inQuiz) {
    const currentQuestion = questions[session.currentQ];
    if (!['A','B','C'].includes(userInput)) {
      return client.replyMessage(event.replyToken, { type: 'text', text: '請點擊題目按鈕來作答' });
    }

    session.score += currentQuestion.score[userInput];
    session.currentQ++;

    if (session.currentQ < questions.length) {
      return sendQuestion(event, session.currentQ);
    } else {
      session.inQuiz = false;
      const result = calcResult(session.score);

      return client.replyMessage(event.replyToken, {
        type: 'flex',
        altText: `${result.title}\n${result.advice}`,
        contents: {
          type: 'bubble',
          size: 'giga',
          hero: {
            type: 'image',
            url: result.img,
            size: 'full',
            aspectMode: 'fit', 
            gravity: 'center'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
              { type: 'text', text: result.title, weight: 'bold', size: 'lg', wrap: true },
              { type: 'text', text: result.advice, size: 'md', wrap: true }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              { type: 'button', style: 'primary', action: { type: 'message', label: '重新測驗', text: '試煉開始' } }
            ]
          }
        }
      });
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));




