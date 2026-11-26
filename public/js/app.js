/* Ứng dụng CRM: router + các màn hình */
(function () {
  const { esc, num, fmt, toDate, today, thisMonth, sameDay, avatar, staff, badge, progress, icon, toast, openForm, selectHtml, uniq } = UI;
  const D = () => Store.data;

  const NAV = [
    { group: 'Tổng quan', items: [{ id: 'tong-quan', label: 'Tổng quan CRM', icon: 'home' }] },
    { group: 'Khách hàng', items: [{ id: 'khach-hang', label: 'Khách hàng', icon: 'users', count: () => D().KhachHang.length }] },
    { group: 'Bán hàng', items: [
      { id: 'pipeline', label: 'Pipeline', icon: 'target', count: () => D().CoHoi.filter(isOpen).length },
      { id: 'telesale', label: 'Telesale', icon: 'phone', count: () => callbackQueue().length || '' },
    ] },
    { group: 'Thị trường', items: [
      { id: 'thi-truong', label: 'Thu thập thị trường', icon: 'radar' },
      { id: 'ke-hoach', label: 'Kế hoạch thị trường', icon: 'calendar' },
    ] },
    { group: 'Thiết lập', items: [{ id: 'nhan-vien', label: 'Nhân viên', icon: 'user' }] },
  ];

  const App = {
    ui: {},
    route: 'tong-quan',
    currentUser() { try { return localStorage.getItem('crm-user') || ''; } catch (e) { return ''; } },
    st(view, defaults) { return (this.ui[view] = this.ui[view] || { ...defaults }); },

    async start() {
      document.getElementById('app').innerHTML = '<div class="loading">Đang tải dữ liệu…</div>';
      await Store.init();
      if (!this.currentUser() && D().NhanVien[0]) try { localStorage.setItem('crm-user', D().NhanVien[0].ten); } catch (e) { }
      window.addEventListener('hashchange', () => this.render());
      this.render();
    },

    render() {
      this.route = (location.hash.replace(/^#\/?/, '') || 'tong-quan').split('?')[0];
      const view = VIEWS[this.route] || VIEWS['tong-quan'];
      const active = document.activeElement;
      const focusKey = active && active.dataset && active.dataset.filter;
      const caret = focusKey && active.selectionStart;
      const scroll = document.querySelector('.main')?.scrollTop || 0;

      document.getElementById('app').innerHTML = `<div class="app">${sidebar()}<div class="main">
        <div class="topbar-mobile"><button class="btn btn-sm" data-act="menu">${icon('menu')}</button>CRM Tiến Lợi</div>
        <div class="page">${view.render()}</div></div></div>`;
      bindCommon(view);
      view.mount && view.mount();
      document.querySelector('.main').scrollTop = scroll;
      if (focusKey) {
        const el = document.querySelector(`[data-filter="${focusKey}"]`);
        if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch (e) { } }
      }
    },
  };

  function sidebar() {
    const me = App.currentUser();
    return `<aside class="sidebar">
      <div class="brand"><div class="brand-logo">TL</div>CRM Tiện Lợi</div>
      ${NAV.map(g => `<div class="nav-group"><div class="nav-title">${g.group}</div>
        ${g.items.map(i => `<a class="nav-item ${App.route === i.id ? 'active' : ''}" href="#/${i.id}">${icon(i.icon)}${i.label}${i.count ? `<span class="count">${i.count()}</span>` : ''}</a>`).join('')}</div>`).join('')}
      <div class="sidebar-foot">
        <div class="field" style="min-width:0;margin-bottom:10px"><label>Bạn là</label>
          <select class="input" data-act="me">${D().NhanVien.map(n => `<option ${n.ten === me ? 'selected' : ''}>${esc(n.ten)}</option>`).join('')}</select></div>
        <div class="between"><span class="mode-pill ${Store.mode}">${Store.mode === 'live' ? 'Google Sheet' : 'Chế độ demo'}</span>
        ${Store.mode === 'demo' ? '<button class="btn btn-sm btn-ghost" data-act="reset-demo" title="Xóa dữ liệu demo và tạo lại">Làm mới</button>' : '<button class="btn btn-sm btn-ghost" data-act="reload">Tải lại</button>'}</div>
      </div></aside>`;
  }

  function bindCommon(view) {
    const root = document.getElementById('app');
    root.querySelectorAll('[data-filter]').forEach(el => {
      const ev = el.tagName === 'INPUT' && el.type !== 'month' ? 'input' : 'change';
      el.addEventListener(ev, () => { App.st(App.route)[el.dataset.filter] = el.value; App.render(); });
    });
    root.querySelector('[data-act="me"]')?.addEventListener('change', e => { try { localStorage.setItem('crm-user', e.target.value); } catch (x) { } });
    root.onclick = async e => {
      const el = e.target.closest('[data-act]');
      if (!el || el.tagName === 'SELECT') return;
      const act = el.dataset.act;
      if (act === 'menu') return document.querySelector('.sidebar').classList.toggle('open');
      if (act === 'reset-demo') { if (confirm('Xóa dữ liệu demo đã nhập và tạo lại dữ liệu mẫu?')) Store.resetDemo(); return; }
      if (act === 'reload') { await Store.reload(); App.render(); return toast('Đã tải lại dữ liệu'); }
      view.actions && view.actions[act] && view.actions[act](el.dataset, e);
    };
  }

  /* ---------------- Hàm tính toán dùng chung ---------------- */
  const isOpen = c => c.giai_doan !== 'Thắng' && c.giai_doan !== 'Thua';
  const inMonth = (v, m) => String(UI.localInput('date', v)).slice(0, 7) === m;
  const search = (q, ...vals) => !q || vals.join(' ').toLowerCase().includes(q.toLowerCase());
  const missingInfo = k => !k.tinh || !k.nhom_kd || (k.loai !== 'Cá nhân' && !k.mst);
  const salesNames = () => uniq(D().NhanVien.map(n => n.ten));
  const kpi = (label, value, hint = '', cls = '', act = '') => `<div class="kpi ${cls}" ${act ? `data-act="${act}" style="cursor:pointer"` : ''}><div class="label">${label}</div><div class="value">${value}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  const head = (crumb, title, sub, actions = '') => `<div class="page-head"><div><div class="crumb">${crumb}</div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="head-actions">${actions}</div></div>`;
  const bars = (rows, fmtVal = v => v) => {
    const max = Math.max(1, ...rows.map(r => r.value));
    return `<div class="bars">${rows.map(r => `<div class="bar-row"><span>${esc(r.label)}</span><div class="track"><div class="fill" style="width:${r.value / max * 100}%;background:${r.color || 'var(--primary)'}"></div></div><span class="val">${fmtVal(r.value)}</span></div>`).join('')}</div>`;
  };

  /* Hàng đợi gọi lại: lấy cuộc gọi mới nhất của mỗi KH, nếu có hẹn gọi lại <= cuối hôm nay */
  function latestCallByCustomer() {
    const map = {};
    D().Telesale.forEach(t => {
      const key = t.khach_hang_id || ('sdt:' + t.sdt);
      if (!map[key] || toDate(t.ngay) > toDate(map[key].ngay)) map[key] = t;
    });
    return map;
  }
  function callbackQueue() {
    const end = new Date(); end.setHours(23, 59, 59);
    return Object.values(latestCallByCustomer()).filter(t => t.hen_goi_lai && toDate(t.hen_goi_lai) <= end)
      .sort((a, b) => toDate(a.hen_goi_lai) - toDate(b.hen_goi_lai));
  }

  /* ========================================================= */
  /* TỔNG QUAN                                                  */
  /* ========================================================= */
  const Dashboard = {
    render() {
      const d = D(); const m = thisMonth();
      const open = d.CoHoi.filter(isOpen);
      const won = d.CoHoi.filter(c => c.giai_doan === 'Thắng' && inMonth(c.ngay_cap_nhat, m));
      const callsToday = d.Telesale.filter(t => sameDay(t.ngay, new Date()));
      const week = Date.now() - 7 * 864e5;
      const tt7 = d.ThiTruong.filter(t => toDate(t.ngay) >= week);
      const plans = d.KeHoach.filter(p => p.thang === m);
      const target = plans.reduce((s, p) => s + num(p.muc_tieu_doanh_so), 0);
      const done = plans.reduce((s, p) => s + num(p.thuc_hien_doanh_so), 0);
      const calls7 = d.Telesale.filter(t => toDate(t.ngay) >= week);
      const acts = d.HoatDong.slice().sort((a, b) => toDate(b.thoi_gian) - toDate(a.thoi_gian)).slice(0, 10);
      const cb = callbackQueue();

      return head('Tổng quan', 'Tổng quan CRM', `Tháng ${m.slice(5)}/${m.slice(0, 4)} · ${Store.mode === 'live' ? 'dữ liệu Google Sheet' : 'dữ liệu demo'}`,
        `<button class="btn btn-dark" data-act="new-kh">${icon('plus', 15)} Khách hàng</button>`) +
        `<div class="kpis">
          ${kpi('Tổng khách hàng', fmt.int(d.KhachHang.length), `${d.KhachHang.filter(k => inMonth(k.ngay_tao, m)).length} KH mới tháng này`)}
          ${kpi('Pipeline đang mở', fmt.short(open.reduce((s, c) => s + num(c.gia_tri), 0)), `${open.length} cơ hội`)}
          ${kpi('Doanh số thắng tháng', fmt.short(won.reduce((s, c) => s + num(c.gia_tri), 0)), `${won.length} cơ hội thắng`, 'good')}
          ${kpi('Kế hoạch doanh số', target ? Math.round(done / target * 100) + '%' : '—', `${fmt.short(done)} / ${fmt.short(target)}`)}
          ${kpi('Cuộc gọi hôm nay', callsToday.length, `${cb.length} khách cần gọi lại`)}
          ${kpi('Tin thị trường 7 ngày', tt7.length, `${tt7.filter(t => t.muc_do === 'Cao').length} tin quan trọng`)}
        </div>
        <div class="grid-3">
          <div style="display:flex;flex-direction:column;gap:14px">
            <div class="card"><div class="card-head"><h3>Pipeline theo giai đoạn</h3><a href="#/pipeline" class="small">Mở pipeline →</a></div><div class="card-body">
              ${bars(OPT.giaiDoan.map(g => ({ label: g, value: d.CoHoi.filter(c => c.giai_doan === g).reduce((s, c) => s + num(c.gia_tri), 0), color: g === 'Thắng' ? 'var(--green)' : g === 'Thua' ? 'var(--red)' : '' })), fmt.short)}</div></div>
            <div class="grid-2">
              <div class="card"><div class="card-head"><h3>Kế hoạch tháng theo NVKD</h3><a href="#/ke-hoach" class="small">Chi tiết →</a></div><div class="card-body">
                ${plans.length ? plans.map(p => `<div style="margin-bottom:10px"><div class="between small"><span>${staff(p.nvkd)}</span><span class="muted">${fmt.short(p.thuc_hien_doanh_so)} / ${fmt.short(p.muc_tieu_doanh_so)}</span></div>${progress(num(p.thuc_hien_doanh_so), num(p.muc_tieu_doanh_so))}</div>`).join('') : '<div class="muted small">Chưa có kế hoạch tháng này.</div>'}
              </div></div>
              <div class="card"><div class="card-head"><h3>Telesale 7 ngày</h3><a href="#/telesale" class="small">Gọi ngay →</a></div><div class="card-body">
                ${bars(OPT.ketQua.map(k => ({ label: k, value: calls7.filter(t => t.ket_qua === k).length })).filter(r => r.value), v => v + ' cuộc')}
              </div></div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px">
            <div class="card"><div class="card-head"><h3>Cần gọi lại hôm nay</h3><span class="badge b-orange">${cb.length}</span></div><div class="card-body">
              ${cb.slice(0, 6).map(t => `<div class="mini-card"><div class="t"><span>${esc(t.ten_kh)}</span><span class="small ${toDate(t.hen_goi_lai) < new Date() ? '' : 'muted'}" style="color:${toDate(t.hen_goi_lai) < new Date() ? 'var(--red)' : ''}">${fmt.dt(t.hen_goi_lai)}</span></div><div class="s">${esc(t.ket_qua)} · ${esc(t.nhan_vien)}</div></div>`).join('') || '<div class="muted small">Không có lịch gọi lại.</div>'}
            </div></div>
            <div class="card"><div class="card-head"><h3>Hoạt động gần đây</h3></div><div class="card-body"><ul class="timeline">
              ${acts.map(a => `<li><div>${esc(a.noi_dung)}</div><div class="when">${esc(a.nguoi_thuc_hien || '')} · ${fmt.rel(a.thoi_gian)}${a.doi_tuong === 'KhachHang' && Store.get('KhachHang', a.doi_tuong_id) ? ' · ' + esc(Store.get('KhachHang', a.doi_tuong_id).ten) : ''}</div></li>`).join('') || '<li class="muted">Chưa có hoạt động.</li>'}
            </ul></div></div>
          </div>
        </div>`;
    },
    actions: { 'new-kh': () => Customers.actions.new() },
  };

  /* ========================================================= */
  /* KHÁCH HÀNG                                                 */
  /* ========================================================= */
  const Customers = {
    rows() {
      const s = App.st('khach-hang', { nvkd: '', nhom: '', tinh: '', tt: '', q: '', missing: false });
      return D().KhachHang.filter(k =>
        (!s.nvkd || k.nvkd === s.nvkd) && (!s.nhom || k.nhom_kd === s.nhom) && (!s.tinh || k.tinh === s.tinh) &&
        (!s.tt || k.trang_thai === s.tt) && (!s.missing || missingInfo(k)) &&
        search(s.q, k.ten, k.ma_kh, k.nguoi_lien_he, k.sdt, k.mst)
      ).sort((a, b) => String(b.ngay_cap_nhat).localeCompare(String(a.ngay_cap_nhat)));
    },
    render() {
      const s = App.st('khach-hang', {});
      const all = D().KhachHang;
      const rows = this.rows();
      const sel = s.sel && Store.get('KhachHang', s.sel);
      return head('Khách hàng', 'Danh sách khách hàng', `${rows.length} / ${all.length} khách hàng`,
        `<button class="btn" data-act="export">Xuất CSV</button><button class="btn btn-primary" data-act="new">${icon('plus', 15)} Tạo khách hàng</button>`) +
        `<div class="kpis">
          ${kpi('Tổng khách hàng', fmt.int(all.length), '', '', 'kpi-all')}
          ${kpi('Đang giao dịch', fmt.int(all.filter(k => k.trang_thai === 'Đang giao dịch').length), '', '', 'kpi-gd')}
          ${kpi('Tiềm năng', fmt.int(all.filter(k => k.trang_thai === 'Tiềm năng').length), '', '', 'kpi-tn')}
          ${kpi('Thiếu thông tin (tỉnh, nhóm KD, MST)', fmt.int(all.filter(missingInfo).length), s.missing ? 'Đang lọc — bấm để bỏ lọc' : 'Bấm để lọc', 'warn', 'kpi-missing')}
        </div>
        <div class="filters">
          <div class="field search"><label>Tìm kiếm</label><input class="input" data-filter="q" value="${esc(s.q)}" placeholder="Tên, mã KH, SĐT, MST…"></div>
          ${selectHtml('nvkd', 'NVKD phụ trách', uniq(all.map(k => k.nvkd)), s.nvkd)}
          ${selectHtml('nhom', 'Nhóm KD', uniq(all.map(k => k.nhom_kd)), s.nhom)}
          ${selectHtml('tinh', 'Tỉnh/TP', uniq(all.map(k => k.tinh)), s.tinh)}
          ${selectHtml('tt', 'Trạng thái', OPT.trangThaiKH, s.tt)}
        </div>
        <div class="${sel ? 'split' : ''}">
          <div class="table-wrap"><table><thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Tỉnh/TP</th><th class="hide-mobile">Nhóm KD</th><th>NVKD</th><th class="hide-mobile">Nguồn</th><th>Hạng</th><th>Trạng thái</th></tr></thead><tbody>
          ${rows.map(k => `<tr class="clickable ${sel && sel.id === k.id ? 'selected' : ''}" data-act="select" data-id="${esc(k.id)}">
            <td><div class="who">${avatar(k.ten)}<div><div class="name">${esc(k.ten)}</div><div class="meta">${esc(k.ma_kh)}${k.loai ? ' · ' + esc(k.loai) : ''}</div></div></div></td>
            <td><div>${esc(k.nguoi_lien_he)}</div><div class="meta muted small">${esc(k.sdt)}</div></td>
            <td>${esc(k.tinh) || '<span class="badge b-orange">Thiếu</span>'}</td>
            <td class="hide-mobile">${esc(k.nhom_kd) || '<span class="badge b-orange">Thiếu</span>'}</td>
            <td>${staff(k.nvkd)}</td><td class="hide-mobile">${esc(k.nguon)}</td><td>${badge(k.diem)}</td><td>${badge(k.trang_thai)}</td></tr>`).join('')}
          </tbody></table>${rows.length ? '' : '<div class="empty">Không có khách hàng phù hợp bộ lọc.</div>'}</div>
          ${sel ? this.detail(sel) : ''}
        </div>`;
    },
    detail(k) {
      const deals = D().CoHoi.filter(c => c.khach_hang_id === k.id);
      const calls = D().Telesale.filter(t => t.khach_hang_id === k.id).sort((a, b) => toDate(b.ngay) - toDate(a.ngay));
      const acts = D().HoatDong.filter(a => a.doi_tuong_id === k.id).sort((a, b) => toDate(b.thoi_gian) - toDate(a.thoi_gian));
      return `<div class="card detail"><div class="card-body">
        <div class="between"><div class="detail-head">${avatar(k.ten, 'lg')}<div><h2>${esc(k.ten)}</h2><div class="muted small">${esc(k.nguoi_lien_he)}${k.chuc_vu ? ' · ' + esc(k.chuc_vu) : ''}</div></div></div>
          <button class="btn btn-ghost btn-sm" data-act="close">${icon('x')}</button></div>
        <div class="row mt" style="flex-wrap:wrap">${badge(k.trang_thai)} ${k.diem ? badge(k.diem) : ''} ${missingInfo(k) ? '<span class="badge b-orange">Thiếu thông tin</span>' : ''}</div>
        <div class="row mt" style="flex-wrap:wrap">
          ${k.sdt ? `<a class="btn btn-sm" href="tel:${esc(k.sdt)}">${icon('phone', 14)} Gọi</a>` : ''}
          <button class="btn btn-sm" data-act="log-call" data-id="${esc(k.id)}">Ghi cuộc gọi</button>
          <button class="btn btn-sm" data-act="new-deal" data-id="${esc(k.id)}">+ Cơ hội</button>
          <button class="btn btn-sm" data-act="edit" data-id="${esc(k.id)}">Sửa</button>
        </div>
        <div class="section-title">Thông tin</div>
        <dl class="kv">
          <dt>Mã KH</dt><dd>${esc(k.ma_kh) || '—'}</dd><dt>MST</dt><dd>${esc(k.mst) || '—'}</dd>
          <dt>Điện thoại</dt><dd>${esc(k.sdt) || '—'}</dd><dt>Email</dt><dd>${esc(k.email) || '—'}</dd>
          <dt>Địa chỉ</dt><dd>${esc([k.dia_chi, k.tinh].filter(Boolean).join(', ')) || '—'}</dd>
          <dt>Nhóm KD</dt><dd>${esc(k.nhom_kd) || '—'}</dd><dt>NVKD</dt><dd>${staff(k.nvkd)}</dd>
          <dt>Nguồn</dt><dd>${esc(k.nguon) || '—'}</dd><dt>Ngày tạo</dt><dd>${fmt.date(k.ngay_tao)}</dd>
          ${k.ghi_chu ? `<dt>Ghi chú</dt><dd>${esc(k.ghi_chu)}</dd>` : ''}
        </dl>
        <div class="section-title">Cơ hội (${deals.length})</div>
        ${deals.map(c => `<div class="mini-card" data-act="edit-deal" data-id="${esc(c.id)}" style="cursor:pointer"><div class="t"><span>${esc(c.ten)}</span><span>${fmt.short(c.gia_tri)}</span></div><div class="s between"><span>Dự kiến ${fmt.date(c.ngay_du_kien)}</span>${badge(c.giai_doan)}</div></div>`).join('') || '<div class="muted small">Chưa có cơ hội.</div>'}
        <div class="section-title">Cuộc gọi (${calls.length})</div>
        ${calls.slice(0, 5).map(t => `<div class="mini-card"><div class="t"><span>${badge(t.ket_qua)}</span><span class="small muted">${fmt.dt(t.ngay)}</span></div><div class="s">${esc(t.nhan_vien)}${t.ghi_chu ? ' · ' + esc(t.ghi_chu) : ''}</div></div>`).join('') || '<div class="muted small">Chưa có cuộc gọi.</div>'}
        <div class="section-title">Hành trình tương tác</div>
        <div class="row" style="margin-bottom:12px"><input class="input" id="note-input" placeholder="Thêm ghi chú, kết quả gặp khách…"><button class="btn btn-sm btn-dark" data-act="add-note" data-id="${esc(k.id)}">Lưu</button></div>
        <ul class="timeline">${acts.map(a => `<li><div>${esc(a.noi_dung)}</div><div class="when">${esc(a.loai)} · ${esc(a.nguoi_thuc_hien || '')} · ${fmt.rel(a.thoi_gian)}</div></li>`).join('') || '<li class="muted">Chưa có hoạt động.</li>'}</ul>
      </div></div>`;
    },
    actions: {
      new() {
        const n = D().KhachHang.length + 1;
        openForm('KhachHang', null, {
          defaults: { loai: 'Pháp nhân', trang_thai: 'Tiềm năng', nvkd: App.currentUser() },
          beforeSave(data) { if (!data.ma_kh) data.ma_kh = 'KH-' + String(Math.max(n, ...D().KhachHang.map(k => num(k.ma_kh) + 1))).padStart(4, '0'); },
          onSaved(row) { App.st('khach-hang', {}).sel = row.id; Store.log('Khách hàng', 'KhachHang', row.id, 'Tạo khách hàng mới'); location.hash = '#/khach-hang'; },
        });
      },
      select(ds) { const s = App.st('khach-hang', {}); s.sel = s.sel === ds.id ? null : ds.id; App.render(); },
      close() { App.st('khach-hang', {}).sel = null; App.render(); },
      edit(ds) { openForm('KhachHang', Store.get('KhachHang', ds.id), { onDeleted: () => { App.st('khach-hang', {}).sel = null; } }); },
      'edit-deal'(ds) { Pipeline.actions.edit(ds); },
      'new-deal'(ds) { Pipeline.actions.new({ khach_hang_id: ds.id }); },
      'log-call'(ds) { Telesale.quickForm(ds.id); },
      async 'add-note'(ds) {
        const inp = document.getElementById('note-input');
        if (!inp.value.trim()) return;
        await Store.log('Ghi chú', 'KhachHang', ds.id, inp.value.trim());
        App.render();
      },
      'kpi-all'() { Object.assign(App.st('khach-hang', {}), { tt: '', missing: false }); App.render(); },
      'kpi-gd'() { Object.assign(App.st('khach-hang', {}), { tt: 'Đang giao dịch', missing: false }); App.render(); },
      'kpi-tn'() { Object.assign(App.st('khach-hang', {}), { tt: 'Tiềm năng', missing: false }); App.render(); },
      'kpi-missing'() { const s = App.st('khach-hang', {}); s.missing = !s.missing; s.tt = ''; App.render(); },
      export() { exportCsv('khach-hang.csv', ENTITIES.KhachHang.fields, Customers.rows(), ['ma_kh']); },
    },
  };

  /* ========================================================= */
  /* PIPELINE                                                   */
  /* ========================================================= */
  const DEFAULT_PROB = { 'Mới': 10, 'Đủ điều kiện': 25, 'Gửi báo giá': 50, 'Đàm phán': 75, 'Thắng': 100, 'Thua': 0 };
  const Pipeline = {
    render() {
      const s = App.st('pipeline', { nvkd: '', q: '' });
      const deals = D().CoHoi.filter(c => (!s.nvkd || c.nvkd === s.nvkd) && search(s.q, c.ten, c.ten_kh));
      const open = deals.filter(isOpen);
      const closed = deals.filter(c => !isOpen(c));
      const winRate = closed.length ? Math.round(closed.filter(c => c.giai_doan === 'Thắng').length / closed.length * 100) : 0;
      return head('', 'Pipeline','',`<button class="btn btn-primary" data-act="new">${icon('plus', 15)} Thêm cơ hội</button>`) +
        `<div class="kpis">
          ${kpi('Giá trị đang mở', fmt.short(open.reduce((a, c) => a + num(c.gia_tri), 0)), open.length + ' cơ hội')}
          ${kpi('Dự báo (theo xác suất)', fmt.short(open.reduce((a, c) => a + num(c.gia_tri) * num(c.xac_suat) / 100, 0)))}
          ${kpi('Đã thắng', fmt.short(deals.filter(c => c.giai_doan === 'Thắng').reduce((a, c) => a + num(c.gia_tri), 0)), '', 'good')}
          ${kpi('Tỷ lệ thắng', winRate + '%', closed.length + ' cơ hội đã đóng')}
        </div>
        <div class="filters">
          <div class="field search"><label>Tìm kiếm</label><input class="input" data-filter="q" value="${esc(s.q)}" placeholder="Tên cơ hội, khách hàng…"></div>
          ${selectHtml('nvkd', 'NVKD', uniq(D().CoHoi.map(c => c.nvkd)), s.nvkd)}
        </div>
        <div class="kanban">${OPT.giaiDoan.map(g => {
          const list = deals.filter(c => (c.giai_doan || 'Mới') === g);
          return `<div class="col" data-stage="${esc(g)}"><div class="col-head"><span class="t">${esc(g)} <span class="muted">${list.length}</span></span><span class="s">${fmt.short(list.reduce((a, c) => a + num(c.gia_tri), 0))}</span></div>
            ${list.map(c => `<div class="deal" draggable="true" data-id="${esc(c.id)}" data-act="edit"><div class="t">${esc(c.ten)}</div><div class="c">${esc(c.ten_kh)}</div>
              <div class="r"><span class="v">${fmt.short(c.gia_tri)}</span><span class="small muted">${c.ngay_du_kien ? fmt.date(c.ngay_du_kien) : ''}</span></div>
              <div class="r" style="margin-top:6px">${staff(c.nvkd)}<span class="small muted">${num(c.xac_suat)}%</span></div></div>`).join('')}
          </div>`;
        }).join('')}</div>`;
    },
    mount() {
      document.querySelectorAll('.deal').forEach(el => el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', el.dataset.id); }));
      document.querySelectorAll('.col').forEach(col => {
        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
        col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
        col.addEventListener('drop', async e => {
          e.preventDefault(); col.classList.remove('drag-over');
          const id = e.dataTransfer.getData('text/plain'); const stage = col.dataset.stage;
          const c = Store.get('CoHoi', id);
          if (!c || c.giai_doan === stage) return;
          try {
            await Store.update('CoHoi', id, { giai_doan: stage, xac_suat: DEFAULT_PROB[stage] });
            Store.log('Cơ hội', 'KhachHang', c.khach_hang_id, `Chuyển cơ hội "${c.ten}" sang ${stage}`);
            toast(`Đã chuyển sang "${stage}"`); App.render();
          } catch (err) { toast('Lỗi: ' + err.message, true); }
        });
      });
    },
    actions: {
      new(defaults = {}) {
        openForm('CoHoi', null, {
          defaults: { giai_doan: 'Mới', xac_suat: 10, nvkd: App.currentUser(), ...defaults },
          onSaved(row) { Store.log('Cơ hội', 'KhachHang', row.khach_hang_id, `Tạo cơ hội "${row.ten}" (${fmt.short(row.gia_tri)})`); },
        });
      },
      edit(ds) {
        const old = Store.get('CoHoi', ds.id);
        const prev = old.giai_doan;
        openForm('CoHoi', old, { onSaved(row) { if (row.giai_doan !== prev) Store.log('Cơ hội', 'KhachHang', row.khach_hang_id, `Chuyển cơ hội "${row.ten}" sang ${row.giai_doan}`); } });
      },
    },
  };

  /* ========================================================= */
  /* TELESALE                                                   */
  /* ========================================================= */
  const Telesale = {
    queue(tab, q) {
      const last = latestCallByCustomer();
      const kh = D().KhachHang;
      if (tab === 'callback') return callbackQueue().map(t => ({ kh: Store.get('KhachHang', t.khach_hang_id), call: t, name: t.ten_kh, phone: t.sdt }));
      if (tab === 'new') return kh.filter(k => !last[k.id] && k.trang_thai !== 'Ngừng giao dịch').map(k => ({ kh: k, name: k.ten, phone: k.sdt }));
      return kh.filter(k => search(q, k.ten, k.sdt, k.nguoi_lien_he)).map(k => ({ kh: k, call: last[k.id], name: k.ten, phone: k.sdt }));
    },
    render() {
      const s = App.st('telesale', { tab: 'callback', q: '', day: today(), nv: '', sel: null, kq: '' });
      const all = D().Telesale;
      const todayCalls = all.filter(t => sameDay(t.ngay, new Date()));
      const connected = todayCalls.filter(t => !['Không nghe máy', 'Sai số'].includes(t.ket_qua));
      const list = this.queue(s.tab, s.q);
      const sel = s.sel && Store.get('KhachHang', s.sel);
      const logRows = all.filter(t => (!s.day || UI.localInput('date', t.ngay) === s.day) && (!s.nv || t.nhan_vien === s.nv)).sort((a, b) => toDate(b.ngay) - toDate(a.ngay));
      const tabs = [['callback', `Cần gọi lại (${callbackQueue().length})`], ['new', 'Chưa từng gọi'], ['all', 'Tất cả KH']];

      return head('', 'Telesale', '',
        `<button class="btn btn-primary" data-act="new-call">${icon('plus', 15)} Ghi cuộc gọi</button>`) +
        `<div class="kpis">
          ${kpi('Cuộc gọi hôm nay', todayCalls.length)}
          ${kpi('Tỷ lệ kết nối', todayCalls.length ? Math.round(connected.length / todayCalls.length * 100) + '%' : '—', connected.length + ' cuộc nghe máy')}
          ${kpi('Quan tâm / Hẹn gặp', todayCalls.filter(t => ['Quan tâm', 'Hẹn gặp'].includes(t.ket_qua)).length)}
          ${kpi('Chốt đơn hôm nay', todayCalls.filter(t => t.ket_qua === 'Chốt đơn').length, '', 'good')}
        </div>
        <div class="grid-2" style="grid-template-columns:minmax(0,1fr) minmax(0,1.3fr)">
          <div class="card"><div class="tabs" style="padding:0 10px;margin:0">${tabs.map(([k, l]) => `<div class="tab ${s.tab === k ? 'active' : ''}" data-act="tab" data-tab="${k}">${l}</div>`).join('')}</div>
            ${s.tab === 'all' ? `<div style="padding:10px"><input class="input" data-filter="q" value="${esc(s.q)}" placeholder="Tìm tên, SĐT…"></div>` : ''}
            <div style="max-height:460px;overflow-y:auto">${list.slice(0, 200).map(it => `<div class="call-item ${sel && it.kh && sel.id === it.kh.id ? 'active' : ''}" data-act="pick" data-id="${esc(it.kh ? it.kh.id : '')}">
              ${avatar(it.name)}<div class="grow"><div class="n">${esc(it.name)}</div><div class="m">${esc(it.phone || 'Chưa có SĐT')}${it.call ? ' · ' + esc(it.call.ket_qua) + ' ' + fmt.rel(it.call.ngay) : ''}</div></div>
              ${it.call && it.call.hen_goi_lai && s.tab === 'callback' ? `<span class="badge ${toDate(it.call.hen_goi_lai) < new Date() ? 'b-red' : 'b-orange'}">${fmt.dt(it.call.hen_goi_lai)}</span>` : ''}</div>`).join('') || '<div class="empty">Không có khách nào trong danh sách này.</div>'}</div>
          </div>
          <div class="card"><div class="card-body">${sel ? this.callPanel(sel, s) : '<div class="empty">Chọn một khách hàng bên trái để bắt đầu gọi.</div>'}</div></div>
        </div>
        <div class="between mt"><div class="section-title" style="margin:0">Nhật ký cuộc gọi</div>
          <div class="row"><input type="date" class="input" data-filter="day" value="${esc(s.day)}" style="width:auto">
          <select class="input" data-filter="nv" style="width:auto"><option value="">Tất cả nhân viên</option>${uniq(all.map(t => t.nhan_vien)).map(n => `<option ${n === s.nv ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div></div>
        <div class="table-wrap mt"><table><thead><tr><th>Thời gian</th><th>Khách hàng</th><th>SĐT</th><th>Nhân viên</th><th>Kết quả</th><th class="num">Phút</th><th>Hẹn gọi lại</th><th>Ghi chú</th></tr></thead><tbody>
          ${logRows.map(t => `<tr class="clickable" data-act="edit-call" data-id="${esc(t.id)}"><td>${fmt.dt(t.ngay)}</td><td><b>${esc(t.ten_kh)}</b></td><td>${esc(t.sdt)}</td><td>${staff(t.nhan_vien)}</td><td>${badge(t.ket_qua)}</td><td class="num">${esc(t.thoi_luong_phut)}</td><td>${fmt.dt(t.hen_goi_lai)}</td><td style="white-space:normal;max-width:320px">${esc(t.ghi_chu)}</td></tr>`).join('')}
        </tbody></table>${logRows.length ? '' : '<div class="empty">Chưa có cuộc gọi trong ngày đã chọn.</div>'}</div>`;
    },
    callPanel(k, s) {
      const history = D().Telesale.filter(t => t.khach_hang_id === k.id).sort((a, b) => toDate(b.ngay) - toDate(a.ngay));
      return `<div class="between"><div class="detail-head">${avatar(k.ten, 'lg')}<div><h2>${esc(k.ten)}</h2><div class="muted small">${esc(k.nguoi_lien_he)} · ${esc(k.tinh)} · NVKD ${esc(k.nvkd)}</div></div></div>
          ${k.sdt ? `<a class="btn btn-primary" href="tel:${esc(k.sdt)}">${icon('phone', 15)} ${esc(k.sdt)}</a>` : '<span class="badge b-orange">Chưa có SĐT</span>'}</div>
        <div class="section-title">Kết quả cuộc gọi</div>
        <div class="result-btns">${OPT.ketQua.map(r => `<button class="btn btn-sm ${s.kq === r ? 'on' : ''}" data-act="kq" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div>
        <div class="form-grid mt">
          <div class="field"><label>Thời lượng (phút)</label><input class="input" type="number" id="c-min" min="0"></div>
          <div class="field"><label>Hẹn gọi lại</label><input class="input" type="datetime-local" id="c-cb"></div>
          <div class="field full"><label>Ghi chú</label><textarea class="input" id="c-note" placeholder="Nhu cầu, phản hồi, thông tin bổ sung…"></textarea></div>
        </div>
        <div class="row mt" style="justify-content:flex-end"><button class="btn" data-act="open-kh" data-id="${esc(k.id)}">Xem hồ sơ</button><button class="btn btn-dark" data-act="save-call" data-id="${esc(k.id)}">Lưu cuộc gọi</button></div>
        <div class="section-title">Lịch sử gọi (${history.length})</div>
        ${history.slice(0, 5).map(t => `<div class="mini-card"><div class="t"><span>${badge(t.ket_qua)}</span><span class="small muted">${fmt.dt(t.ngay)} · ${esc(t.nhan_vien)}</span></div>${t.ghi_chu ? `<div class="s">${esc(t.ghi_chu)}</div>` : ''}</div>`).join('') || '<div class="muted small">Chưa gọi lần nào.</div>'}`;
    },
    quickForm(khId) {
      const kh = khId && Store.get('KhachHang', khId);
      openForm('Telesale', null, {
        title: 'Ghi cuộc gọi',
        defaults: { ngay: UI.nowLocal(), nhan_vien: App.currentUser(), khach_hang_id: khId || '', ten_kh: kh ? kh.ten : '', sdt: kh ? kh.sdt : '' },
        beforeSave(d) { if (d.khach_hang_id && !d.sdt) d.sdt = (Store.get('KhachHang', d.khach_hang_id) || {}).sdt || ''; },
        onSaved(row) { if (row.khach_hang_id) Store.log('Cuộc gọi', 'KhachHang', row.khach_hang_id, `Gọi điện: ${row.ket_qua}${row.ghi_chu ? ' — ' + row.ghi_chu : ''}`); },
      });
    },
    actions: {
      tab(ds) { App.st('telesale', {}).tab = ds.tab; App.render(); },
      pick(ds) { if (!ds.id) return; Object.assign(App.st('telesale', {}), { sel: ds.id, kq: '' }); App.render(); },
      kq(ds) { App.st('telesale', {}).kq = ds.v; document.querySelectorAll('[data-act="kq"]').forEach(b => b.classList.toggle('on', b.dataset.v === ds.v)); },
      'open-kh'(ds) { App.st('khach-hang', {}).sel = ds.id; location.hash = '#/khach-hang'; },
      'new-call'() { Telesale.quickForm(App.st('telesale', {}).sel); },
      'edit-call'(ds) { openForm('Telesale', Store.get('Telesale', ds.id)); },
      async 'save-call'(ds) {
        const s = App.st('telesale', {});
        if (!s.kq) return toast('Chọn kết quả cuộc gọi', true);
        const k = Store.get('KhachHang', ds.id);
        const row = {
          ngay: UI.nowLocal(), nhan_vien: App.currentUser(), khach_hang_id: k.id, ten_kh: k.ten, sdt: k.sdt, ket_qua: s.kq,
          thoi_luong_phut: num(document.getElementById('c-min').value), hen_goi_lai: document.getElementById('c-cb').value, ghi_chu: document.getElementById('c-note').value.trim(),
        };
        try {
          await Store.create('Telesale', row);
          Store.log('Cuộc gọi', 'KhachHang', k.id, `Gọi điện: ${row.ket_qua}${row.ghi_chu ? ' — ' + row.ghi_chu : ''}`, row.nhan_vien);
          s.kq = '';
          toast('Đã lưu cuộc gọi');
          if (['Hẹn gặp', 'Chốt đơn'].includes(row.ket_qua) && confirm('Tạo cơ hội bán hàng cho khách này?')) Pipeline.actions.new({ khach_hang_id: k.id, ten: 'Cơ hội từ Telesale', giai_doan: row.ket_qua === 'Chốt đơn' ? 'Thắng' : 'Đủ điều kiện', nvkd: k.nvkd });
          App.render();
        } catch (err) { toast('Lỗi: ' + err.message, true); }
      },
    },
  };

  /* ========================================================= */
  /* THU THẬP THỊ TRƯỜNG                                        */
  /* ========================================================= */
  const Market = {
    render() {
      const s = App.st('thi-truong', { loai: '', tinh: '', nvkd: '', q: '' });
      const all = D().ThiTruong;
      const rows = all.filter(t => (!s.loai || t.loai_thong_tin === s.loai) && (!s.tinh || t.tinh === s.tinh) && (!s.nvkd || t.nvkd === s.nvkd) &&
        search(s.q, t.noi_dung, t.doi_thu, t.san_pham, t.khu_vuc)).sort((a, b) => toDate(b.ngay) - toDate(a.ngay));
      const d30 = all.filter(t => toDate(t.ngay) >= Date.now() - 30 * 864e5);
      return head('', 'Thu thập thị trường', '',
        `<button class="btn" data-act="export">Xuất CSV</button><button class="btn btn-primary" data-act="new">${icon('plus', 15)} Ghi nhận thông tin</button>`) +
        `<div class="kpis">${kpi('Tin 30 ngày', d30.length, `${d30.filter(t => t.muc_do === 'Cao').length} quan trọng`)}
          ${['Đối thủ', 'Giá bán', 'Khách hàng mới', 'Nhu cầu thị trường'].map(l => kpi(l, d30.filter(t => t.loai_thong_tin === l).length, '30 ngày', '', 'f-' + OPT.loaiTT.indexOf(l))).join('')}</div>
        <div class="filters">
          <div class="field search"><label>Tìm kiếm</label><input class="input" data-filter="q" value="${esc(s.q)}" placeholder="Nội dung, đối thủ, sản phẩm…"></div>
          ${selectHtml('loai', 'Loại thông tin', OPT.loaiTT, s.loai)}
          ${selectHtml('tinh', 'Tỉnh/TP', uniq(all.map(t => t.tinh)), s.tinh)}
          ${selectHtml('nvkd', 'Người thu thập', uniq(all.map(t => t.nvkd)), s.nvkd)}
        </div>
        <div class="grid-3">
          <div class="card">${rows.map(t => `<div class="feed-item" data-act="edit" data-id="${esc(t.id)}" style="cursor:pointer">
            <div class="top">${badge(t.loai_thong_tin)} ${t.muc_do ? badge(t.muc_do) : ''} <b>${esc(t.tinh)}</b>${t.khu_vuc ? ' · ' + esc(t.khu_vuc) : ''}</div>
            <div class="body">${esc(t.noi_dung)}</div>
            <div class="foot"><span>${staff(t.nvkd)}</span><span>${fmt.date(t.ngay)}</span>${t.doi_thu ? `<span>Đối thủ: <b>${esc(t.doi_thu)}</b></span>` : ''}${t.san_pham ? `<span>SP: ${esc(t.san_pham)}</span>` : ''}${t.gia ? `<span>Giá: <b>${fmt.money(t.gia)}</b></span>` : ''}${t.link_anh ? `<a href="${esc(t.link_anh)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Ảnh</a>` : ''}</div>
          </div>`).join('') || '<div class="empty">Chưa có thông tin phù hợp.</div>'}</div>
          <div style="display:flex;flex-direction:column;gap:14px">
            <div class="card"><div class="card-head"><h3>Theo tỉnh/TP (30 ngày)</h3></div><div class="card-body">${bars(uniq(d30.map(t => t.tinh)).map(p => ({ label: p, value: d30.filter(t => t.tinh === p).length })).sort((a, b) => b.value - a.value).slice(0, 8), v => v + ' tin')}</div></div>
            <div class="card"><div class="card-head"><h3>Theo người thu thập (30 ngày)</h3></div><div class="card-body">${bars(uniq(d30.map(t => t.nvkd)).map(p => ({ label: p, value: d30.filter(t => t.nvkd === p).length, color: 'var(--accent)' })).sort((a, b) => b.value - a.value), v => v + ' tin')}</div></div>
          </div>
        </div>`;
    },
    actions: {
      new() { openForm('ThiTruong', null, { defaults: { ngay: today(), nvkd: App.currentUser(), muc_do: 'Trung bình' } }); },
      edit(ds) { openForm('ThiTruong', Store.get('ThiTruong', ds.id)); },
      export() { exportCsv('thi-truong.csv', ENTITIES.ThiTruong.fields, D().ThiTruong); },
      ...Object.fromEntries(OPT.loaiTT.map((l, i) => ['f-' + i, () => { App.st('thi-truong', {}).loai = l; App.render(); }])),
    },
  };

  /* ========================================================= */
  /* KẾ HOẠCH THỊ TRƯỜNG                                        */
  /* ========================================================= */
  const Plan = {
    render() {
      const s = App.st('ke-hoach', { thang: thisMonth(), nvkd: '' });
      const rows = D().KeHoach.filter(p => String(p.thang).slice(0, 7) === s.thang && (!s.nvkd || p.nvkd === s.nvkd));
      const sum = k => rows.reduce((a, p) => a + num(p[k]), 0);
      const crmNew = nv => D().KhachHang.filter(k => k.nvkd === nv && inMonth(k.ngay_tao, s.thang)).length;
      const crmWon = nv => D().CoHoi.filter(c => c.nvkd === nv && c.giai_doan === 'Thắng' && inMonth(c.ngay_cap_nhat, s.thang)).reduce((a, c) => a + num(c.gia_tri), 0);
      const crmMarket = nv => D().ThiTruong.filter(t => t.nvkd === nv && inMonth(t.ngay, s.thang)).length;
      return head('', 'Kế hoạch thị trường', '',
        `<button class="btn" data-act="copy">Sao chép từ tháng trước</button><button class="btn btn-primary" data-act="new">${icon('plus', 15)} Lập kế hoạch</button>`) +
        `<div class="filters"><div class="field"><label>Tháng</label><input class="input" type="month" data-filter="thang" value="${esc(s.thang)}"></div>
          ${selectHtml('nvkd', 'NVKD', salesNames(), s.nvkd)}</div>
        <div class="kpis">
          ${kpi('Mục tiêu doanh số', fmt.short(sum('muc_tieu_doanh_so')))}
          ${kpi('Thực hiện doanh số', fmt.short(sum('thuc_hien_doanh_so')), sum('muc_tieu_doanh_so') ? Math.round(sum('thuc_hien_doanh_so') / sum('muc_tieu_doanh_so') * 100) + '% mục tiêu' : '', 'good')}
          ${kpi('KH mới', `${sum('thuc_hien_kh_moi')} / ${sum('muc_tieu_kh_moi')}`)}
          ${kpi('Lượt viếng thăm', fmt.int(sum('so_luot_tham')))}
        </div>
        <div class="table-wrap"><table><thead><tr><th>NVKD</th><th>Khu vực</th><th>Doanh số (TH / MT)</th><th style="width:180px">Tiến độ DS</th><th>KH mới</th><th style="width:150px">Tiến độ KH</th><th class="num">Lượt thăm</th><th>Trạng thái</th><th>Hệ thống ghi nhận</th></tr></thead><tbody>
          ${rows.map(p => `<tr class="clickable" data-act="edit" data-id="${esc(p.id)}">
            <td>${staff(p.nvkd)}</td><td><div>${esc(p.tinh)}</div><div class="small muted">${esc(p.khu_vuc)}</div></td>
            <td>${fmt.short(p.thuc_hien_doanh_so)} / ${fmt.short(p.muc_tieu_doanh_so)}</td><td>${progress(num(p.thuc_hien_doanh_so), num(p.muc_tieu_doanh_so))}</td>
            <td>${num(p.thuc_hien_kh_moi)} / ${num(p.muc_tieu_kh_moi)}</td><td>${progress(num(p.thuc_hien_kh_moi), num(p.muc_tieu_kh_moi))}</td>
            <td class="num">${num(p.so_luot_tham)}</td><td>${badge(p.trang_thai)}</td>
            <td class="small muted">KH mới: ${crmNew(p.nvkd)} · Thắng: ${fmt.short(crmWon(p.nvkd))} · Tin TT: ${crmMarket(p.nvkd)}</td></tr>`).join('')}
        </tbody></table>${rows.length ? '' : '<div class="empty">Chưa có kế hoạch cho tháng này. Bấm "Lập kế hoạch" hoặc "Sao chép từ tháng trước".</div>'}</div>
        ${rows.length ? `<div class="section-title">Hoạt động dự kiến</div><div class="card">${rows.filter(p => p.hoat_dong).map(p => `<div class="feed-item"><div class="top">${staff(p.nvkd)} <span class="muted small">${esc(p.tinh)} ${esc(p.khu_vuc)}</span></div><div class="body">${esc(p.hoat_dong)}</div></div>`).join('') || '<div class="empty">Chưa nhập hoạt động.</div>'}</div>` : ''}
        <p class="small muted mt">"Hệ thống ghi nhận" là số liệu CRM tự đếm trong tháng (KH tạo mới, cơ hội thắng, tin thị trường) để đối chiếu với số NVKD tự báo cáo.</p>`;
    },
    actions: {
      new() { const s = App.st('ke-hoach', {}); openForm('KeHoach', null, { defaults: { thang: s.thang, nvkd: s.nvkd || App.currentUser(), trang_thai: 'Nháp' } }); },
      edit(ds) { openForm('KeHoach', Store.get('KeHoach', ds.id)); },
      async copy() {
        const s = App.st('ke-hoach', {});
        const [y, mo] = s.thang.split('-').map(Number);
        const prev = new Date(y, mo - 2, 1); const pm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
        const src = D().KeHoach.filter(p => String(p.thang).slice(0, 7) === pm);
        if (!src.length) return toast(`Tháng ${pm} không có kế hoạch để sao chép`, true);
        if (!confirm(`Sao chép ${src.length} kế hoạch từ ${pm} sang ${s.thang}? (số thực hiện sẽ để trống)`)) return;
        try {
          for (const p of src) await Store.create('KeHoach', { thang: s.thang, nvkd: p.nvkd, tinh: p.tinh, khu_vuc: p.khu_vuc, muc_tieu_doanh_so: p.muc_tieu_doanh_so, muc_tieu_kh_moi: p.muc_tieu_kh_moi, hoat_dong: p.hoat_dong, trang_thai: 'Nháp', thuc_hien_doanh_so: 0, thuc_hien_kh_moi: 0, so_luot_tham: 0 });
          toast('Đã sao chép'); App.render();
        } catch (err) { toast('Lỗi: ' + err.message, true); }
      },
    },
  };

  /* ========================================================= */
  /* NHÂN VIÊN                                                  */
  /* ========================================================= */
  const Staff = {
    render() {
      const rows = D().NhanVien;
      return head('Thiết lập', 'Nhân viên', 'Danh sách dùng cho các ô "NVKD phụ trách", "Nhân viên gọi"…',
        `<button class="btn btn-primary" data-act="new">${icon('plus', 15)} Thêm nhân viên</button>`) +
        `<div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Email</th><th>SĐT</th><th>Nhóm KD</th><th>Vai trò</th><th class="num">Khách hàng</th><th class="num">Cơ hội mở</th><th>Trạng thái</th></tr></thead><tbody>
        ${rows.map(n => `<tr class="clickable" data-act="edit" data-id="${esc(n.id)}"><td>${staff(n.ten)}</td><td>${esc(n.email)}</td><td>${esc(n.sdt)}</td><td>${esc(n.nhom_kd)}</td><td>${esc(n.vai_tro)}</td>
          <td class="num">${D().KhachHang.filter(k => k.nvkd === n.ten).length}</td><td class="num">${D().CoHoi.filter(c => c.nvkd === n.ten && isOpen(c)).length}</td><td>${badge(n.trang_thai)}</td></tr>`).join('')}
        </tbody></table></div>`;
    },
    actions: {
      new() { openForm('NhanVien', null, { defaults: { trang_thai: 'Đang làm', vai_tro: 'NVKD' } }); },
      edit(ds) { openForm('NhanVien', Store.get('NhanVien', ds.id)); },
    },
  };

  /* ---------------- Xuất CSV (mở được bằng Excel) ---------------- */
  function exportCsv(name, fields, rows) {
    const cols = fields.map(f => f.key);
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿' + [fields.map(f => q(f.label)).join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const VIEWS = { 'tong-quan': Dashboard, 'khach-hang': Customers, pipeline: Pipeline, telesale: Telesale, 'thi-truong': Market, 'ke-hoach': Plan, 'nhan-vien': Staff };
  window.App = App;
  App.start();
})();
