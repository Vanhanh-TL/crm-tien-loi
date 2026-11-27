/* Lớp dữ liệu: chế độ LIVE gọi /api (Cloudflare → Apps Script → Google Sheet),
   chế độ DEMO lưu trong trình duyệt (localStorage) để xem thử khi chưa nối Sheet. */
(function () {
  const TABLES = ['KhachHang', 'CoHoi', 'ThiTruong', 'KeHoach', 'Telesale', 'HoatDong', 'NhanVien', 'MucTieu', 'SKU', 'MucTieuSKU'];
  const LS_KEY = 'crm-demo-v1';

  const Store = {
    mode: 'demo',   // demo | live | login
    me: null,       // { email, ten } khi đã đăng nhập
    missing: [],    // bảng mà Apps Script không trả về (đang chạy Code.gs cũ)
    loginError: '',
    data: Object.fromEntries(TABLES.map(t => [t, []])),

    async init() {
      try {
        const res = await call({ action: 'all' });
        if (res.ok) { this.mode = 'live'; this.me = res.me || null; this.missing = TABLES.filter(t => !Array.isArray(res.data[t])); this.data = normalize({ ...this.data, ...res.data }); return; }
        if (res.needLogin) { this.mode = 'login'; this.loginError = res.error === 'Chưa đăng nhập' ? '' : res.error; return; }
        console.warn('API chưa sẵn sàng → chạy DEMO:', res.error);
      } catch (e) { console.warn('Không gọi được /api → chạy DEMO'); }
      this.mode = 'demo';
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { }
      this.data = saved || seed();
      if (!this.data.MucTieu || (this.data.MucTieu[0] && !('sl_ma_mau' in this.data.MucTieu[0]))) this.data.MucTieu = seedTargets(this.data.KhachHang);   // dữ liệu demo cũ
      if (!this.data.SKU) { this.data.SKU = seedSku(); this.data.MucTieuSKU = seedSkuTargets(this.data.MucTieu); }
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
      if (res.ok) { this.missing = TABLES.filter(t => !Array.isArray(res.data[t])); this.data = normalize({ ...this.data, ...res.data }); }
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

    /* Lưu nhiều mục tiêu sản lượng một lần (mỗi KH × năm 1 dòng). Trả về { saved, errors } */
    async saveTargets(rows) {
      let result;
      if (this.mode === 'live') {
        const res = await call({ action: 'save_targets', rows });
        if (!res.ok) throw new Error(res.error);
        result = res.data;
      } else {
        const now = new Date().toISOString();
        result = { saved: [], errors: [] };
        rows.forEach(r => {
          const kh = this.get('KhachHang', r.khach_hang_id);
          if (!kh) return result.errors.push({ khach_hang_id: r.khach_hang_id, error: 'Không tìm thấy khách hàng' });
          const cur = this.data.MucTieu.find(t => String(t.nam) === String(r.nam) && t.khach_hang_id === kh.id);
          result.saved.push({ ...(cur || { id: uid(), ngay_tao: now }), ...r, ma_kh: kh.ma_kh, ten_kh: kh.ten, nvkd: kh.nvkd, nhom_kd: kh.nhom_kd, nguoi_cap_nhat: App.currentUser(), ngay_cap_nhat: now });
        });
      }
      result.saved.forEach(row => {
        const i = this.data.MucTieu.findIndex(t => String(t.id) === String(row.id));
        if (i >= 0) this.data.MucTieu[i] = { ...this.data.MucTieu[i], ...row }; else this.data.MucTieu.push(row);
      });
      this.persist();
      return result;
    },

    /**
     * Lưu mục tiêu theo SKU của khách hàng: rows [{ nam, khach_hang_id, ma_sku, mt, sl_nam_truoc?, xoa? }].
     * Máy chủ tự cộng mục tiêu SKU lên mục tiêu nhóm (Mạ màu / Mạ kẽm + Mạ lạnh). Trả về { saved, deleted, errors, targets }
     */
    async saveSkuTargets(rows) {
      let result;
      if (this.mode === 'live') {
        const res = await call({ action: 'save_sku_targets', rows });
        if (!res.ok) throw new Error(res.error);
        result = res.data;
      } else result = demoSaveSku(this, rows);
      const T = this.data.MucTieuSKU;
      this.data.MucTieuSKU = T.filter(x => !result.deleted.includes(x.id));
      result.saved.forEach(row => {
        const i = this.data.MucTieuSKU.findIndex(t => String(t.id) === String(row.id));
        if (i >= 0) this.data.MucTieuSKU[i] = { ...this.data.MucTieuSKU[i], ...row }; else this.data.MucTieuSKU.push(row);
      });
      result.targets.forEach(row => {
        const i = this.data.MucTieu.findIndex(t => String(t.id) === String(row.id));
        if (i >= 0) this.data.MucTieu[i] = { ...this.data.MucTieu[i], ...row }; else this.data.MucTieu.push(row);
      });
      this.persist();
      return result;
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

  /* Bản demo (không có máy chủ) của save_sku_targets — cùng quy tắc với Apps Script */
  function demoSaveSku(store, rows) {
    const now = new Date().toISOString(), who = App.currentUser();
    const res = { saved: [], deleted: [], errors: [], targets: [] };
    let list = store.data.MucTieuSKU.map(x => ({ ...x }));
    const touched = new Set();
    rows.forEach(r => {
      const kh = store.get('KhachHang', r.khach_hang_id);
      const sku = store.data.SKU.find(s => s.ma_sku === r.ma_sku);
      const isSku = x => x.ma_sku === r.ma_sku || (!x.ma_sku && sku && x.ten_sku === sku.ten_sku);
      const cur = list.find(x => String(x.nam) === String(r.nam) && x.khach_hang_id === r.khach_hang_id && isSku(x))
        || list.find(x => String(x.nam) === String(Number(r.nam) - 1) && x.khach_hang_id === r.khach_hang_id && isSku(x) && !(Number(x.mt) > 0));
      if (!kh || (!sku && !cur)) return res.errors.push({ ...r, error: !kh ? 'Không tìm thấy khách hàng' : 'Mã SKU không có trong danh mục' });
      touched.add(kh.id);
      if (r.xoa) {
        if (!cur) return;
        list = list.filter(x => x.id !== cur.id); res.deleted.push(cur.id);
        return;
      }
      const row = { ...(cur || { id: uid(), ngay_tao: now }), nam: String(r.nam), khach_hang_id: kh.id, ma_kh: kh.ma_kh, ten_kh: kh.ten, nvkd: kh.nvkd, nhom_kd: kh.nhom_kd,
        ma_sku: r.ma_sku, sku_id: sku ? sku.id : (cur.sku_id || ''), ten_sku: sku ? sku.ten_sku : cur.ten_sku, nhom_sp: sku ? sku.nhom : cur.nhom_sp, nguoi_cap_nhat: who, ngay_cap_nhat: now };
      ['mt', 'sl_nam_truoc', 'ghi_chu'].forEach(k => { if (r[k] !== undefined) row[k] = r[k]; });
      if (r.sl_nam_truoc === undefined && !(cur && Number(cur.sl_nam_truoc) > 0)) {
        const pv = list.find(x => x.khach_hang_id === kh.id && String(x.nam) === String(Number(r.nam) - 1) && x.ma_sku === r.ma_sku && !(Number(x.mt) > 0));
        if (pv) row.sl_nam_truoc = pv.sl_nam_truoc;
      }
      if (cur) Object.assign(cur, row); else list.push(row);
      res.saved.push(row);
    });
    touched.forEach(khId => {
      const nam = String(rows[0].nam), sums = {};
      list.filter(x => x.khach_hang_id === khId && String(x.nam) === nam && Number(x.mt) > 0).forEach(x => {
        const g = /màu/i.test(x.nhom_sp) ? 'mt_ma_mau' : 'mt_kem_lanh'; sums[g] = (sums[g] || 0) + Number(x.mt);
      });
      if (!Object.keys(sums).length) return;
      const kh = store.get('KhachHang', khId);
      const cur = store.data.MucTieu.find(t => String(t.nam) === nam && t.khach_hang_id === khId);
      Object.keys(sums).forEach(g => { sums[g] = Math.round(sums[g] * 1000) / 1000; });
      res.targets.push({ ...(cur || { id: uid(), ngay_tao: now, nam, khach_hang_id: khId, ma_kh: kh.ma_kh, ten_kh: kh.ten, nvkd: kh.nvkd, nhom_kd: kh.nhom_kd }), ...sums, ngay_cap_nhat: now });
    });
    return res;
  }

  /* SKU dán tay thiếu mã → lấy tên làm mã (máy chủ cũng tự ghi lại vào Sheet) */
  function normalize(d) {
    (d.SKU || []).forEach(s => { if (!String(s.ma_sku ?? '').trim() && String(s.ten_sku ?? '').trim()) s.ma_sku = String(s.ten_sku).trim(); });
    return d;
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
    d.MucTieu = seedTargets(d.KhachHang);
    d.SKU = seedSku();
    d.MucTieuSKU = seedSkuTargets(d.MucTieu);
    return d;
  }

  function seedSku() {
    return [
      ['MM-035-1070', 'Tôn mạ màu 0.35mm khổ 1070', 'Mạ màu', 'AZ50 · 0.35 x 1070'],
      ['MM-040-1200', 'Tôn mạ màu 0.40mm khổ 1200', 'Mạ màu', 'AZ70 · 0.40 x 1200'],
      ['MM-045-1200', 'Tôn mạ màu 0.45mm khổ 1200', 'Mạ màu', 'AZ70 · 0.45 x 1200'],
      ['MK-050-1200', 'Tôn mạ kẽm 0.50mm khổ 1200', 'Mạ kẽm', 'Z80 · 0.50 x 1200'],
      ['MK-100-1219', 'Tôn mạ kẽm 1.00mm khổ 1219', 'Mạ kẽm', 'Z120 · 1.00 x 1219'],
      ['ML-040-1200', 'Tôn mạ lạnh 0.40mm khổ 1200', 'Mạ lạnh', 'AZ100 · 0.40 x 1200'],
      ['ML-045-1200', 'Tôn mạ lạnh 0.45mm khổ 1200', 'Mạ lạnh', 'AZ100 · 0.45 x 1200'],
      ['ML-050-1219', 'Tôn mạ lạnh 0.50mm khổ 1219', 'Mạ lạnh', 'AZ150 · 0.50 x 1219'],
    ].map(([ma_sku, ten_sku, nhom, quy_cach], i) => ({ id: 'sku' + i, ma_sku, ten_sku, nhom, quy_cach, trang_thai: 'Đang bán', ghi_chu: '' }));
  }

  /* Demo: tách SL năm trước của mỗi KH ra 2 SKU mạ màu + 2 SKU kẽm/lạnh; KH đầu tiên đã đặt mục tiêu theo SKU */
  function seedSkuTargets(targets) {
    const out = [];
    const r1 = v => Math.round(v * 10) / 10;
    targets.slice(0, 12).forEach((t, i) => {
      const parts = [['MM-045-1200', 'Tôn mạ màu 0.45mm khổ 1200', 'Mạ màu', r1(t.sl_ma_mau * 0.6)], ['MM-040-1200', 'Tôn mạ màu 0.40mm khổ 1200', 'Mạ màu', r1(t.sl_ma_mau * 0.4)],
        ['MK-050-1200', 'Tôn mạ kẽm 0.50mm khổ 1200', 'Mạ kẽm', r1(t.sl_kem_lanh * 0.5)], ['ML-045-1200', 'Tôn mạ lạnh 0.45mm khổ 1200', 'Mạ lạnh', r1(t.sl_kem_lanh * 0.5)]];
      parts.forEach(([ma_sku, ten_sku, nhom_sp, sl], j) => out.push({
        id: `mts${i}_${j}`, nam: t.nam, khach_hang_id: t.khach_hang_id, ma_kh: t.ma_kh, ten_kh: t.ten_kh, nvkd: t.nvkd, nhom_kd: t.nhom_kd,
        ma_sku, ten_sku, nhom_sp, sl_nam_truoc: sl, mt: i === 0 ? Math.round(sl * 1.12) : '', ghi_chu: '', nguoi_cap_nhat: t.nvkd,
      }));
      if (i === 0) {
        const sum = g => out.filter(x => x.khach_hang_id === t.khach_hang_id && (g === 'mau') === /màu/i.test(x.nhom_sp)).reduce((a, x) => a + (Number(x.mt) || 0), 0);
        t.mt_ma_mau = sum('mau'); t.mt_kem_lanh = sum('kem');
      }
    });
    return out;
  }

  /* Demo: sản lượng (tấn) năm nay theo KH (năm mục tiêu = năm sau), vài KH đã nhập mục tiêu */
  function seedTargets(khList) {
    const nam = String(new Date().getFullYear() + 1);
    return (khList || []).filter((k, i) => i % 5 !== 4).map((k, i) => {
      const mau = (i % 4 + 1) * 120 + i * 7.5, kem = (i % 3 + 1) * 180 + i * 11;
      return {
        id: 'mt' + i, nam, khach_hang_id: k.id, ma_kh: k.ma_kh, ten_kh: k.ten, nvkd: k.nvkd, nhom_kd: k.nhom_kd,
        sl_ma_mau: mau, sl_kem_lanh: kem, mt_ma_mau: i % 3 === 0 ? Math.round(mau * 1.15) : '',
        mt_kem_lanh: i % 3 === 0 ? Math.round(kem * 1.1) : '', ghi_chu: '', nguoi_cap_nhat: k.nvkd,
      };
    });
  }

  window.Store = Store;
})();
