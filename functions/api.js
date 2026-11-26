/**
 * /api — trung gian giữa giao diện và Google Apps Script (dùng cho cả Worker lẫn Pages).
 * - Giấu URL Apps Script + token khỏi trình duyệt.
 * - Đăng nhập bằng mã OTP qua email; sau khi đăng nhập, trình duyệt giữ cookie phiên đã ký số.
 *
 * Biến môi trường (Settings → Variables and Secrets):
 *   APPS_SCRIPT_URL  = https://script.google.com/macros/s/xxxx/exec
 *   API_TOKEN        = trùng API_TOKEN trong Script properties của Apps Script (cũng dùng để ký cookie)
 */
const DATA_ACTIONS = new Set(['all', 'list', 'create', 'update', 'delete', 'save_targets']);
const COOKIE = 'crm_session';
const SESSION_DAYS = 7;

export async function onRequestPost({ request, env }) {
  if (!env.APPS_SCRIPT_URL || !env.API_TOKEN) {
    return json({ ok: false, error: 'Chưa cấu hình APPS_SCRIPT_URL / API_TOKEN' }, 503);
  }
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'JSON không hợp lệ' }, 400); }
  const action = body.action;

  // ---- Đăng nhập ----
  if (action === 'otp_request') return json(await callScript(env, { action, email: body.email }));
  if (action === 'otp_verify') {
    const res = await callScript(env, { action, email: body.email, code: body.code });
    if (!res.ok) return json(res);
    const cookie = await makeSession(env, res.data);
    return json({ ok: true, data: res.data }, 200, { 'Set-Cookie': cookie });
  }
  if (action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });

  // ---- Dữ liệu: bắt buộc đã đăng nhập ----
  if (!DATA_ACTIONS.has(action)) return json({ ok: false, error: 'Action không hợp lệ' }, 400);
  const user = await readSession(env, request);
  if (!user) return json({ ok: false, needLogin: true, error: 'Chưa đăng nhập' }, 401);

  if (action === 'all') {
    // Mỗi lần mở app: kiểm tra lại quyền (phòng khi nhân viên đã bị chuyển "Nghỉ việc")
    const chk = await callScript(env, { action: 'check_user', email: user.e });
    if (!chk.ok) return json({ ok: false, needLogin: true, error: chk.error }, 401, { 'Set-Cookie': clearCookie() });
    const res = await callScript(env, { action: 'all', user: user.e });
    if (res.ok) res.me = chk.data;
    return json(res);
  }
  // `user` = email đã đăng nhập (lấy từ cookie đã ký, trình duyệt không giả mạo được) → Apps Script dùng để phân quyền
  return json(await callScript(env, { action, sheet: body.sheet, id: body.id, data: body.data, rows: body.rows, user: user.e }));
}

export function onRequestGet() {
  return json({ ok: false, error: 'Dùng POST' }, 405);
}

/* ---------------- helpers ---------------- */

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}

async function callScript(env, payload) {
  const res = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, token: env.API_TOKEN }),
    redirect: 'follow',
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok: false, error: 'Apps Script trả về dữ liệu lạ (kiểm tra Web app đã để quyền "Anyone" và đã Deploy bản mới)' }; }
}

const enc = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode('crm-session:' + env.API_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

async function makeSession(env, user) {
  const payload = b64url(enc.encode(JSON.stringify({ e: user.email, n: user.ten || '', x: Date.now() + SESSION_DAYS * 864e5 })));
  const sig = await hmac(env, payload);
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function readSession(env, request) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig || sig !== await hmac(env, payload)) return null;
  try {
    const s = JSON.parse(decodeURIComponent(escape(fromB64url(payload))));
    return s.x > Date.now() ? s : null;
  } catch { return null; }
}
