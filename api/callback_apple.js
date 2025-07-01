const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");

// Apple OAuth 설정
const APPLE_TEAM_ID = "GT3RZR297K";               // Apple Developer → Membership
const APPLE_CLIENT_ID = "ai.kr.inwave.login";       // 서비스 ID (App ID)
const APPLE_KEY_ID = "L79WLQXHN8";                 // 키 ID
const APPLE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgy5LMFV7YVCOrTgjY
sdzVms5UMXKTbi1TqwQqQ7EGpm6gCgYIKoZIzj0DAQehRANCAAQCGAKedQ/fW3vn
RDPr8yXSH9zQJ4aQDmINqWuryXYH7MPI8/XVFY+rlYM6phDMwwmPEK8yoC4WoZNJ
aGhBJ4pr
-----END PRIVATE KEY-----`;                         // Apple에서 다운로드한 p8 키

// Apple 서버에 토큰 요청
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Only POST allowed" });
  }

  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: "Authorization code is missing" });
  }

  try {
    // JWT client_secret 생성
    const clientSecret = jwt.sign(
      {
        iss: APPLE_TEAM_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        aud: "https://appleid.apple.com",
        sub: APPLE_CLIENT_ID,
      },
      APPLE_PRIVATE_KEY,
      {
        algorithm: "ES256",
        keyid: APPLE_KEY_ID,
      }
    );

    // Apple로 토큰 요청
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: "https://inwave.ai.kr/callback_apple.html",
      client_id: APPLE_CLIENT_ID,
      client_secret: clientSecret,
    });

    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Apple token error:", tokenData);
      return res.status(500).json({ success: false, message: tokenData.error });
    }

    // 여기서 id_token을 디코딩하여 사용자 정보 사용 가능
    const decoded = jwt.decode(tokenData.id_token);

    console.log("Apple user info:", decoded);

    // 이후 Firebase 사용자 생성 또는 조회 후 로그인 처리 가능

    return res.status(200).json({ success: true, user: decoded });
  } catch (err) {
    console.error("Apple callback error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
