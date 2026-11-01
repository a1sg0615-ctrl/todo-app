// E2E 전용 모의 GitHub OAuth 서버. 실제 GitHub 없이 /auth/github → callback 흐름을 검증한다.
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 3200);
const CLIENT_ID = "e2e-client-id";
const CLIENT_SECRET = "e2e-client-secret";
const CODE = "e2e-code";
const TOKEN = "e2e-access-token";
// 1x1 투명 PNG
const AVATAR = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  if (req.method === "GET" && url.pathname === "/login/oauth/authorize") {
    if (url.searchParams.get("client_id") !== CLIENT_ID) return json(res, 400, { error: "bad client_id" });
    const back = new URL(url.searchParams.get("redirect_uri"));
    back.searchParams.set("code", CODE);
    back.searchParams.set("state", url.searchParams.get("state"));
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }

  if (req.method === "POST" && url.pathname === "/login/oauth/access_token") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || "{}");
    if (body.client_id !== CLIENT_ID || body.client_secret !== CLIENT_SECRET || body.code !== CODE) {
      return json(res, 200, { error: "bad_verification_code" });
    }
    return json(res, 200, { access_token: TOKEN, token_type: "bearer" });
  }

  if (req.method === "GET" && url.pathname === "/user") {
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(res, 401, { message: "Bad credentials" });
    return json(res, 200, { id: 4242, login: "mock-octocat", avatar_url: `http://localhost:${port}/avatar.png` });
  }

  if (req.method === "GET" && url.pathname === "/avatar.png") {
    res.writeHead(200, { "Content-Type": "image/png" });
    return res.end(AVATAR);
  }

  if (url.pathname === "/health") return json(res, 200, { ok: true });
  json(res, 404, { error: "not found" });
}).listen(port, () => console.log(`mock GitHub on http://localhost:${port}`));
