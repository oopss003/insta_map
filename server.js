// server.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = 3000;

// POST 요청 파싱을 위한 설정
app.use(bodyParser.urlencoded({ extended: true }));

// 정적 파일 서빙 (login.html, terms.html 등)
app.use(express.static(path.join(__dirname, 'public')));

// Apple 로그인 콜백 처리 (POST 요청 받기)
app.post('/callback_apple.html', (req, res) => {
  const { id_token, code, state } = req.body;

  console.log("✅ Apple 로그인 성공!");
  console.log("🔑 id_token:", id_token);
  console.log("🔄 code:", code);
  console.log("🧾 state:", state);

  // TODO: 여기서 Firebase Custom Token 발급 or 사용자 정보 추출 가능

  // 로그인 처리 후 약관 페이지로 리디렉션
  res.redirect('/terms.html');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
