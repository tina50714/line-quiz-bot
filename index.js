require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
};

const client = new line.Client(config);
const app = express();

// ✅ 確保能解析 JSON
app.use(express.json());

// 儲存用戶答案暫存
const userSessions = {};

// 小測驗題目與分數對應
const questions = [
  {
    q: 'Q1. 傷口現在有什麼變化？',
    options: { A: '紅腫熱痛、滲液增多', B: '看起來乾乾的、沒什麼變化', C: '表面有新生紅色肉芽', D: '顏色變暗、有黑色壞死組織' },
    scores: { A: 3, B: 1, C: 2, D: 4 }
  },
  {
    q: 'Q2. 最近換藥時有發現什麼異常？',
    options: { A: '分泌物變多、有臭味', B: '傷口顏色變淡、變小', C: '每次都長一樣，沒什麼變化', D: '沒注意，沒看清楚' },
    scores: { A: 3, B: 2, C: 1, D: 0 }
  },
  {
    q: 'Q3. 傷口周圍皮膚狀況如何？',
    options: { A: '很紅，還有水泡', B: '看起來還不錯，有點癢', C: '很乾，有點裂開', D: '變黑變硬' },
    scores: { A: 3, B: 2, C: 1, D: 4 }
  },
  {
    q: 'Q4. 最近換藥或照護的頻率是？',
    options: { A: '一天換好幾次', B: '每天固定一次', C: '偶爾才換', D: '都沒換' },
    scores: { A: 3, B: 2, C: 1, D: 0 }
  }
];

// 結果對應（依總分區間）
function getResult(totalScore) {
  if (totalScore <= 3) return '停滯劍士 · 穩如山\n傷口可能「停在某階段沒有改善」\n建議：檢視敷料選擇與照護一致性。';
  else if (totalScore <= 6) return '小肉潤 · 百草谷谷主\n傷口正處於「增生期、進步中」\n建議：維持濕潤環境、避免過度清創，提供充足營養與正確照護。';
  else if (totalScore <= 9) return '紅腫魔王 · 腐氣天君\n傷口可能處於「發炎期或感染期」\n建議：加強清潔與換藥頻率，注意是否需醫師評估使用抗生素或清創。';
  else return '黑氣掌門 · 枯木尊者\n傷口可能有「壞死組織或難癒傾向」\n建議：由專業醫療團隊評估是否需清創或其他治療。';
}

// 出題：送題目 + Quick Reply 按鈕
function sendQuestion(replyToken, session) {
  const q = questions[session.step];
  const quickReplyItems = Object.keys(q.options).map(key => ({
    type: 'action',
    action: {
      type: 'postback',
      label: `${key}: ${q.options[key]}`,
      data: `answer=${key}`,
      displayText: '' // 按下後不回傳文字
    }
  }));

  return client.replyMessage(replyToken, {
    type: 'text',
    text: q.q,
    quickReply: { items: quickReplyItems }
  });
}

// 送結果 + 「重新測驗」按鈕
function sendResult(replyToken, totalScore) {
  const resultText = getResult(totalScore);

  return client.replyMessage(replyToken, {
    type: 'text',
    text: `🎯 測驗完成！\n總分: ${totalScore}\n${resultText}`,
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '重新測驗',
            data: 'action=quiz_start',
            displayText: ''
          }
        }
      ]
    }
  });
}

// 事件處理
async function handleEvent(event) {
  const userId = event.source.userId;

  // 文字訊息 → 「試煉開始」
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim();

    if (text === '試煉開始') {
      userSessions[userId] = { step: 0, answers: [] };
      return sendQuestion(event.replyToken, userSessions[userId]);
    }

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '請輸入「試煉開始」來進行測驗，或點選按鈕作答。'
    });
  }

  // Postback → 按鈕事件
  if (event.type === 'postback') {
    const data = event.postback.data;

    // 重新開始
    if (data === 'action=quiz_start') {
      userSessions[userId] = { step: 0, answers: [] };
      return sendQuestion(event.replyToken, userSessions[userId]);
    }

    // 回答題目
    if (data.startsWith('answer=')) {
      const answer = data.split('=')[1];
      if (!userSessions[userId]) userSessions[userId] = { step: 0, answers: [] };
      const session = userSessions[userId];

      session.answers.push(answer);
      session.step++;

      // 還有題目 → 出下一題
      if (session.step < questions.length) {
        return sendQuestion(event.replyToken, session);
      }

      // 測驗完成 → 計算分數
      let totalScore = 0;
      session.answers.forEach((ans, idx) => {
        totalScore += questions[idx].scores[ans] || 0;
      });

      // 清空 session
      session.step = 0;
      session.answers = [];

      return sendResult(event.replyToken, totalScore);
    }
  }

  return null;
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

// 啟動伺服器
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`LINE Bot running at port ${port}`));
