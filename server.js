// ✅ server.js (로컬에서 테스트용)
const express = require("express");
const path = require("path");
const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/callback_apple", (req, res) => {
  console.log("Apple 콜백 수신:", req.body);
  // TODO: id_token 처리 및 Firebase 인증 연동
  res.send("<script>alert('Apple 로그인 성공!'); location.href='/terms.html';</script>");
});

app.listen(port, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
});


// ✅ public/login.html (Apple 로그인 버튼 포함)
// 기존 Google 로그인 유지, Apple 로그인 초기화만 추가
<script src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"></script>
<script>
  AppleID.auth.init({
    clientId: "ai.kr.inwave.login",
    scope: "name email",
    redirectURI: "https://inwave.ai.kr/callback_apple.html",
    state: new Date().getTime().toString(),
    usePopup: false
  });
</script>
<div id="appleid-signin"
     data-type="sign in"
     data-color="white"
     data-border="true"
     data-border-radius="8"
     data-width="100%">
</div>


// ✅ public/callback_apple.html (중계 역할)
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>로그인 처리 중...</title>
</head>
<body style="font-family: Pretendard, sans-serif; display:flex; justify-content:center; align-items:center; height:100vh;">
  <h3>Apple 로그인 처리 중...</h3>
  <script>
    // Apple에서 리디렉션된 쿼리 추출
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const id_token = params.get("id_token");
    const user = params.get("user");

    // 서버에 전달
    fetch("/callback_apple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, id_token, user })
    })
    .then(res => res.text())
    .then(html => document.write(html))
    .catch(err => {
      alert("Apple 로그인 실패");
      location.href = "/login.html";
    });
  </script>
</body>
</html>


// ✅ api/callback_apple.js (Vercel용 백엔드)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { code, id_token, user } = req.body;
  console.log("🍎 Apple 로그인 요청 수신:", { code, id_token, user });

  // TODO: Firebase 인증 처리 또는 사용자 정보 저장

  res.setHeader("Content-Type", "text/html");
  res.end(`
    <script>
      alert('Apple 로그인 성공!');
      location.href = '/terms.html';
    </script>
  `);
}

