/* Tiện ích giao diện dùng chung: định dạng, icon, badge, modal, form, toast */
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0; };
  /* Số tiền người dùng gõ dạng "35.000.000" (dấu chấm = phân cách nghìn) → 35000000 */
  const parseMoney = v => { const s = String(v ?? '').replace(/[^\d-]/g, ''); return s === '' || s === '-' ? 0 : Number(s); };
  /* Số lượng (tấn) người dùng gõ kiểu Việt Nam: "1.250,5" → 1250.5 (chấm = nghìn, phẩy = thập phân) */
  const parseQty = v => { const s = String(v ?? '').replace(/[^\d,-]/g, '').replace(',', '.'); const n = Number(s); return s && isFinite(n) ? n : 0; };
  /* Định dạng lại khi đang gõ, giữ nguyên phần sau dấu phẩy (tối đa 3 chữ số) */
  const typeQty = v => {
    const s = String(v ?? '').replace(/[^\d,]/g, '');
    if (!s) return '';
    const [i, ...d] = s.split(',');
    const int = i === '' ? '0' : Number(i).toLocaleString('vi-VN');
    return s.includes(',') ? int + ',' + d.join('').slice(0, 3) : int;
  };
  const pad = n => String(n).padStart(2, '0');
  const toDate = v => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; };

  const fmt = {
    money(v) { return num(v).toLocaleString('vi-VN') + ' ₫'; },
    short(v) {
      const n = num(v);
      if (Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
      if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
      return n.toLocaleString('vi-VN');
    },
    int(v) { return num(v).toLocaleString('vi-VN'); },
    date(v) { const d = toDate(v); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : ''; },
    dt(v) { const d = toDate(v); return d ? `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : ''; },
    rel(v) {
      const d = toDate(v); if (!d) return '';
      const s = (Date.now() - d) / 1000;
      if (s < 0) return fmt.dt(v);
      if (s < 60) return 'vừa xong';
      if (s < 3600) return Math.floor(s / 60) + ' phút trước';
      if (s < 86400) return Math.floor(s / 3600) + ' giờ trước';
      if (s < 86400 * 7) return Math.floor(s / 86400) + ' ngày trước';
      return fmt.date(v);
    },
  };

  const localInput = (type, v) => {
    if (!v) return '';
    if (type === 'month') return String(v).slice(0, 7);
    const d = toDate(v);
    if (!d) return String(v);
    const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ymd;
    return `${ymd}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  /* Danh sách tháng dạng "Tháng 11/2026" (12 tháng trước → 6 tháng sau), value = "2026-11" */
  const monthOptions = cur => {
    const now = new Date(); const list = [];
    for (let i = 6; i >= -12; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      list.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }
    if (cur && !list.includes(cur)) list.push(cur);
    return list.map(m => `<option value="${m}" ${m === cur ? 'selected' : ''}>Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}</option>`).join('');
  };
  const nowLocal = () => localInput('datetime-local', new Date());
  const today = () => localInput('date', new Date());
  const sameDay = (a, b) => { const x = toDate(a), y = toDate(b); return x && y && x.toDateString() === y.toDateString(); };
  const thisMonth = () => today().slice(0, 7);

  const COLORS = ['#1f6feb', '#7c3aed', '#16a34a', '#ea7a0c', '#db2777', '#0891b2', '#4f46e5', '#b45309', '#0d9488', '#9333ea'];
  const color = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
  const initial = s => { const w = String(s || '?').trim().split(/\s+/); return (w[w.length - 1] || '?')[0].toUpperCase(); };
  const avatar = (name, cls = '') => `<span class="avatar ${cls}" style="background:${color(name)}">${esc(initial(name))}</span>`;
  const staff = name => name ? `<span class="staff">${avatar(name)}${esc(name)}</span>` : '<span class="muted">—</span>';

  const BADGE = {
    'Tiềm năng': 'b-purple', 'Đang giao dịch': 'b-green', 'Tạm dừng': 'b-orange', 'Ngừng giao dịch': 'b-red',
    'A': 'b-green', 'B': 'b-blue', 'C': '',
    'Mới': '', 'Đủ điều kiện': 'b-blue', 'Gửi báo giá': 'b-purple', 'Đàm phán': 'b-orange', 'Thắng': 'b-green', 'Thua': 'b-red',
    'Không nghe máy': '', 'Gọi lại sau': 'b-orange', 'Quan tâm': 'b-blue', 'Hẹn gặp': 'b-purple', 'Chốt đơn': 'b-green', 'Từ chối': 'b-red', 'Sai số': 'b-red',
    'Cao': 'b-red', 'Trung bình': 'b-orange', 'Thấp': '',
    'Đối thủ': 'b-red', 'Giá bán': 'b-orange', 'Khách hàng mới': 'b-green', 'Nhu cầu thị trường': 'b-blue', 'Đại lý / NPP': 'b-purple',
    'Nháp': '', 'Đã duyệt': 'b-blue', 'Đang thực hiện': 'b-purple', 'Hoàn thành': 'b-green',
  };
  const badge = v => v ? `<span class="badge ${BADGE[v] || ''}">${esc(v)}</span>` : '<span class="muted">—</span>';
  const progress = (done, target) => {
    const p = target > 0 ? Math.round(done / target * 100) : 0;
    const cls = p >= 100 ? 'ok' : p < 50 ? 'low' : '';
    return `<div class="row"><div class="progress ${cls}" style="flex:1"><span style="width:${Math.min(p, 100)}%"></span></div><b class="small" style="width:42px;text-align:right">${p}%</b></div>`;
  };

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    radar: '<path d="M19.1 4.9A10 10 0 1 0 22 12"/><path d="M16.2 7.8A6 6 0 1 0 18 12"/><path d="m12 12 7-7"/><circle cx="12" cy="12" r="1"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
  };
  const icon = (n, size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ''}</svg>`;

  function toast(msg, err) {
    const t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), err ? 5000 : 2500);
  }

  function modal({ title, body, foot, wide }) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal" style="${wide ? 'width:min(900px,100%)' : ''}">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="btn btn-ghost btn-sm" data-close>${icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    ov.querySelector('[data-close]').onclick = close;
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    return { el: ov, close };
  }

  /* --------- Form sinh tự động từ ENTITIES --------- */
  function fieldInput(f, value) {
    const id = 'f_' + f.key;
    const req = f.required ? 'required' : '';
    const t = f.type || 'text';
    const v = value ?? '';
    const opts = (list, cur, blank = true) => (blank ? '<option value="">— Chọn —</option>' : '') +
      list.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(cur) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('');
    switch (t) {
      case 'textarea': return `<textarea class="input" id="${id}" name="${f.key}" ${req}>${esc(v)}</textarea>`;
      case 'select': return `<select class="input" id="${id}" name="${f.key}" ${req}>${opts(f.options, v)}</select>`;
      case 'staff': {
        const names = Store.data.NhanVien.filter(n => n.trang_thai !== 'Nghỉ việc').map(n => n.ten);
        if (v && !names.includes(v)) names.push(v);
        return `<select class="input" id="${id}" name="${f.key}" ${req}>${opts(names, v)}</select>`;
      }
      case 'customer': {
        const list = Store.data.KhachHang.slice().sort((a, b) => String(a.ten).localeCompare(b.ten, 'vi')).map(k => [k.id, `${k.ten}${k.ma_kh ? ' (' + k.ma_kh + ')' : ''}`]);
        return `<select class="input" id="${id}" name="${f.key}" ${req}>${opts(list, v)}</select>`;
      }
      case 'list': return `<input class="input" id="${id}" name="${f.key}" list="dl_${f.key}" value="${esc(v)}" ${req} autocomplete="off"><datalist id="dl_${f.key}">${f.options.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
      case 'money': return `<input class="input" id="${id}" name="${f.key}" data-money inputmode="numeric" value="${v === '' ? '' : num(v).toLocaleString('vi-VN')}" ${req}>`;
      case 'number': return `<input class="input" type="number" id="${id}" name="${f.key}" value="${esc(v)}" ${req}>`;
      case 'month': return `<select class="input" id="${id}" name="${f.key}" ${req}>${monthOptions(localInput('month', v))}</select>`;
      case 'date': case 'datetime-local':
        return `<input class="input" type="${t}" id="${id}" name="${f.key}" value="${esc(localInput(t, v))}" ${req}>`;
      default: return `<input class="input" type="${t}" id="${id}" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${req}>`;
    }
  }

  function readForm(form, fields) {
    const out = {};
    fields.forEach(f => {
      const el = form.elements[f.key];
      if (!el) return;
      let v = el.value.trim();
      if (f.type === 'money') v = v === '' ? '' : parseMoney(v);
      else if (f.type === 'number') v = v === '' ? '' : num(v);
      out[f.key] = v;
    });
    return out;
  }

  /**
   * Mở form thêm/sửa cho một bảng.
   * opts: { defaults, onSaved(row, isNew), title, hide: [keys] }
   */
  function openForm(table, record, opts = {}) {
    const ent = ENTITIES[table];
    const isNew = !record;
    const base = { ...(opts.defaults || {}), ...(record || {}) };
    const fields = ent.fields.filter(f => !(opts.hide || []).includes(f.key));
    const body = `<form class="form-grid" novalidate>${fields.map(f => `
      <div class="field ${f.full ? 'full' : ''}"><label for="f_${f.key}">${esc(f.label)} ${f.required ? '<span class="req">*</span>' : ''}</label>${fieldInput(f, base[f.key])}</div>`).join('')}
      <button type="submit" hidden></button></form>`;
    const foot = `<div>${isNew ? '' : '<button class="btn btn-danger" data-del>Xóa</button>'}</div>
      <div class="row"><button class="btn" data-cancel>Hủy</button><button class="btn btn-primary" data-save>${isNew ? 'Tạo mới' : 'Lưu thay đổi'}</button></div>`;
    const m = modal({ title: opts.title || (isNew ? 'Thêm ' : 'Sửa ') + ent.label.toLowerCase(), body, foot });
    const form = m.el.querySelector('form');
    form.querySelectorAll('[data-money]').forEach(i => i.addEventListener('input', () => {
      const n = parseMoney(i.value); i.value = i.value.trim() === '' ? '' : n.toLocaleString('vi-VN');
    }));
    m.el.querySelector('[data-cancel]').onclick = m.close;
    const saveBtn = m.el.querySelector('[data-save]');
    const save = async e => {
      e && e.preventDefault();
      const data = readForm(form, fields);
      const miss = fields.filter(f => f.required && (data[f.key] === '' || data[f.key] == null));
      if (miss.length) { toast('Vui lòng nhập: ' + miss.map(f => f.label).join(', '), true); form.elements[miss[0].key].focus(); return; }
      if (data.khach_hang_id) { const kh = Store.get('KhachHang', data.khach_hang_id); if (kh) data.ten_kh = kh.ten; }
      if (opts.beforeSave) opts.beforeSave(data, isNew);
      saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu…';
      try {
        const row = isNew ? await Store.create(table, { ...(opts.defaults || {}), ...data }) : await Store.update(table, record.id, data);
        m.close();
        toast(isNew ? 'Đã tạo mới' : 'Đã lưu');
        opts.onSaved && opts.onSaved(row, isNew);
        App.render();
      } catch (err) {
        toast('Lỗi: ' + err.message, true);
        saveBtn.disabled = false; saveBtn.textContent = isNew ? 'Tạo mới' : 'Lưu thay đổi';
      }
    };
    saveBtn.onclick = save;
    form.onsubmit = save;
    const del = m.el.querySelector('[data-del]');
    if (del) del.onclick = async () => {
      if (!confirm('Xóa bản ghi này? Thao tác không hoàn tác được.')) return;
      try { await Store.remove(table, record.id); m.close(); toast('Đã xóa'); opts.onDeleted && opts.onDeleted(); App.render(); }
      catch (err) { toast('Lỗi: ' + err.message, true); }
    };
    setTimeout(() => { const first = form.querySelector('input,select,textarea'); first && first.focus(); }, 30);
    return m;
  }

  const selectHtml = (name, label, list, cur, all = 'Tất cả') => `<div class="field"><label>${esc(label)}</label>
    <select class="input" data-filter="${name}"><option value="">${all}</option>${list.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
  const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(b, 'vi'));

  window.UI = { esc, num, parseMoney, parseQty, typeQty, fmt, toDate, localInput, monthOptions, nowLocal, today, thisMonth, sameDay, avatar, staff, badge, progress, icon, toast, modal, openForm, selectHtml, uniq, color };
})();
