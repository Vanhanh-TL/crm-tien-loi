/* Ứng dụng CRM: router + các màn hình */
(function () {
  const { esc, num, fmt, toDate, today, thisMonth, sameDay, avatar, staff, badge, progress, icon, toast, openForm, selectHtml, uniq } = UI;
  const D = () => Store.data;

  const NAV = [
    { group: 'Tổng quan', items: [{ id: 'tong-quan', label: 'Tổng quan CRM', icon: 'home' }] },
    { group: 'Khách hàng', items: [{ id: 'khach-hang', label: 'Khách hàng', icon: 'users', count: () => D().KhachHang.length }] },
    { group: 'Bán hàng', items: [
      { id: 'muc-tieu', label: 'Mục tiêu sản lượng', icon: 'chart' },
      { id: 'pipeline', label: 'Pipeline bán hàng', icon: 'target', count: () => D().CoHoi.filter(isOpen).length },
      { id: 'telesale', label: 'Telesale', icon: 'phone', count: () => callbackQueue().length || '' },
    ] },
    { group: 'Thị trường', items: [
      { id: 'thi-truong', label: 'Thu thập thị trường', icon: 'radar' },
      { id: 'ke-hoach', label: 'Kế hoạch thị trường', icon: 'calendar' },
    ] },
    { group: 'Thiết lập', items: [{ id: 'nhan-vien', label: 'Nhân viên', icon: 'user' }, { id: 'sku', label: 'Danh mục SKU', icon: 'box' }] },
  ];

  const App = {
    ui: {},
    route: 'tong-quan',
    currentUser() {
      if (Store.me) return Store.me.ten || Store.me.email;
      try { return localStorage.getItem('crm-user') || ''; } catch (e) { return ''; }
    },
    st(view, defaults) { return (this.ui[view] = this.ui[view] || { ...defaults }); },

    async start() {
      document.getElementById('app').innerHTML = '<div class="loading">Đang tải dữ liệu…</div>';
      await Store.init();
      if (Store.mode === 'login') return renderLogin();
      if (!this.currentUser() && D().NhanVien[0]) try { localStorage.setItem('crm-user', D().NhanVien[0].ten); } catch (e) { }
      window.addEventListener('hashchange', () => this.render());
      window.matchMedia('(max-width: 860px)').addEventListener('change', () => { if (!document.querySelector('.modal')) this.render(); });
      // Đang hiện dữ liệu lần trước → khi tải xong dữ liệu mới thì vẽ lại
      if (Store.pending) Store.pending.then(r => {
        if (r === 'login') return renderLogin();
        if (r === 'offline') toast('Chưa kết nối được Google Sheet — đang hiện dữ liệu lần trước', true);
        if (!document.querySelector('.modal')) this.render(); else this._staleUi = true;
      });
      window.addEventListener('beforeunload', e => { if (Targets.dirtyCount()) { e.preventDefault(); e.returnValue = ''; } });
      this.render();
    },

    render() {
      syncCustomerGroups();
      this.route = (location.hash.replace(/^#\/?/, '') || 'tong-quan').split('?')[0];
      const view = VIEWS[this.route] || VIEWS['tong-quan'];
      const active = document.activeElement;
      const focusKey = active && active.dataset && active.dataset.filter;
      const caret = focusKey && active.selectionStart;
      const scroll = document.querySelector('.main')?.scrollTop || 0;

      document.getElementById('app').innerHTML = `<div class="app">${sidebar()}<div class="main">
        <div class="topbar-mobile"><button class="btn btn-sm" data-act="menu">${icon('menu')}</button>CRM TIẾN LỢI</div>
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

  const isMobile = () => window.matchMedia('(max-width: 860px)').matches;

  /* Nhóm KD của khách hàng luôn theo nhóm KD của NVKD phụ trách (bảng Nhân viên); NVKD chưa có nhóm thì giữ giá trị cũ */
  function syncCustomerGroups() {
    D().KhachHang.forEach(k => { const g = UI.staffGroup(k.nvkd); if (g) k.nhom_kd = g; });
  }

  function sidebar() {
    const me = App.currentUser();
    return `<aside class="sidebar">
      <div class="brand"><div class="brand-logo">TL</div>CRM TIẾN LỢI<button class="btn btn-ghost btn-sm sidebar-close" data-act="menu-close" title="Thu gọn menu">${icon('x')}</button></div>
      ${NAV.map(g => `<div class="nav-group"><div class="nav-title">${g.group}</div>
        ${g.items.map(i => `<a class="nav-item ${App.route === i.id ? 'active' : ''}" href="#/${i.id}">${icon(i.icon)}${i.label}${i.count ? `<span class="count">${i.count()}</span>` : ''}</a>`).join('')}</div>`).join('')}
      <div class="sidebar-foot">
        ${Store.me ? `<div class="who" style="margin-bottom:10px">${avatar(me)}<div style="min-width:0"><div class="name" style="overflow:hidden;text-overflow:ellipsis">${esc(me)}</div>${Store.me.ten ? `<div class="meta" style="overflow:hidden;text-overflow:ellipsis">${esc(Store.me.email)}</div>` : ''}</div></div>
          <button class="btn btn-sm" data-act="logout" style="width:100%;justify-content:center;margin-bottom:10px">Đăng xuất</button>` :
        `<div class="field" style="min-width:0;margin-bottom:10px"><label>Bạn là</label>
          <select class="input" data-act="me">${D().NhanVien.map(n => `<option ${n.ten === me ? 'selected' : ''}>${esc(n.ten)}</option>`).join('')}</select></div>`}
        <div class="between"><span class="mode-pill ${Store.mode}" title="${Store.timing ? `Lần tải gần nhất: ${(Store.timing.google_ms / 1000).toFixed(1)} giây chờ Google Sheet (Apps Script xử lý ${((Store.timing.script_ms || 0) / 1000).toFixed(1)} giây)` : ''}">${Store.mode === 'live' ? (Store.syncing ? 'Đang cập nhật…' : 'Google Sheet') : 'Chế độ demo'}</span>
        ${Store.mode === 'demo' ? '<button class="btn btn-sm btn-ghost" data-act="reset-demo" title="Xóa dữ liệu demo và tạo lại">Làm mới</button>' : '<button class="btn btn-sm btn-ghost" data-act="reload">Tải lại</button>'}</div>
      </div></aside><div class="sidebar-backdrop" data-act="menu-close"></div>`;
  }

  function bindCommon(view) {
    const root = document.getElementById('app');
    root.querySelectorAll('[data-filter]').forEach(el => {
      const ev = el.tagName === 'INPUT' && el.type !== 'month' ? 'input' : 'change';
      el.addEventListener(ev, () => { App.st(App.route)[el.dataset.filter] = el.value; App.render(); });
    });
    root.querySelector('[data-act="me"]')?.addEventListener('change', e => { try { localStorage.setItem('crm-user', e.target.value); } catch (x) { } App.render(); });
    root.onclick = async e => {
      const el = e.target.closest('[data-act]');
      if (!el || el.tagName === 'SELECT') return;
      const act = el.dataset.act;
      if (act === 'menu') return document.querySelector('.sidebar').classList.toggle('open');
      if (act === 'menu-close') return document.querySelector('.sidebar').classList.remove('open');
      if (act === 'reset-demo') { if (confirm('Xóa dữ liệu demo đã nhập và tạo lại dữ liệu mẫu?')) Store.resetDemo(); return; }
      if (act === 'reload') { await Store.reload(); App.render(); return toast('Đã tải lại dữ liệu'); }
      if (act === 'logout') { if (confirm('Đăng xuất khỏi CRM?')) Store.logout(); return; }
      view.actions && view.actions[act] && view.actions[act](el.dataset, e);
    };
  }

  /* ---------------- Màn hình đăng nhập (OTP qua email) ---------------- */
  function renderLogin() {
    const root = document.getElementById('app');
    let email = '';
    const step1 = (err = Store.loginError) => {
      root.innerHTML = `<div class="login-wrap"><form class="login-card" id="lf">
        <div class="brand" style="padding:0 0 6px"><div class="brand-logo">TL</div>CRM TIẾN LỢI</div>
        <h2>Đăng nhập</h2><p class="muted small">Nhập email công ty, hệ thống sẽ gửi mã 6 số vào hộp thư của bạn.</p>
        <div class="field"><label>Email</label><input class="input" id="l-email" type="email" autocomplete="email" placeholder="ten@tienloigroup.vn" value="${esc(email)}" required></div>
        ${err ? `<div class="login-err">${esc(err)}</div>` : ''}
        <button class="btn btn-primary" id="l-btn" type="submit">Gửi mã đăng nhập</button></form></div>`;
      const f = document.getElementById('lf'), btn = document.getElementById('l-btn');
      document.getElementById('l-email').focus();
      f.onsubmit = async e => {
        e.preventDefault();
        email = document.getElementById('l-email').value.trim().toLowerCase();
        if (!email) return;
        btn.disabled = true; btn.textContent = 'Đang gửi mã…';
        const res = await Store.requestOtp(email).catch(err => ({ ok: false, error: err.message }));
        res.ok ? step2() : step1(res.error);
      };
    };
    const step2 = (err = '') => {
      root.innerHTML = `<div class="login-wrap"><form class="login-card" id="lf">
        <div class="brand" style="padding:0 0 6px"><div class="brand-logo">TL</div>CRM TIẾN LỢI</div>
        <h2>Nhập mã</h2><p class="muted small">Đã gửi mã tới <b>${esc(email)}</b>. Kiểm tra cả thư mục Spam / Quảng cáo.</p>
        <div class="field"><label>Mã 6 số</label><input class="input otp" id="l-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>
        ${err ? `<div class="login-err">${esc(err)}</div>` : ''}
        <button class="btn btn-primary" id="l-btn" type="submit">Đăng nhập</button>
        <button class="btn btn-ghost btn-sm" id="l-back" type="button">← Đổi email / gửi lại mã</button></form></div>`;
      const btn = document.getElementById('l-btn');
      document.getElementById('l-code').focus();
      document.getElementById('l-back').onclick = () => step1('');
      document.getElementById('lf').onsubmit = async e => {
        e.preventDefault();
        btn.disabled = true; btn.textContent = 'Đang kiểm tra…';
        const res = await Store.verifyOtp(email, document.getElementById('l-code').value).catch(err => ({ ok: false, error: err.message }));
        if (res.ok) { root.innerHTML = '<div class="loading">Đang tải dữ liệu…</div>'; location.reload(); }
        else step2(res.error);
      };
    };
    step1();
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
      return head('Bán hàng', 'Pipeline', '',
        `<button class="btn btn-primary" data-act="new">${icon('plus', 15)} Thêm cơ hội</button>`) +
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

      return head('Bán hàng', 'Telesale', 'Chọn khách → gọi → ghi kết quả. Hẹn gọi lại sẽ tự vào hàng đợi.',
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
      return head('Thị trường', 'Thu thập thị trường', 'Thông tin đối thủ, giá bán, nhu cầu, khách hàng mới do NVKD ghi nhận',
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
      return head('Thị trường', 'Kế hoạch thị trường', 'Mục tiêu theo tháng cho từng NVKD / khu vực, so với thực hiện',
        `<button class="btn" data-act="copy">Sao chép từ tháng trước</button><button class="btn btn-primary" data-act="new">${icon('plus', 15)} Lập kế hoạch</button>`) +
        `<div class="filters"><div class="field"><label>Tháng</label><select class="input" data-filter="thang">${UI.monthOptions(s.thang)}</select></div>
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
  /* MỤC TIÊU SẢN LƯỢNG - tấn (theo khách hàng, có phân quyền) */
  /* Quyền thật được kiểm tra ở Apps Script; phần dưới chỉ để   */
  /* hiển thị đúng danh sách cho người đang dùng.               */
  /* ========================================================= */
  const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  function myStaff() {
    const list = D().NhanVien.filter(n => n.trang_thai !== 'Nghỉ việc');
    if (Store.me) return list.find(n => same(n.email, Store.me.email)) || null;
    return list.find(n => n.ten === App.currentUser()) || null;
  }
  /* Tự chẩn đoán vì sao dữ liệu không hiện: Apps Script chưa cập nhật, hoặc tab trong Sheet sai tên cột */
  const REQUIRED_COLS = { SKU: ['ma_sku', 'ten_sku', 'nhom'], MucTieuSKU: ['nam', 'ma_kh', 'ma_sku'], MucTieu: ['nam', 'ma_kh'], KhachHang: ['ma_kh', 'ten', 'nvkd'] };
  function dataIssues(tables) {
    if (Store.mode !== 'live') return '';
    const out = [];
    const miss = (Store.missing || []).filter(t => tables.includes(t));
    if (miss.length) out.push(`Máy chủ Apps Script đang chạy <b>bản Code.gs cũ</b> nên chưa đọc được bảng <b>${miss.join(', ')}</b>. Cách sửa: dán Code.gs mới → <b>Deploy → Manage deployments → ✏️ → Version: New version → Deploy</b> (không chọn "New deployment"), rồi bấm Tải lại.`);
    tables.forEach(t => {
      const rows = D()[t] || [], need = REQUIRED_COLS[t];
      if (!need || !rows.length) return;
      const lack = need.filter(c => !(c in rows[0]));
      if (lack.length) out.push(`Tab <b>${t}</b> trong Google Sheet thiếu cột <b>${lack.join(', ')}</b> ở dòng 1 (có thể đang dùng tên cột khác như "Mã SKU"). Tên cột phải viết đúng như mẫu: ${need.map(c => `<code>${c}</code>`).join(', ')}.`);
    });
    // Dòng mục tiêu SKU có nhưng không hiện trong popup: sai năm, hoặc mã KH không khớp
    if (tables.includes('MucTieuSKU') && !miss.includes('MucTieuSKU')) {
      const nam = String(App.st('muc-tieu', {}).nam || new Date().getFullYear() + 1);
      const T = D().MucTieuSKU || [];
      if (!T.length) out.push(`CRM chưa nhận được dòng nào từ tab <b>MucTieuSKU</b> (với quyền của tài khoản này). Kiểm tra: tên tab đúng <code>MucTieuSKU</code>, dữ liệu bắt đầu từ dòng 2, cột <code>ma_kh</code> khớp mã khách, và <b>NVKD phụ trách</b> của khách đúng tên bạn (hoặc bạn là Quản lý).`);
      const other = {};
      T.forEach(x => { const y = String(x.nam || '').trim(); if (y !== nam && y !== String(Number(nam) - 1)) other[y || '(trống)'] = (other[y || '(trống)'] || 0) + 1; });
      Object.keys(other).forEach(y => out.push(`${other[y]} dòng SKU có cột <code>nam</code> = <b>${esc(y)}</b>, trong khi trang đang xem <b>năm mục tiêu ${nam}</b> nên không hiện. Cột <code>nam</code> là năm MỤC TIÊU: sản lượng 2026 thì ghi <code>nam</code> = <b>${Number(new Date().getFullYear()) + 1}</b>, số tấn 2026 để ở cột <code>sl_nam_truoc</code>.${/^\d{4}$/.test(y) ? ` (Hoặc chọn "Năm ${esc(y)}" ở bộ lọc Năm mục tiêu.)` : ''}`));
      const kh = D().KhachHang;
      const lost = T.filter(x => !kh.some(k => String(k.id) === String(x.khach_hang_id) || (x.ma_kh && same(k.ma_kh, x.ma_kh))));
      if (lost.length) out.push(`${lost.length} dòng SKU có mã KH không khớp khách hàng nào (vd: ${lost.slice(0, 3).map(x => `<code>${esc(x.ma_kh || '(trống)')}</code>`).join(', ')}). Mã trong tab MucTieuSKU phải trùng cột <code>ma_kh</code> của tab KhachHang.`);
    }
    return out.length ? `<div class="data-warn"><b>Dữ liệu chưa hiển thị đầy đủ</b><ul>${out.map(x => `<li>${x}</li>`).join('')}</ul></div>` : '';
  }
  const isManager = me => !!me && (same(me.vai_tro, 'Quản lý') || same(me.vai_tro, 'Admin'));   // Admin = toàn quyền
  const isLeader = me => !!me && same(me.vai_tro, 'Trưởng nhóm');
  const canSeeKh = (me, k) => !!me && (isManager(me) || same(k.nvkd, me.ten) || (isLeader(me) && !!me.nhom_kd && same(k.nhom_kd, me.nhom_kd)));

  const MT_GROUPS = [['mau', 'Mạ màu', 'sl_ma_mau', 'mt_ma_mau'], ['kem', 'Mạ kẽm + Mạ lạnh', 'sl_kem_lanh', 'mt_kem_lanh']];
  const DV = OPT.dvSanLuong || 'tấn';
  const fmtDS = v => num(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' ' + DV;
  const qtyInput = v => (v === '' || v == null ? '' : num(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 }));
  /* Nhóm SKU → 'mau' | 'kem'; SKU chưa có nhóm (chưa có trong danh mục) → '' (không cộng vào nhóm nào) */
  const groupOf = nhom => (!String(nhom || '').trim() ? '' : /màu/i.test(String(nhom)) ? 'mau' : 'kem');
  const growth = (mt, ds) => {
    mt = num(mt); ds = num(ds);
    if (!mt) return '<span class="muted">—</span>';
    if (!ds) return '<span class="badge b-blue">Mới</span>';
    const p = Math.round((mt / ds - 1) * 100);
    return `<span class="growth ${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '+' : ''}${p}%</span>`;
  };
  /* Các dòng mục tiêu SKU của 1 KH trong năm (khớp theo id hoặc mã KH) */
  /* SKU của 1 KH cho năm mục tiêu `nam`:
     - dòng có nam = năm mục tiêu (SL năm trước + MT);
     - dòng dán với nam = năm trước (vd 2026) chỉ có sản lượng, chưa có MT → coi là SL năm trước của SKU đó. */
  const skuRowsOf = (k, nam) => {
    const mine = x => String(x.khach_hang_id) === String(k.id) || (x.ma_kh && same(x.ma_kh, k.ma_kh));
    const prevY = String(Number(nam) - 1);
    const all = D().MucTieuSKU.filter(mine);
    const cur = all.filter(x => String(x.nam).trim() === String(nam));
    const prev = all.filter(x => String(x.nam).trim() === prevY && num(x.sl_nam_truoc) > 0 && !num(x.mt));
    // Mỗi SKU chỉ 1 dòng: khóa = mã SKU (dòng dán tay chỉ có tên thì dùng tên); ưu tiên dòng năm mục tiêu có MT
    const key = x => String(x.ma_sku || x.ten_sku || '').trim().toLowerCase();
    const out = new Map();
    cur.slice().sort((a, b) => num(b.mt) - num(a.mt)).forEach(c => { if (!out.has(key(c))) out.set(key(c), { ...c }); });
    prev.forEach(p => {
      const c = out.get(key(p));
      if (!c) out.set(key(p), { ...p, nam: String(nam), mt: '' });
      else if (!num(c.sl_nam_truoc)) c.sl_nam_truoc = p.sl_nam_truoc;
    });
    return [...out.values()];
  };

  const Targets = {
    st() {
      const s = App.st('muc-tieu', { nam: String(new Date().getFullYear() + 1), nvkd: '', q: '', loc: '', edits: {}, collapsed: {} });
      if (s.editsNam !== s.nam) { s.edits = {}; s.editsNam = s.nam; }
      return s;
    },
    dirtyCount() { const s = App.ui['muc-tieu']; return s ? Object.keys(s.edits || {}).length : 0; },
    /* Giá trị 1 ô. MT nhóm = tổng MT theo SKU nếu KH đã đặt mục tiêu SKU cho nhóm đó; còn lại ưu tiên số đang sửa */
    val(r, key) {
      const g = MT_GROUPS.find(x => x[3] === key);
      if (g && r.skuMt[g[0]] !== null) return r.skuMt[g[0]];
      const e = this.st().edits[r.k.id];
      return e && e[key] !== undefined ? UI.parseQty(e[key]) : num(r.t && r.t[key]);
    },
    rows(me) {
      const s = this.st();
      const T = D().MucTieu;
      return D().KhachHang.filter(k => canSeeKh(me, k) && (!s.nvkd || k.nvkd === s.nvkd) && search(s.q, k.ten, k.ma_kh))
        .map(k => {
          const skus = skuRowsOf(k, s.nam);
          const skuMt = { mau: null, kem: null };
          skus.forEach(x => { const g = groupOf(x.nhom_sp); if (g && num(x.mt) > 0) skuMt[g] = (skuMt[g] || 0) + num(x.mt); });
          return { k, skus, skuMt, nReg: skus.filter(x => num(x.mt) > 0).length, skuTotal: skus.reduce((a, x) => a + num(x.mt), 0),
            t: T.find(t => String(t.nam) === s.nam && (String(t.khach_hang_id) === String(k.id) || (t.ma_kh && same(t.ma_kh, k.ma_kh)))) || null };
        })
        .filter(r => { const has = this.val(r, 'mt_ma_mau') || this.val(r, 'mt_kem_lanh'); return !s.loc || (s.loc === 'chua' ? !has : has); })
        .sort((a, b) => String(a.k.nvkd || '').localeCompare(String(b.k.nvkd || ''), 'vi') ||
          (num(b.t?.sl_ma_mau) + num(b.t?.sl_kem_lanh)) - (num(a.t?.sl_ma_mau) + num(a.t?.sl_kem_lanh)) || String(a.k.ten).localeCompare(b.k.ten, 'vi'));
    },
    render() {
      const s = this.st();
      const me = myStaff();
      const nam = Number(s.nam), prev = nam - 1;
      const head0 = head('Bán hàng', `Mục tiêu sản lượng ${nam}`, `So với sản lượng thực hiện ${prev} theo từng khách hàng · đơn vị: ${esc(DV)}`,
        `<button class="btn" data-act="export">Xuất CSV</button><button class="btn" data-act="export-sku">CSV theo SKU</button><button class="btn btn-primary" data-act="save" id="mt-save" ${this.dirtyCount() ? '' : 'disabled'}>Lưu mục tiêu${this.dirtyCount() ? ` (${this.dirtyCount()})` : ''}</button>`);
      this._rows = null;
      const warn = dataIssues(['SKU', 'MucTieuSKU', 'MucTieu', 'KhachHang']);
      if (!me) return head0 + warn + `<div class="card"><div class="empty">Tài khoản ${Store.me ? `<b>${esc(Store.me.email)}</b>` : 'này'} chưa có trong danh sách <b>Nhân viên</b> nên chưa được giao khách hàng nào.<br>Liên hệ Quản lý để được thêm (đúng email, vai trò, nhóm KD).</div></div>`;

      const rows = this._rows = this.rows(me);
      const groups = this._groups = uniq(rows.map(r => r.k.nvkd || '(Chưa giao NVKD)')).map(name => ({ name, rows: rows.filter(r => (r.k.nvkd || '(Chưa giao NVKD)') === name) }));
      const canDs = isManager(me);
      const visible = D().KhachHang.filter(k => canSeeKh(me, k));
      const scope = isManager(me) ? `${esc(me.vai_tro)} — xem và nhập cho tất cả khách hàng, nhập được cả sản lượng năm trước.`
        : isLeader(me) ? `Trưởng nhóm — khách hàng của bạn và của ${esc(me.nhom_kd || 'nhóm')}.`
        : `Khách hàng do <b>${esc(me.ten)}</b> phụ trách.`;
      const years = [nam - 2, nam - 1, nam, nam + 1].filter((y, i, a) => a.indexOf(y) === i);
      const NCOL = 10;
      const cell = (r, key, editable) => {
        const g = MT_GROUPS.find(x => x[3] === key);
        if (g && r.skuMt[g[0]] !== null) return `<span class="sku-locked" data-act="sku" data-id="${esc(r.k.id)}" title="Tổng mục tiêu các SKU ${esc(g[1])}. Sửa trong Mục tiêu SKU."><b>${esc(fmtDS(r.skuMt[g[0]]))}</b><span class="tag">SKU</span></span>`;
        const e = s.edits[r.k.id];
        const raw = e && e[key] !== undefined ? e[key] : (r.t && r.t[key] !== '' && r.t[key] != null ? qtyInput(r.t[key]) : '');
        return editable
          ? `<input class="input cell ${e && e[key] !== undefined ? 'dirty' : ''}" data-id="${esc(r.k.id)}" data-k="${key}" inputmode="decimal" value="${esc(raw)}" placeholder="Nhập…">`
          : `<span class="${raw ? '' : 'muted'}">${raw ? esc(fmtDS(num(r.t[key]))) : '—'}</span>`;
      };
      const skuCell = r => `<div class="sku-cell">
          ${r.skus.length ? `<button class="sku-chip ${r.nReg ? '' : 'empty'}" data-act="sku" data-id="${esc(r.k.id)}" title="Danh sách SKU của khách (SL năm trước + mục tiêu)">${r.skus.length} SKU${r.nReg ? ` · ${r.nReg} có MT` : ''}</button>` : ''}
          <button class="btn btn-sm sku-add" data-act="sku-add" data-id="${esc(r.k.id)}" title="Thêm mục tiêu theo SKU">${icon('plus', 14)}</button></div>`;
      const mob = isMobile();
      const totalCells = (pfx) => `${MT_GROUPS.map(([g, , ds, mt]) => `<td class="num" id="${pfx}-${ds}"></td><td class="num" id="${pfx}-${mt}"></td><td class="num" id="${pfx}-g-${g}"></td>`).join('')}<td id="${pfx}-sku"></td><td></td><td class="num" id="${pfx}-skumt"></td><td class="num" id="${pfx}-all"></td>`;

      return head0 + warn + `<div class="filters">
          <div class="field"><label>Năm mục tiêu</label><select class="input" data-filter="nam">${years.map(y => `<option value="${y}" ${String(y) === s.nam ? 'selected' : ''}>Năm ${y}</option>`).join('')}</select></div>
          <div class="field search"><label>Tìm khách hàng</label><input class="input" data-filter="q" value="${esc(s.q)}" placeholder="Tên, mã KH…"></div>
          ${isManager(me) || isLeader(me) ? selectHtml('nvkd', 'NVKD phụ trách', uniq(visible.map(k => k.nvkd)), s.nvkd) : ''}
          <div class="field"><label>Hiển thị</label><select class="input" data-filter="loc"><option value="">Tất cả</option><option value="chua" ${s.loc === 'chua' ? 'selected' : ''}>Chưa nhập mục tiêu</option><option value="co" ${s.loc === 'co' ? 'selected' : ''}>Đã nhập mục tiêu</option></select></div>
        </div>
        <div class="kpis kpis-target">${MT_GROUPS.map(([g, label]) => `<div class="kpi"><div class="label">${label} · mục tiêu ${nam}</div><div class="value" id="kpi-mt-${g}"></div><div class="hint" id="kpi-hint-${g}"></div></div>`).join('')}
          <div class="kpi"><div class="label">Tổng mục tiêu ${nam}</div><div class="value" id="kpi-mt-all"></div><div class="hint" id="kpi-hint-all"></div></div>
          <div class="kpi"><div class="label">Đã nhập mục tiêu</div><div class="value" id="kpi-done"></div><div class="hint" id="kpi-done-hint"></div></div></div>
        <div class="scope-note">${scope}${canDs ? '' : ` Sản lượng ${prev} do Quản lý cập nhật.`} Gõ số tấn (số lẻ dùng dấu phẩy, vd 12,5) rồi bấm <b>Lưu mục tiêu</b>. Bấm <b>+</b> ở cột <b>Mục tiêu SKU</b> để đặt mục tiêu chi tiết theo SKU — khi đó MT nhóm tự bằng tổng các SKU.</div>
        <div class="table-wrap">${mob ? this.mobileTable(groups, cell, skuCell, nam, prev, canDs) : `<table class="target-table"><thead>
          <tr><th rowspan="2">Khách hàng</th>${MT_GROUPS.map(([g, label]) => `<th colspan="3" class="grp grp-${g}">${label}</th>`).join('')}<th rowspan="2">Mục tiêu SKU</th><th rowspan="2">Ghi chú</th><th rowspan="2" class="num">Tổng MT SKU</th><th rowspan="2" class="num">Tổng MT ${nam}</th></tr>
          <tr>${MT_GROUPS.map(([g]) => `<th class="num grp-${g}">SL ${prev}</th><th class="num grp-${g}">MT ${nam}</th><th class="num grp-${g}">±</th>`).join('')}</tr>
        </thead>
        ${groups.map((G, gi) => { const closed = !!s.collapsed[G.name]; return `<tbody class="nv-group">
          <tr class="nv-row" data-act="toggle-nv" data-nv="${esc(G.name)}"><td><span class="chev ${closed ? 'closed' : ''}">${icon('chevron', 14)}</span>${staff(G.name)}<span class="muted small" style="margin-left:6px">${G.rows.length} KH</span></td>${totalCells('g' + gi)}</tr>
          ${closed ? '' : G.rows.map(r => `<tr data-row="${esc(r.k.id)}">
            <td><div class="name">${esc(r.k.ten)}</div><div class="meta muted small">${esc(r.k.ma_kh)}${r.k.tinh ? ' · ' + esc(r.k.tinh) : ''}</div></td>
            ${MT_GROUPS.map(([g, , ds, mt]) => `<td class="num">${cell(r, ds, canDs)}</td><td class="num">${cell(r, mt, true)}</td><td class="num" data-gid="${esc(r.k.id)}" data-g="${g}">${growth(this.val(r, mt), this.val(r, ds))}</td>`).join('')}
            <td>${skuCell(r)}</td>
            <td><input class="input cell note ${s.edits[r.k.id]?.ghi_chu !== undefined ? 'dirty' : ''}" data-id="${esc(r.k.id)}" data-k="ghi_chu" value="${esc(s.edits[r.k.id]?.ghi_chu ?? r.t?.ghi_chu ?? '')}" placeholder="…"></td>
            <td class="num">${r.nReg ? `<span class="sku-total" data-act="sku" data-id="${esc(r.k.id)}">${fmtDS(r.skuTotal)}</span>` : '<span class="muted">—</span>'}</td>
            <td class="num" data-gid="${esc(r.k.id)}" data-total><b>${fmtDS(this.val(r, 'mt_ma_mau') + this.val(r, 'mt_kem_lanh'))}</b></td>
          </tr>`).join('')}</tbody>`; }).join('')}
        </table>
`}        ${rows.length ? '' : `<div class="empty">${visible.length ? 'Không có khách hàng phù hợp bộ lọc.' : 'Bạn chưa được giao khách hàng nào (cột "NVKD phụ trách" ở trang Khách hàng).'}</div>`}</div>
        <span hidden data-ncol="${NCOL}"></span>`;
    },
    /* Điện thoại: mỗi khách 1 dòng (tên + tổng MT); bấm tên → mở ô sản lượng + nhập mục tiêu ngay bên dưới */
    mobileTable(groups, cell, skuCell, nam, prev, canDs) {
      const s = this.st();
      s.open = s.open || {};
      return `<table class="target-table m-table"><thead><tr><th>Khách hàng</th><th class="num">Tổng MT ${nam}</th></tr></thead>
        ${groups.map((G, gi) => { const closed = !!s.collapsed[G.name]; return `<tbody class="nv-group">
          <tr class="nv-row" data-act="toggle-nv" data-nv="${esc(G.name)}"><td><span class="chev ${closed ? 'closed' : ''}">${icon('chevron', 14)}</span>${staff(G.name)}<span class="muted small" style="margin-left:6px">${G.rows.length} KH</span></td><td class="num" id="g${gi}-all"></td></tr>
          ${closed ? '' : G.rows.map(r => { const open = !!s.open[r.k.id]; return `
            <tr class="m-row ${open ? 'open' : ''}" data-act="m-open" data-id="${esc(r.k.id)}">
              <td><div class="name"><span class="chev ${open ? '' : 'closed'}">${icon('chevron', 13)}</span>${esc(r.k.ten)}</div><div class="meta muted small">${esc(r.k.ma_kh)}${r.skus.length ? ` · ${r.skus.length} SKU${r.nReg ? ` (${r.nReg} có MT)` : ''}` : ''}</div></td>
              <td class="num" data-gid="${esc(r.k.id)}" data-total><b>${fmtDS(this.val(r, 'mt_ma_mau') + this.val(r, 'mt_kem_lanh'))}</b></td>
            </tr>
            ${open ? `<tr class="m-detail"><td colspan="2">
              ${MT_GROUPS.map(([g, label, ds, mt]) => `<div class="m-grp m-${g}"><div class="m-lbl">${label}</div>
                <div class="m-cells"><div><span>SL ${prev}</span>${cell(r, ds, canDs)}</div><div><span>MT ${nam}</span>${cell(r, mt, true)}</div><div><span>±</span><b data-gid="${esc(r.k.id)}" data-g="${g}">${growth(this.val(r, mt), this.val(r, ds))}</b></div></div></div>`).join('')}
              <div class="m-foot"><span class="muted small">Mục tiêu SKU</span>${skuCell(r)}${r.nReg ? `<span class="sku-total" data-act="sku" data-id="${esc(r.k.id)}">${fmtDS(r.skuTotal)}</span>` : ''}</div>
              <input class="input cell note ${s.edits[r.k.id]?.ghi_chu !== undefined ? 'dirty' : ''}" data-id="${esc(r.k.id)}" data-k="ghi_chu" value="${esc(s.edits[r.k.id]?.ghi_chu ?? r.t?.ghi_chu ?? '')}" placeholder="Ghi chú…">
            </td></tr>` : ''}`; }).join('')}</tbody>`; }).join('')}
      </table>`;
    },
    mount() {
      if (!this._rows) return;
      this.refresh();
      document.querySelectorAll('.target-table input[data-k]').forEach(inp => {
        inp.addEventListener('input', () => {
          const s = this.st();
          if (inp.dataset.k !== 'ghi_chu') { const t = inp.value.trim(); inp.value = t === '' ? '' : UI.typeQty(t); }
          (s.edits[inp.dataset.id] = s.edits[inp.dataset.id] || {})[inp.dataset.k] = inp.value;
          inp.classList.add('dirty');
          this.refresh(inp.dataset.id);
        });
        inp.addEventListener('keydown', e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const all = [...document.querySelectorAll(`.target-table input[data-k="${inp.dataset.k}"]`)];
          const next = all[all.indexOf(inp) + 1];
          if (next) { next.focus(); next.select(); }
        });
      });
    },
    /* Cập nhật % tăng trưởng, tổng dòng, tổng theo NVKD, tổng chung, KPI mà không vẽ lại cả trang (giữ con trỏ khi đang gõ) */
    refresh(rowId) {
      const rows = this._rows || [];
      const $ = id => document.getElementById(id);
      const prev = Number(this.st().nam) - 1;
      if (rowId) {
        const r = rows.find(x => String(x.k.id) === String(rowId));
        if (r) document.querySelectorAll(`[data-gid="${CSS.escape(String(rowId))}"]`).forEach(el => {
          const g = MT_GROUPS.find(x => x[0] === el.dataset.g);
          if (g) el.innerHTML = growth(this.val(r, g[3]), this.val(r, g[2]));
          else if ('total' in el.dataset) el.innerHTML = `<b>${fmtDS(this.val(r, 'mt_ma_mau') + this.val(r, 'mt_kem_lanh'))}</b>`;
        });
      }
      // % tăng trưởng chỉ so trên các KH đã nhập mục tiêu (tránh ra số âm khi mới nhập được vài KH)
      const totals = (list, pfx) => {
        const sum = (key, only) => list.reduce((a, r) => a + (!only || this.val(r, only) ? this.val(r, key) : 0), 0);
        const out = { all: 0, allDs: 0, allCmp: 0, g: {} };
        MT_GROUPS.forEach(([g, , ds, mt]) => {
          const d = sum(ds), m = sum(mt), c = sum(ds, mt);
          out.g[g] = { d, m, c }; out.all += m; out.allDs += d; out.allCmp += c;
          if ($(`${pfx}-${ds}`)) { $(`${pfx}-${ds}`).textContent = fmtDS(d); $(`${pfx}-${mt}`).textContent = fmtDS(m); $(`${pfx}-g-${g}`).innerHTML = growth(m, c); }
        });
        const nSku = list.reduce((a, r) => a + r.nReg, 0);
        if ($(`${pfx}-sku`)) $(`${pfx}-sku`).innerHTML = nSku ? `<span class="muted small">${nSku} SKU</span>` : '';
        const skuMt = list.reduce((a, r) => a + r.skuTotal, 0);
        if ($(`${pfx}-skumt`)) $(`${pfx}-skumt`).innerHTML = skuMt ? fmtDS(skuMt) : '<span class="muted">—</span>';
        if ($(`${pfx}-all`)) $(`${pfx}-all`).innerHTML = `<b>${fmtDS(out.all)}</b>`;
        return out;
      };
      (this._groups || []).forEach((G, gi) => totals(G.rows, 'g' + gi));
      const T = totals(rows, 'tot');
      MT_GROUPS.forEach(([g]) => {
        $('kpi-mt-' + g).textContent = fmtDS(T.g[g].m);
        $('kpi-hint-' + g).innerHTML = `SL ${prev}: ${fmtDS(T.g[g].d)}${T.g[g].m ? ' · ' + growth(T.g[g].m, T.g[g].c) + ' trên KH đã nhập' : ''}`;
      });
      $('kpi-mt-all').textContent = fmtDS(T.all);
      $('kpi-hint-all').innerHTML = `SL ${prev}: ${fmtDS(T.allDs)}${T.all ? ' · ' + growth(T.all, T.allCmp) + ' trên KH đã nhập' : ''}`;
      $('kpi-done').textContent = `${rows.filter(r => this.val(r, 'mt_ma_mau') || this.val(r, 'mt_kem_lanh')).length} / ${rows.length}`;
      $('kpi-done-hint').textContent = `khách hàng · ${rows.filter(r => r.nReg).length} KH có mục tiêu theo SKU`;
      const n = this.dirtyCount(), btn = $('mt-save');
      if (btn && !btn.dataset.busy) { btn.disabled = !n; btn.textContent = 'Lưu mục tiêu' + (n ? ` (${n})` : ''); }
    },
    actions: {
      async save() {
        const s = Targets.st();
        const ids = Object.keys(s.edits);
        if (!ids.length) return;
        const rows = ids.map(id => {
          const e = s.edits[id], r = { nam: s.nam, khach_hang_id: id };
          Object.keys(e).forEach(k => { r[k] = k === 'ghi_chu' ? e[k].trim() : (e[k].trim() === '' ? '' : UI.parseQty(e[k])); });
          return r;
        });
        const btn = document.getElementById('mt-save');
        btn.disabled = true; btn.dataset.busy = '1'; btn.textContent = `Đang lưu ${rows.length} khách hàng…`;
        try {
          const res = await Store.saveTargets(rows);
          const failed = new Set(res.errors.map(x => String(x.khach_hang_id)));
          ids.forEach(id => { if (!failed.has(String(id))) delete s.edits[id]; });
          if (res.errors.length) toast(`Lưu được ${res.saved.length}, lỗi ${res.errors.length}: ${res.errors[0].error}`, true);
          else toast(`Đã lưu mục tiêu ${res.saved.length} khách hàng`);
        } catch (err) { toast('Lỗi: ' + err.message, true); }
        App.render();
      },
      sku(ds) { openSkuTargets(ds.id, false); },
      'sku-add'(ds) { openSkuTargets(ds.id, true); },
      'm-open'(ds) { const s = Targets.st(); s.open = s.open || {}; s.open[ds.id] = !s.open[ds.id]; App.render(); if (s.open[ds.id]) setTimeout(() => { const i = document.querySelector(`.m-detail input[data-id="${CSS.escape(ds.id)}"][data-k^="mt_"]`); i && i.focus(); }, 30); },
      'toggle-nv'(ds) { const s = Targets.st(); s.collapsed[ds.nv] = !s.collapsed[ds.nv]; App.render(); },
      export() {
        const rows = (Targets._rows || []).map(r => ({ nam: Targets.st().nam, ma_kh: r.k.ma_kh, ten_kh: r.k.ten, nvkd: r.k.nvkd, ghi_chu: r.t?.ghi_chu || '',
          ...Object.fromEntries(['sl_ma_mau', 'mt_ma_mau', 'sl_kem_lanh', 'mt_kem_lanh'].map(k => [k, Targets.val(r, k) || ''])) }));
        exportCsv(`muc-tieu-${Targets.st().nam}.csv`, ENTITIES.MucTieu.fields, rows);
      },
      'export-sku'() {
        const rows = (Targets._rows || []).flatMap(r => r.skus.map(x => ({ ...x, ten_kh: r.k.ten, ma_kh: r.k.ma_kh, nvkd: r.k.nvkd })));
        exportCsv(`muc-tieu-sku-${Targets.st().nam}.csv`, ENTITIES.MucTieuSKU.fields, rows);
      },
    },
  };

  /* ---------- Popup: mục tiêu theo SKU của 1 khách hàng ---------- */
  function openSkuTargets(khId, focusAdd) {
    const k = Store.get('KhachHang', khId);
    if (!k) return;
    const me = myStaff(), canSl = isManager(me);
    const nam = Targets.st().nam, prev = Number(nam) - 1;
    const canNewSku = !!me;   // mọi nhân viên được thêm SKU mới; sửa / xóa SKU: Quản lý (trang Danh mục SKU)
    const canEditSku = isManager(me);
    const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
    /* SKU trong danh mục: khớp mã, hoặc khớp tên (dòng dán tay chỉ có tên SKU) */
    const findSku = (ma, ten) => D().SKU.find(x => ma && same(x.ma_sku, ma)) || D().SKU.find(x => ten && same(x.ten_sku, ten)) || D().SKU.find(x => ma && same(x.ten_sku, ma));
    const toItem = (x, extra) => {
      const info = findSku(x.ma_sku, x.ten_sku);
      return { ma_sku: info ? info.ma_sku : (x.ma_sku || ''), ten_sku: info ? info.ten_sku : (x.ten_sku || x.ma_sku || ''), nhom_sp: info ? info.nhom : (x.nhom_sp || ''),
        known: !!info, sl: qtyInput(x.sl_nam_truoc), mt: qtyInput(x.mt), isNew: false, xoa: false, changed: false, ...extra };
    };
    let items = skuRowsOf(k, nam).map(x => toItem(x))
      .sort((a, b) => UI.parseQty(b.sl) - UI.parseQty(a.sl) || UI.parseQty(b.mt) - UI.parseQty(a.mt) || String(a.ma_sku).localeCompare(b.ma_sku));
    const changes = () => items.filter(i => i.changed || i.xoa || (i.isNew && (UI.parseQty(i.mt) || UI.parseQty(i.sl)))).length;
    let linkTarget = null;
    const inGrid = i => !i.xoa && (UI.parseQty(i.sl) > 0 || UI.parseQty(i.mt) > 0 || i.isNew || i.changed);
    const sameSku = (i, info) => same(i.ma_sku, info.ma_sku) || same(i.ten_sku, info.ten_sku) || same(i.ten_sku, info.ma_sku);
    /* SKU đã có ở lưới → báo, nháy dòng đó, đưa con trỏ tới ô MT; KHÔNG thêm dòng */
    const alreadyInGrid = it => {
      toast(`Đã có thông tin SKU ${it.ma_sku || it.ten_sku} ở bên dưới — không thêm lại.`);
      $('#sku-pick').value = ''; closeMenu();
      const tr = m.el.querySelector(`tr[data-i="${items.indexOf(it)}"]`);
      if (tr) { tr.classList.remove('flash'); void tr.offsetWidth; tr.classList.add('flash'); tr.scrollIntoView({ block: 'nearest' }); const inp = tr.querySelector('input[data-f="mt"]'); if (inp) { inp.focus(); inp.select(); } }
    };   // dòng SKU chưa có trong danh mục đang được "Thêm vào danh mục"

    const m = UI.modal({
      title: `Mục tiêu theo SKU · ${k.ten}`, wide: true,
      body: `<div class="muted small" style="margin-bottom:10px">${esc(k.ma_kh)} · NVKD ${esc(k.nvkd || '—')} · Năm mục tiêu ${nam} · đơn vị ${esc(DV)}${canSl ? '' : ` · SL ${prev} do Quản lý cập nhật`}</div>
        <div class="row sku-pick-row">
          <div class="sku-search"><input class="input" id="sku-pick" placeholder="Gõ mã hoặc tên SKU để chọn từ danh mục…" autocomplete="off"><div class="sku-menu" id="sku-menu" hidden></div></div>
          ${canNewSku ? '<button class="btn" data-sk="new-sku" title="SKU chưa có trong danh mục">Tạo SKU mới</button>' : ''}</div>
        <div id="sku-new" class="sku-new" hidden></div>
        <div id="sku-body"></div>`,
      foot: `<a href="#/sku" class="small">Danh mục SKU →</a><div class="row"><button class="btn" data-sk="cancel">Đóng</button><button class="btn btn-primary" data-sk="save">Lưu</button></div>`,
    });
    const $ = sel => m.el.querySelector(sel);

    /* ---------- Bảng SKU của khách ---------- */
    const draw = () => {
      const live = items.filter(inGrid);
      const row = i => {
        const idx = items.indexOf(i), info = i.known ? findSku(i.ma_sku) : null, g = groupOf(i.nhom_sp);
        return `<tr data-i="${idx}" class="${i.known ? '' : 'sku-unknown'}">
          <td><div class="name">${esc(i.known ? i.ma_sku : (i.ten_sku || i.ma_sku))}</div>
            <div class="meta muted small">${i.known ? (same(i.ten_sku, i.ma_sku) ? '' : esc(i.ten_sku)) + (info?.quy_cach ? ' · ' + esc(info.quy_cach) : '') : `<span class="badge b-orange">Chưa có trong danh mục</span> ${canNewSku ? '<a href="#" data-sk="link-new">Thêm vào danh mục</a>' : ''}`}</div></td>
          <td>${g ? `<span class="badge ${g === 'mau' ? 'b-purple' : 'b-blue'}">${esc(i.nhom_sp)}</span>`
            : i.known && canEditSku ? `<select class="input nhom-pick" data-nhom title="Chọn nhóm cho SKU này (lưu vào danh mục SKU)"><option value="">Chọn nhóm…</option>${OPT.nhomSP.map(o => `<option>${esc(o)}</option>`).join('')}</select>`
            : '<span class="badge b-orange">Chưa có nhóm</span>'}</td>
          <td class="num">${canSl ? `<input class="input cell" data-f="sl" inputmode="decimal" value="${esc(i.sl)}" placeholder="0">` : `<span class="${UI.parseQty(i.sl) ? '' : 'muted'}">${esc(i.sl || '0')} ${esc(DV)}</span>`}</td>
          <td class="num"><input class="input cell ${i.changed || i.isNew ? 'dirty' : ''}" data-f="mt" inputmode="decimal" value="${esc(i.mt)}" placeholder="Nhập…"></td>
          <td class="num" data-gr>${growth(UI.parseQty(i.mt), UI.parseQty(i.sl))}</td>
          <td><button class="btn btn-sm btn-ghost" data-sk="del" title="Bỏ SKU này">${icon('x', 14)}</button></td></tr>`;
      };
      $('#sku-body').innerHTML = `<div class="table-wrap"><table class="target-table sku-table"><thead><tr><th>SKU</th><th>Nhóm</th><th class="num">SL ${prev}</th><th class="num">MT ${nam}</th><th class="num">±</th><th></th></tr></thead>
        <tbody>${live.length ? live.map(row).join('') : `<tr><td colspan="6" class="muted small">Khách hàng chưa có sản lượng ${prev} theo SKU. Gõ mã / tên SKU ở ô phía trên và bấm chọn để thêm (SKU chưa có thì <b>Tạo SKU mới</b>).</td></tr>`}</tbody>
        <tfoot id="sku-sum"></tfoot></table></div>`;
      sum();
    };
    const sum = () => {
      const live = items.filter(i => !i.xoa);
      const line = (label, L) => {
        const sl = L.reduce((a, i) => a + UI.parseQty(i.sl), 0), mt = L.reduce((a, i) => a + UI.parseQty(i.mt), 0);
        const slCmp = L.filter(i => UI.parseQty(i.mt) > 0).reduce((a, i) => a + UI.parseQty(i.sl), 0);
        return `<tr><td colspan="2">${label}</td><td class="num">${fmtDS(sl)}</td><td class="num">${fmtDS(mt)}</td><td class="num">${growth(mt, slCmp)}</td><td></td></tr>`;
      };
      const none = live.filter(i => !groupOf(i.nhom_sp));
      $('#sku-sum').innerHTML = MT_GROUPS.map(([g, label]) => line(label, live.filter(i => groupOf(i.nhom_sp) === g))).join('') +
        (none.length ? line(`<span class="muted">Chưa có nhóm (${none.length} SKU) — chọn nhóm ở cột Nhóm để cộng vào Mạ màu / Mạ kẽm + Mạ lạnh</span>`, none) : '');
      const n = changes(), btn = $('[data-sk="save"]');
      btn.disabled = !n; btn.textContent = n ? `Lưu (${n} thay đổi)` : 'Lưu';
    };

    /* ---------- Ô tìm SKU: danh sách thả xuống, bấm chọn là thêm ngay ---------- */
    let menuIdx = 0, menuList = [], menuInGrid = [];
    const drawMenu = () => {
      const q = fold($('#sku-pick').value);
      const used = new Set(items.filter(i => inGrid(i) && i.ma_sku).map(i => fold(i.ma_sku)));
      const inTable = menuInGrid = q ? items.filter(i => inGrid(i) && (fold(i.ma_sku).includes(q) || fold(i.ten_sku).includes(q))) : [];
      menuList = D().SKU.filter(x => x.trang_thai !== 'Ngừng bán' && !used.has(fold(x.ma_sku)) &&
        (!q || fold(x.ma_sku).includes(q) || fold(x.ten_sku).includes(q) || fold(x.quy_cach).includes(q)))
        .sort((a, b) => String(a.nhom).localeCompare(b.nhom, 'vi') || String(a.ma_sku).localeCompare(b.ma_sku)).slice(0, 60);
      menuIdx = Math.min(menuIdx, Math.max(0, menuList.length - 1));
      const raw = $('#sku-pick').value.trim();
      $('#sku-menu').innerHTML = inTable.slice(0, 5).map(i => `<div class="sku-opt intable" data-goto="${items.indexOf(i)}">✓ <b>${esc(i.ma_sku || i.ten_sku)}</b><span class="t">đã có thông tin SKU ở bên dưới</span></div>`).join('') + (menuList.length ? menuList.map((x, i) => `<div class="sku-opt ${i === menuIdx ? 'on' : ''}" data-opt="${i}">
          <b>${esc(x.ma_sku)}</b><span class="t">${same(x.ten_sku, x.ma_sku) ? '' : esc(x.ten_sku)}</span><span class="badge ${groupOf(x.nhom) === 'mau' ? 'b-purple' : 'b-blue'}">${esc(x.nhom || '—')}</span></div>`).join('')
          : inTable.length ? '' : `<div class="sku-opt empty">Không có SKU nào trong danh mục khớp "${esc(raw)}".</div>`) +
        (canNewSku ? `<div class="sku-opt create" data-opt="new">${icon('plus', 13)} Tạo SKU mới${raw ? ` “${esc(raw)}”` : ''}</div>` : '');
      $('#sku-menu').hidden = false;
    };
    const closeMenu = () => { $('#sku-menu').hidden = true; };
    const pick = opt => {
      if (opt === 'new') { closeMenu(); return showNewSku($('#sku-pick').value.trim()); }
      const info = menuList[Number(opt)];
      if (info) pushSku(info);
    };
    /* Thêm SKU xuống bảng: chưa có sản lượng năm trước thì SL = 0, gõ MT luôn */
    const pushSku = info => {
      const shown = items.find(i => inGrid(i) && sameSku(i, info));
      if (shown) return alreadyInGrid(shown);
      let it = items.find(i => sameSku(i, info));   // có dữ liệu nhưng đang ẩn (SL = 0, đã bỏ) → hiện lại
      if (it) Object.assign(it, { xoa: false, known: true, ma_sku: info.ma_sku, ten_sku: info.ten_sku, nhom_sp: info.nhom, isNew: it.isNew || !UI.parseQty(it.sl) });
      else { it = { ma_sku: info.ma_sku, ten_sku: info.ten_sku, nhom_sp: info.nhom, known: true, sl: '', mt: '', isNew: true, xoa: false, changed: false }; items.unshift(it); }
      $('#sku-pick').value = ''; closeMenu();
      draw();
      const inp = m.el.querySelector(`tr[data-i="${items.indexOf(it)}"] input[data-f="mt"]`);
      if (inp) { inp.focus(); inp.select(); }
    };

    /* ---------- Tạo SKU mới ngay trong popup (tự sinh id) ---------- */
    const showNewSku = (typed = '', target = null) => {
      linkTarget = target;
      const looksCode = typed && !/\s/.test(typed);
      const box = $('#sku-new');
      box.hidden = false;
      box.innerHTML = `<div class="section-title" style="margin-top:0">${target ? 'Thêm SKU này vào danh mục' : 'SKU mới (chưa có trong danh mục)'}</div>
        <div class="form-grid">
          <div class="field"><label>Mã SKU <span class="req">*</span></label><input class="input" id="ns-ma" value="${esc(target ? (target.ma_sku || target.ten_sku) : (looksCode ? typed : ''))}" placeholder="vd MM-040-1200"></div>
          <div class="field"><label>Nhóm sản phẩm <span class="req">*</span></label><select class="input" id="ns-nhom"><option value="">— Chọn —</option>${OPT.nhomSP.map(o => `<option>${esc(o)}</option>`).join('')}</select></div>
          <div class="field full"><label>Tên SKU <span class="req">*</span></label><input class="input" id="ns-ten" value="${esc(target ? target.ten_sku : (looksCode ? '' : typed))}" placeholder="vd Tôn mạ màu 0.40mm khổ 1200"></div>
          <div class="field full"><label>Quy cách</label><input class="input" id="ns-qc" placeholder="Độ dày, khổ, lớp mạ…"></div>
        </div>
        <div class="row mt" style="justify-content:flex-end"><button class="btn btn-sm" data-sk="ns-cancel">Hủy</button><button class="btn btn-sm btn-primary" data-sk="ns-save">${target ? 'Thêm vào danh mục' : 'Tạo SKU và thêm vào mục tiêu'}</button></div>`;
      (target ? $('#ns-nhom') : looksCode ? $('#ns-ten') : $('#ns-ma')).focus();
    };
    const saveNewSku = async btn => {
      const d = { ma_sku: $('#ns-ma').value.trim(), ten_sku: $('#ns-ten').value.trim(), nhom: $('#ns-nhom').value, quy_cach: $('#ns-qc').value.trim(), trang_thai: 'Đang bán' };
      if (!d.ma_sku || !d.ten_sku || !d.nhom) return toast('Nhập mã SKU, tên SKU và chọn nhóm sản phẩm', true);
      if (D().SKU.some(x => same(x.ma_sku, d.ma_sku) || same(x.ten_sku, d.ten_sku))) return toast('SKU "' + d.ma_sku + '" đã có trong danh mục — gõ tên ở ô tìm để chọn', true);
      btn.disabled = true; btn.textContent = 'Đang tạo…';
      try {
        const row = await Store.create('SKU', d);
        $('#sku-new').hidden = true; $('#sku-new').innerHTML = ''; $('#sku-pick').value = '';
        toast('Đã thêm SKU ' + row.ma_sku + ' vào danh mục');
        if (linkTarget) { Object.assign(linkTarget, { ma_sku: row.ma_sku, ten_sku: row.ten_sku, nhom_sp: row.nhom, known: true, changed: true }); linkTarget = null; draw(); }
        else pushSku(row);
      } catch (err) { toast('Lỗi: ' + err.message, true); btn.disabled = false; btn.textContent = 'Thử lại'; }
    };

    /* ---------- Sự kiện ---------- */
    m.el.addEventListener('mousedown', e => {
      const gt = e.target.closest('[data-goto]');
      if (gt) {
        e.preventDefault(); return alreadyInGrid(items[Number(gt.dataset.goto)]);
      }
      const o = e.target.closest('[data-opt]');
      if (o) { e.preventDefault(); pick(o.dataset.opt); }
    });
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-sk]');
      if (!b) return;
      e.preventDefault();
      const act = b.dataset.sk;
      if (act === 'new-sku') return showNewSku($('#sku-pick').value.trim());
      if (act === 'link-new') return showNewSku('', items[Number(b.closest('tr').dataset.i)]);
      if (act === 'ns-cancel') { $('#sku-new').hidden = true; linkTarget = null; return; }
      if (act === 'ns-save') return saveNewSku(b);
      if (act === 'cancel') { if (!changes() || confirm('Đóng và bỏ các thay đổi chưa lưu?')) m.close(); return; }
      if (act === 'del') {
        const i = items[Number(b.closest('tr').dataset.i)];
        if (i.isNew && !i.changed && !UI.parseQty(i.sl)) items.splice(items.indexOf(i), 1);
        else if (canSl || !UI.parseQty(i.sl)) i.xoa = true;          // xóa hẳn dòng
        else { i.mt = ''; i.changed = true; i.isNew = false; }     // NVKD: còn SL năm trước → chỉ bỏ mục tiêu
        return draw();
      }
      if (act === 'save') {
        const todo = items.filter(i => i.changed || i.xoa || (i.isNew && (UI.parseQty(i.mt) || UI.parseQty(i.sl))));
        const unk = todo.filter(i => !i.xoa && !i.known);
        if (unk.length) return toast(`SKU "${unk[0].ten_sku || unk[0].ma_sku}" chưa có trong danh mục — bấm "Thêm vào danh mục" ở dòng đó trước khi lưu.`, true);
        const rows = todo.filter(i => i.ma_sku).map(i => {
          const r = { nam, khach_hang_id: k.id, ma_sku: i.ma_sku };
          if (i.xoa) r.xoa = true;
          else { r.mt = i.mt.trim() === '' ? '' : UI.parseQty(i.mt); if (canSl) r.sl_nam_truoc = i.sl.trim() === '' ? 0 : UI.parseQty(i.sl); }
          return r;
        });
        if (!rows.length) return m.close();
        b.disabled = true; b.textContent = 'Đang lưu…';
        try {
          const res = await Store.saveSkuTargets(rows);
          if (res.errors.length) toast(`Lỗi ${res.errors.length} SKU: ${res.errors[0].error}`, true);
          else toast(`Đã lưu mục tiêu SKU cho ${k.ten}`);
          m.close(); App.render();
        } catch (err) { toast('Lỗi: ' + err.message, true); b.disabled = false; sum(); }
      }
    });
    m.el.addEventListener('change', async e => {
      const sel = e.target.closest('select[data-nhom]');
      if (!sel || !sel.value) return;
      const it = items[Number(sel.closest('tr').dataset.i)], info = findSku(it.ma_sku, it.ten_sku);
      if (!info) return;
      sel.disabled = true;
      try {
        await Store.update('SKU', info.id, { nhom: sel.value });
        items.filter(x => same(x.ma_sku, info.ma_sku)).forEach(x => { x.nhom_sp = sel.value; });
        toast(`Đã đặt nhóm "${sel.value}" cho SKU ${info.ma_sku}`); draw();
      } catch (err) { toast('Lỗi: ' + err.message, true); sel.disabled = false; }
    });
    m.el.addEventListener('input', e => {
      if (e.target.id === 'sku-pick') { menuIdx = 0; return drawMenu(); }
      const inp = e.target.closest('input[data-f]');
      if (!inp) return;
      const i = items[Number(inp.closest('tr').dataset.i)];
      const t = inp.value.trim(); inp.value = t === '' ? '' : UI.typeQty(t);
      i[inp.dataset.f] = inp.value; i.changed = true; inp.classList.add('dirty');
      inp.closest('tr').querySelector('[data-gr]').innerHTML = growth(UI.parseQty(i.mt), UI.parseQty(i.sl));
      sum();
    });
    m.el.addEventListener('keydown', e => {
      if (e.target.id === 'sku-pick') {
        const open = !$('#sku-menu').hidden;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!open) return drawMenu(); menuIdx = Math.max(0, Math.min(menuList.length - 1, menuIdx + (e.key === 'ArrowDown' ? 1 : -1))); return drawMenu(); }
        if (e.key === 'Escape' && open) { e.stopPropagation(); return closeMenu(); }
        if (e.key === 'Enter') { e.preventDefault(); return menuList.length ? pick(menuIdx) : menuInGrid.length ? alreadyInGrid(menuInGrid[0]) : (canNewSku && pick('new')); }
        return;
      }
      if (e.key !== 'Enter') return;
      if (e.target.closest('#sku-new')) { e.preventDefault(); return saveNewSku($('[data-sk="ns-save"]')); }
      const inp = e.target.closest('input[data-f]');
      if (!inp) return;
      e.preventDefault();
      const all = [...m.el.querySelectorAll(`input[data-f="${inp.dataset.f}"]`)];
      const next = all[all.indexOf(inp) + 1];
      if (next) { next.focus(); next.select(); }
    });
    $('#sku-pick').addEventListener('focus', drawMenu);
    $('#sku-pick').addEventListener('blur', () => setTimeout(closeMenu, 150));
    draw();
    setTimeout(() => { const f = focusAdd ? $('#sku-pick') : m.el.querySelector('input[data-f="mt"]') || $('#sku-pick'); f && f.focus(); }, 30);
  }

  /* ========================================================= */
  /* DANH MỤC SKU                                               */
  /* ========================================================= */
  const SkuCatalog = {
    render() {
      const s = App.st('sku', { q: '', nhom: '', tt: '' });
      const me = myStaff(), canEdit = isManager(me), canAdd = !!me;
      const all = D().SKU;
      const rows = all.filter(x => (!s.nhom || x.nhom === s.nhom) && (!s.tt || x.trang_thai === s.tt) && search(s.q, x.ma_sku, x.ten_sku, x.quy_cach))
        .sort((a, b) => String(a.nhom).localeCompare(b.nhom, 'vi') || String(a.ma_sku).localeCompare(b.ma_sku));
      const used = ma => uniq(D().MucTieuSKU.filter(x => same(x.ma_sku, ma) && num(x.mt) > 0).map(x => x.khach_hang_id || x.ma_kh)).length;
      return head('Thiết lập', 'Danh mục SKU', 'Dùng để đặt mục tiêu sản lượng theo SKU. Nhóm "Mạ màu" cộng vào MT mạ màu, "Mạ kẽm"/"Mạ lạnh" cộng vào MT mạ kẽm + mạ lạnh.',
        canAdd ? `<button class="btn btn-primary" data-act="new">${icon('plus', 15)} Thêm SKU</button>` : '') + dataIssues(['SKU', 'MucTieuSKU']) +
        `<div class="filters">
          <div class="field search"><label>Tìm SKU</label><input class="input" data-filter="q" value="${esc(s.q)}" placeholder="Mã, tên, quy cách…"></div>
          ${selectHtml('nhom', 'Nhóm sản phẩm', OPT.nhomSP, s.nhom)}
          ${selectHtml('tt', 'Trạng thái', OPT.trangThaiSKU, s.tt)}
        </div>
        <div class="table-wrap"><table><thead><tr><th>Mã SKU</th><th>Tên SKU</th><th>Nhóm</th><th>Quy cách</th><th class="num">KH có mục tiêu</th><th>Trạng thái</th></tr></thead><tbody>
          ${rows.map(x => `<tr class="${canEdit ? 'clickable' : ''}" ${canEdit ? `data-act="edit" data-id="${esc(x.id)}"` : ''}><td><b>${esc(x.ma_sku)}</b></td><td>${esc(x.ten_sku)}</td>
            <td><span class="badge ${groupOf(x.nhom) === 'mau' ? 'b-purple' : 'b-blue'}">${esc(x.nhom)}</span></td><td class="muted">${esc(x.quy_cach)}</td>
            <td class="num">${used(x.ma_sku) || '<span class="muted">0</span>'}</td><td>${x.trang_thai === 'Ngừng bán' ? '<span class="badge b-red">Ngừng bán</span>' : '<span class="badge b-green">Đang bán</span>'}</td></tr>`).join('')}
        </tbody></table>${rows.length ? '' : `<div class="empty">${all.length ? 'Không có SKU phù hợp.' : 'Chưa có SKU. ' + (canAdd ? 'Bấm "Thêm SKU", hoặc dán danh sách vào tab SKU trong Google Sheet (cột id, ma_sku, ten_sku, nhom, quy_cach, trang_thai).' : 'Liên hệ Quản lý để thêm.')}</div>`}</div>
        ${canEdit ? '' : '<p class="small muted mt">Mọi nhân viên được thêm SKU mới; chỉ Quản lý được sửa / ngừng bán SKU đã có.</p>'}`;
    },
    actions: {
      new() {
        openForm('SKU', null, {
          defaults: { trang_thai: 'Đang bán' },
          beforeSave(d) { if (D().SKU.some(x => same(x.ma_sku, d.ma_sku))) throw new Error('Mã SKU đã tồn tại'); },
        });
      },
      edit(ds) { openForm('SKU', Store.get('SKU', ds.id)); },
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
        ${rows.map(n => `<tr class="clickable" data-act="edit" data-id="${esc(n.id)}"><td>${staff(n.ten, false)}</td><td>${esc(n.email)}</td><td>${esc(n.sdt)}</td><td>${esc(n.nhom_kd)}</td><td>${esc(n.vai_tro)}</td>
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

  const VIEWS = { 'tong-quan': Dashboard, 'khach-hang': Customers, pipeline: Pipeline, telesale: Telesale, 'muc-tieu': Targets, 'thi-truong': Market, 'ke-hoach': Plan, 'nhan-vien': Staff, sku: SkuCatalog };
  window.App = App;
  App.start();
})();
