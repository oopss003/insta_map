// insta_map/api/callback_apple.js
export default function handler(req, res) {
  if (req.method === 'POST') {
    const { id_token, code, state } = req.body;

    console.log("✅ Apple 로그인 POST 수신!");
    console.log("🔑 id_token:", id_token);
    console.log("🔄 code:", code);
    console.log("🧾 state:", state);

    // 나중에 Firebase 인증 처리 등 가능

    res.redirect(302, '/terms.html');
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
