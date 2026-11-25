/**
 * Cloudflare Pages Function: /api
 * Trung gian giữa giao diện và Google Apps Script, để giấu URL + token khỏi trình duyệt.
 *
 * Biến môi trường cần khai báo trong Cloudflare Pages → Settings → Variables and Secrets:
 *   APPS_SCRIPT_URL  = https://script.google.com/macros/s/xxxx/exec
 *   API_TOKEN        = (trùng với API_TOKEN trong Script properties của Apps Script)
 */
const ALLOWED = new Set(['ping', 'all', 'list', 'create', 'update', 'delete']);

export async function onRequestPost({ request, env }) {
  if (!env.APPS_SCRIPT_URL || !env.API_TOKEN) {
    return Response.json({ ok: false, error: 'Chưa cấu hình APPS_SCRIPT_URL / API_TOKEN' }, { status: 503 });
  }
  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: 'JSON không hợp lệ' }, { status: 400 }); }
  if (!ALLOWED.has(body.action)) return Response.json({ ok: false, error: 'Action không hợp lệ' }, { status: 400 });

  // Ghi lại người thao tác (nếu bật Cloudflare Access)
  const user = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (user && body.data && typeof body.data === 'object') body.data._user = user;

  const res = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, token: env.API_TOKEN }),
    redirect: 'follow',
  });
  const text = await res.text();
  try {
    return Response.json(JSON.parse(text));
  } catch {
    return Response.json({ ok: false, error: 'Apps Script trả về dữ liệu lạ (kiểm tra quyền truy cập Web app)' }, { status: 502 });
  }
}

export function onRequestGet() {
  return Response.json({ ok: false, error: 'Dùng POST' }, { status: 405 });
}
