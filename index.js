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
    q: 'Q1. 傷口現在有什麼變化？',
    options: {
      A: '紅腫熱痛、滲液增多',
      B: '看起來乾乾的、沒什麼變化',
      C: '表面有新生紅色肉芽',
      D: '顏色變暗、有黑色壞死組織'
    },
    scores: { A: 3, B: 0, C: 1, D: 5 }
  },
  {
    q: 'Q2. 最近換藥時有發現什麼異常？',
    options: {
      A: '分泌物變多或有臭味',
      B: '傷口顏色變淡、變小',
      C: '每次都長一樣，沒什麼變化',
      D: '黃色或黑色組織變多'
    },
    scores: { A: 3, B: 1, C: 0, D: 4 }
  },
  {
    q: 'Q3. 傷口周圍皮膚狀況如何？',
    options: {
      A: '有點紅，有點腫',
      B: '看起來還不錯',
      C: '很乾，有點裂開',
      D: '變黑變硬'
    },
    scores: { A: 2, B: 1, C: 1, D: 3 }
  },
  {
    q: 'Q4. 最近換藥或照護的頻率是？',
    options: {
      A: '一天換好幾次',
      B: '每天固定一次',
      C: '偶爾才換',
      D: '都沒換'
    },
    scores: { A: 2, B: 1, C: 3, D: 3 }
  }
];

// 結果對應（依總分區間）
function getResult(totalScore) {
  if (totalScore <= 3)
    return '停滯劍士 · 穩如山\n傷口可能「停在某階段沒有改善」\n建議：檢視敷料選擇與照護一致性。';
  else if (totalScore <= 6)
    return '小肉潤 · 百草谷谷主\n傷口正處於「增生期、進步中」\n建議：維持濕潤環境、避免過度清創，提供充足營養與正確照護。';
  else if (totalScore <= 9)
    return '紅腫魔王 · 腐氣天君\n傷口可能處於「發炎期或感染期」\n建議：加強清潔與換藥頻率，注意是否需醫師評估使用抗生素或清創。';
  else
    return '黑氣掌門 · 枯木尊者\n傷口可能有「壞死組織或難癒傾向」\n建議：由專業醫療團隊評估是否需清創或其他治療。';
}

// 用按鈕傳送題目
function sendQuestion(event, q) {
  const actions = Object.entries(q.options).map(([k, v]) => ({
    type: 'message',
    label: `${k}: ${v}`,
    text: k // 點擊後傳回 A/B/C/D
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

  // 如果已經開始測驗，接收 A/B/C/D
  if (['A', 'B', 'C', 'D'].includes(msg.toUpperCase())) {
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
            text: '試煉開始' // 點擊後會再觸發開始
          }
        ]
      }
    });
  }

  // 非測驗文字回應
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '請點擊「武林試煉榜」來啟動測驗，或直接選擇題目選項 A/B/C/D。'
  });
}

// 啟動伺服器
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`LINE Bot running at port ${port}`));















