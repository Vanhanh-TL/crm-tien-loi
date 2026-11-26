/* Lớp dữ liệu: chế độ LIVE gọi /api (Cloudflare → Apps Script → Google Sheet),
   chế độ DEMO lưu trong trình duyệt (localStorage) để xem thử khi chưa nối Sheet. */
(function () {
  const TABLES = ['KhachHang', 'CoHoi', 'ThiTruong', 'KeHoach', 'Telesale', 'HoatDong', 'NhanVien'];
  const LS_KEY = 'crm-demo-v1';

  const Store = {
    mode: 'demo',   // demo | live | login
    me: null,       // { email, ten } khi đã đăng nhập
    loginError: '',
    data: Object.fromEntries(TABLES.map(t => [t, []])),

    async init() {
      try {
        const res = await call({ action: 'all' });
        if (res.ok) { this.mode = 'live'; this.me = res.me || null; this.data = { ...this.data, ...res.data }; return; }
        if (res.needLogin) { this.mode = 'login'; this.loginError = res.error === 'Chưa đăng nhập' ? '' : res.error; return; }
        console.warn('API chưa sẵn sàng → chạy DEMO:', res.error);
      } catch (e) { console.warn('Không gọi được /api → chạy DEMO'); }
      this.mode = 'demo';
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { }
      this.data = saved || seed();
      this.persist();
    },

    persist() {
      if (this.mode !== 'demo') return;
      try { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); } catch (e) { }
    },

    resetDemo() { try { localStorage.removeItem(LS_KEY); } catch (e) { } location.reload(); },

    async reload() {
      if (this.mode !== 'live') return;
      const res = await call({ action: 'all' });
      if (res.ok) this.data = { ...this.data, ...res.data };
    },

    requestOtp(email) { return call({ action: 'otp_request', email }); },
    verifyOtp(email, code) { return call({ action: 'otp_verify', email, code }); },
    async logout() { await call({ action: 'logout' }); location.reload(); },

    get(table, id) { return this.data[table].find(r => String(r.id) === String(id)); },

    async create(table, rec) {
      const now = new Date().toISOString();
      const row = { ...rec, id: rec.id || uid(), ngay_tao: now, ngay_cap_nhat: now };
      if (this.mode === 'live') {
        const res = await call({ action: 'create', sheet: table, data: row });
        if (!res.ok) throw new Error(res.error);
        Object.assign(row, res.data);
      }
      this.data[table].push(row);
      this.persist();
      return row;
    },

    async update(table, id, patch) {
      const row = this.get(table, id);
      if (!row) throw new Error('Không tìm thấy bản ghi');
      const next = { ...row, ...patch, ngay_cap_nhat: new Date().toISOString() };
      if (this.mode === 'live') {
        const res = await call({ action: 'update', sheet: table, id, data: patch });
        if (!res.ok) throw new Error(res.error);
      }
      Object.assign(row, next);
      this.persist();
      return row;
    },

    async remove(table, id) {
      if (this.mode === 'live') {
        const res = await call({ action: 'delete', sheet: table, id });
        if (!res.ok) throw new Error(res.error);
      }
      this.data[table] = this.data[table].filter(r => String(r.id) !== String(id));
      this.persist();
    },

    /* Ghi nhật ký hoạt động (không chặn giao diện nếu lỗi) */
    log(loai, doi_tuong, doi_tuong_id, noi_dung, nguoi) {
      return this.create('HoatDong', {
        thoi_gian: new Date().toISOString(), loai, doi_tuong, doi_tuong_id, noi_dung,
        nguoi_thuc_hien: nguoi || App.currentUser(),
      }).catch(e => console.warn('log lỗi', e));
    },
  };

  async function call(body) {
    if (location.protocol === 'file:') return { ok: false, error: 'file://' };
    const r = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) return { ok: false, error: 'HTTP ' + r.status };
    const res = await r.json();
    // Phiên hết hạn giữa chừng → về màn hình đăng nhập
    if (res.needLogin && body.action !== 'all' && Store.mode === 'live') { alert('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'); location.reload(); }
    return res;
  }

  function uid() { return Math.random().toString(36).slice(2, 10); }

  /* ---------------- Dữ liệu mẫu cho chế độ DEMO ---------------- */
  function seed() {
    const d = Object.fromEntries(TABLES.map(t => [t, []]));
    const now = new Date();
    const iso = (offsetDays, h = 9) => { const x = new Date(now); x.setDate(x.getDate() + offsetDays); x.setHours(h, (offsetDays * 7 + 13) % 60, 0, 0); return x.toISOString(); };
    const day = off => iso(off).slice(0, 10);
    const month = now.toISOString().slice(0, 7);
    const pick = (arr, i) => arr[i % arr.length];

    const staff = [['Thu Hà', 'Nhóm KD1', 'Trưởng nhóm'], ['Hoàng Nam', 'Nhóm KD1', 'NVKD'], ['Khánh Duy', 'Nhóm KD2', 'NVKD'],
      ['Quỳnh Anh', 'Nhóm KD3', 'NVKD'], ['Mai Lan', 'Telesale', 'Telesale'], ['Đức Minh', 'Nhóm KD2', 'Quản lý']];
    staff.forEach(([ten, nhom_kd, vai_tro], i) => d.NhanVien.push({ id: 'nv' + i, ten, nhom_kd, vai_tro, trang_thai: 'Đang làm', sdt: '09120000' + (10 + i), email: '', ngay_tao: iso(-90) }));
    const sales = staff.filter(s => s[2] !== 'Telesale').map(s => s[0]);

    const companies = ['Công ty TNHH An Phát', 'Công ty CP Sao Bắc Đẩu', 'Bắc Việt Media', 'Cảng Biển Logistics', 'Hải Đăng Group',
      'Tiến Phong Thương mại', 'Phương Đông Pharma', 'Á Châu Foods', 'Minh Long Xây dựng', 'Hoàng Gia Nội thất', 'Kim Ngân Trading',
      'Đại Việt Steel', 'Thành Công Plastic', 'Nam Sơn Agri', 'Hưng Thịnh Retail', 'Sông Hồng Dệt may', 'Bình Minh Electric',
      'Tân Á Packaging', 'Việt Nhật Auto', 'Gia Phú Hóa chất', 'Lộc Phát Nông sản', 'Trường Sơn Vận tải'];
    const contacts = ['Thu Trang', 'Mỹ Linh', 'Hồng Hạnh', 'Đăng Khoa', 'Bảo Long', 'Khánh Duy', 'Ngọc Mai', 'Quỳnh Anh', 'Đức Minh', 'Văn Hùng', 'Thanh Tâm'];
    const provinces = ['Hà Nội', 'Hưng Yên', 'Hải Phòng', 'Bắc Ninh', 'TP Hồ Chí Minh', 'Nghệ An', 'Ninh Bình', 'Đà Nẵng', 'Đồng Nai', 'Thanh Hóa'];
    companies.forEach((ten, i) => {
      const nv = pick(sales, i);
      const nhom = staff.find(s => s[0] === nv)[1];
      d.KhachHang.push({
        id: 'kh' + i, ma_kh: 'KH-' + String(i + 1).padStart(4, '0'), ten, loai: i % 6 === 5 ? 'Cá nhân' : 'Pháp nhân',
        mst: i % 4 === 3 ? '' : '010' + (7000000 + i * 1373), nguoi_lien_he: pick(contacts, i), chuc_vu: pick(['Giám đốc', 'Trưởng phòng mua hàng', 'Kế toán trưởng', 'Chủ cửa hàng'], i),
        sdt: '09' + String(10000000 + i * 734521).slice(0, 8), email: '', dia_chi: '', tinh: i % 7 === 6 ? '' : pick(provinces, i),
        nhom_kd: i % 9 === 8 ? '' : nhom, nvkd: nv, nguon: pick(OPT.nguon, i), trang_thai: pick(['Tiềm năng', 'Đang giao dịch', 'Tiềm năng', 'Đang giao dịch', 'Tạm dừng'], i),
        diem: pick(['A', 'B', 'C', 'B'], i), ghi_chu: '', ngay_tao: iso(-60 + i * 2), ngay_cap_nhat: iso(-i),
      });
    });

    const dealNames = ['Gói cung cấp vật tư Q1', 'Hợp đồng nguyên tắc 2027', 'Đơn hàng thử nghiệm', 'Mở rộng chi nhánh', 'Gói dịch vụ năm', 'Đơn bổ sung tháng'];
    for (let i = 0; i < 16; i++) {
      const kh = d.KhachHang[(i * 3) % d.KhachHang.length];
      const gd = pick(OPT.giaiDoan, i);
      d.CoHoi.push({
        id: 'ch' + i, ten: pick(dealNames, i), khach_hang_id: kh.id, ten_kh: kh.ten, gia_tri: (i % 5 + 1) * 35000000 + i * 4000000,
        giai_doan: gd, xac_suat: { 'Mới': 10, 'Đủ điều kiện': 25, 'Gửi báo giá': 50, 'Đàm phán': 75, 'Thắng': 100, 'Thua': 0 }[gd],
        ngay_du_kien: day(i * 3 - 10), nvkd: kh.nvkd, ghi_chu: '', ngay_tao: iso(-30 + i), ngay_cap_nhat: iso(-i % 5),
      });
    }

    for (let i = 0; i < 24; i++) {
      const kh = d.KhachHang[(i * 5) % d.KhachHang.length];
      const kq = pick(['Không nghe máy', 'Quan tâm', 'Gọi lại sau', 'Hẹn gặp', 'Từ chối', 'Chốt đơn', 'Không nghe máy', 'Quan tâm'], i);
      d.Telesale.push({
        id: 'ts' + i, ngay: iso(-Math.floor(i / 6), 9 + (i % 8)), nhan_vien: i % 3 ? 'Mai Lan' : pick(sales, i), khach_hang_id: kh.id, ten_kh: kh.ten, sdt: kh.sdt,
        ket_qua: kq, thoi_luong_phut: kq === 'Không nghe máy' ? 0 : 2 + (i % 7), hen_goi_lai: kq === 'Gọi lại sau' || kq === 'Quan tâm' ? iso(i % 3 - 1, 14) : '',
        ghi_chu: kq === 'Quan tâm' ? 'Muốn nhận báo giá qua Zalo' : '', ngay_tao: iso(-Math.floor(i / 6)),
      });
    }

    const tt = [
      ['Đối thủ', 'Công ty X', 'Sản phẩm A', 185000, 'Đối thủ đang giảm giá 8% cho đơn trên 50 thùng, áp dụng đến cuối tháng.', 'Cao'],
      ['Giá bán', '', 'Sản phẩm B', 92000, 'Giá bán lẻ tại chợ đầu mối ổn định, đại lý phản ánh hàng về chậm.', 'Trung bình'],
      ['Khách hàng mới', '', '', '', 'Khu công nghiệp mới có 3 nhà máy đang tuyển nhà cung cấp, cần liên hệ phòng mua hàng.', 'Cao'],
      ['Nhu cầu thị trường', '', 'Sản phẩm C', '', 'Nhu cầu tăng mạnh dịp cuối năm, đại lý muốn nhập sớm.', 'Trung bình'],
      ['Đại lý / NPP', 'Công ty Y', '', '', 'NPP khu vực đang tìm nguồn hàng thay thế, có thể chuyển sang ta.', 'Cao'],
      ['Đối thủ', 'Công ty Z', 'Sản phẩm A', 179000, 'Đối thủ mở thêm kho tại khu vực, giao trong ngày.', 'Thấp'],
    ];
    for (let i = 0; i < 10; i++) {
      const [loai, doi_thu, san_pham, gia, noi_dung, muc_do] = pick(tt, i);
      d.ThiTruong.push({ id: 'tt' + i, ngay: day(-i * 2), nvkd: pick(sales, i + 1), tinh: pick(provinces, i * 2), khu_vuc: '', loai_thong_tin: loai, doi_thu, san_pham, gia, noi_dung, muc_do, link_anh: '', ngay_tao: iso(-i * 2) });
    }

    sales.forEach((nv, i) => {
      const ds = (3 + i) * 200000000;
      d.KeHoach.push({
        id: 'kp' + i, thang: month, nvkd: nv, tinh: pick(provinces, i), khu_vuc: pick(['Tuyến phía Bắc', 'Tuyến trung tâm', 'KCN', 'Tuyến ven biển'], i),
        muc_tieu_doanh_so: ds, thuc_hien_doanh_so: Math.round(ds * (0.35 + i * 0.15)), muc_tieu_kh_moi: 10 + i * 2, thuc_hien_kh_moi: 4 + i * 2,
        so_luot_tham: 20 + i * 6, hoat_dong: 'Viếng thăm đại lý cấp 1, giới thiệu chính sách mới, thu thập giá đối thủ.', trang_thai: 'Đang thực hiện', ghi_chu: '', ngay_tao: iso(-20),
      });
    });

    d.CoHoi.slice(0, 6).forEach((c, i) => d.HoatDong.push({ id: 'hd' + i, thoi_gian: iso(-i), loai: 'Cơ hội', doi_tuong: 'KhachHang', doi_tuong_id: c.khach_hang_id, noi_dung: `Chuyển cơ hội "${c.ten}" sang ${c.giai_doan}`, nguoi_thuc_hien: c.nvkd }));
    d.Telesale.slice(0, 6).forEach((t, i) => d.HoatDong.push({ id: 'hdt' + i, thoi_gian: t.ngay, loai: 'Cuộc gọi', doi_tuong: 'KhachHang', doi_tuong_id: t.khach_hang_id, noi_dung: `Gọi điện: ${t.ket_qua}`, nguoi_thuc_hien: t.nhan_vien }));
    return d;
  }

  window.Store = Store;
})();
