const GOOGLE_CLIENT_ID = "280950399393-pivd8mg1mob4iqmm24btihupa2qbof16.apps.googleusercontent.com";
const REDIRECT_URI = "https://inwave.ai.kr/callback_google.html";
const scope = "email profile openid";
const response_type = "id_token token";

const state = new Date().getTime();
const nonce = Math.random().toString(36).substring(2);

document.getElementById("googleLoginBtn").addEventListener("click", () => {
  const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
              `client_id=${GOOGLE_CLIENT_ID}` +
              `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
              `&response_type=${encodeURIComponent(response_type)}` +
              `&scope=${encodeURIComponent(scope)}` +
              `&state=${state}` +
              `&nonce=${nonce}`;

  window.location.href = url;
});
