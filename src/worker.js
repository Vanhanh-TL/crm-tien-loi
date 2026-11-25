/**
 * Cloudflare Worker: phục vụ giao diện (thư mục public/) và chuyển tiếp /api tới Google Apps Script.
 * Logic /api dùng chung với functions/api.js.
 */
import { onRequestPost, onRequestGet } from '../functions/api.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api') {
      return request.method === 'POST' ? onRequestPost({ request, env }) : onRequestGet();
    }
    return env.ASSETS.fetch(request);
  },
};
