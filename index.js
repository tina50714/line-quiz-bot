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

// 儲存用戶答案暫存
const userSessions = {};

// 測驗題目
const questions = [
  {
    q: "問題 1: 你的傷口目前情況？",
    options: { A: "輕微紅腫", B: "明顯紅腫", C: "開始長肉", D: "黑黃壞死" }
  },
  {
    q: "問題 2: 你有規律換藥嗎？",
    options: { A: "每天", B: "隔天", C: "不太固定", D: "幾乎沒換" }
  },
  {
    q: "問題 3: 你有保持傷口清潔嗎？",
    options: { A: "完全保持", B: "大部分保持", C: "偶爾", D: "幾乎沒" }
  }
];

// 啟動測驗
app.post('/webhook', async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;
    const userId = event.source.userId;
    const msg = event.message.text;

    // 初始化用戶測驗狀態
    if (!userSessions[userId]) {
      userSessions[userId] = { inQuiz: false, score: 0, current: 0 };
    }

    const session = userSessions[userId];

    // 啟動測驗
    if (msg === '試煉開始') {
      session.inQuiz = true;
      session.score = 0;
      session.current = 0;
      await sendQuestion(event, questions[session.current]);
      continue;
    }

    // 處理答題
    if (session.inQuiz) {
      const currentQ = questions[session.current];
      if (['A', 'B', 'C', 'D'].includes(msg)) {
        // 計分邏輯，可自行調整
        const scoreMap = { A: 1, B: 2, C: 3, D: 4 };
        session.score += scoreMap[msg];
        session.current++;

        if (session.current < questions.length) {
          await sendQuestion(event, questions[session.current]);
        } else {
          await sendResult(event, session.score);
          session.inQuiz = false;
        }
      } else {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '請點擊題目按鈕來作答'
        });
      }
      continue;
    }

    // 非測驗文字不回應
  }
  res.sendStatus(200);
});

// 發送題目
function sendQuestion(event, q) {
  const actions = Object.entries(q.options).map(([k, v]) => ({
    type: 'message',
    label: `${k}: ${v}`,
    text: k
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

// 發送測驗結果
function sendResult(event, score) {
  let result = {};

  if (score <= 2) {
    result = {
      title: '📌 建議',
      message: '傷口正在長肉，穩定成長且變好，繼續加油',
      img: 'https://tina50714.github.io/role-cards/1.png'
    };
  } else if (score <= 4) {
    result = {
      title: '📌 建議',
      message: '傷口暫時原地踏步了，可能需要調整換藥方式或注意慢性病控制情況',
      img: 'https://tina50714.github.io/role-cards/2.png'
    };
  } else if (score <= 6) {
    result = {
      title: '📌 建議',
      message: '傷口紅腫、滲液變多，可能在發炎，建議盡快電話諮詢醫院或前往急診治療',
      img: 'https://tina50714.github.io/role-cards/3.png'
    };
  } else {
    result = {
      title: '📌 建議',
      message: '傷口黑黑黃黃一大片，需要手術清掉壞肉，讓傷口長好肉',
      img: 'https://tina50714.github.io/role-cards/4.png'
    };
  }

  const flexMessage = {
    type: 'flex',
    altText: `${result.title} - ${result.message}`,
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: result.img,
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: result.title, weight: 'bold', size: 'lg' },
          { type: 'text', text: result.message, wrap: true, size: 'md' }
        ]
      }
    }
  };

  return client.replyMessage(event.replyToken, flexMessage);
}

app.listen(process.env.PORT || 3000, () => {
  console.log('Server is running...');
});
