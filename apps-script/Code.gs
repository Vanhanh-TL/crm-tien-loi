/**
 * BACKEND CRM TIẾN LỢI — chạy trên Google Apps Script, dữ liệu nằm trong Google Sheet.
 *
 * Cách dùng (chi tiết trong README.md):
 *  1. Tạo Google Sheet mới → Tiện ích mở rộng → Apps Script → dán toàn bộ file này.
 *  2. Project Settings → Script properties → thêm  API_TOKEN = <chuỗi bí mật tự đặt>.
 *  3. Chạy hàm setupSheets() một lần (tạo các tab + dữ liệu mẫu).
 *  4. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 *
 * Mỗi tab là một "bảng"; dòng 1 là tên cột; cột đầu tiên luôn là `id`.
 */

var SCHEMA = {
  KhachHang: ['id', 'ma_kh', 'ten', 'loai', 'mst', 'nguoi_lien_he', 'chuc_vu', 'sdt', 'email', 'dia_chi',
    'tinh', 'nhom_kd', 'nvkd', 'nguon', 'trang_thai', 'diem', 'ghi_chu', 'ngay_tao', 'ngay_cap_nhat'],
  CoHoi: ['id', 'ten', 'khach_hang_id', 'ten_kh', 'gia_tri', 'giai_doan', 'xac_suat', 'ngay_du_kien',
    'nvkd', 'ghi_chu', 'ngay_tao', 'ngay_cap_nhat'],
  ThiTruong: ['id', 'ngay', 'nvkd', 'tinh', 'khu_vuc', 'loai_thong_tin', 'doi_thu', 'san_pham', 'gia',
    'noi_dung', 'muc_do', 'link_anh', 'ngay_tao', 'ngay_cap_nhat'],
  KeHoach: ['id', 'thang', 'nvkd', 'tinh', 'khu_vuc', 'muc_tieu_doanh_so', 'thuc_hien_doanh_so',
    'muc_tieu_kh_moi', 'thuc_hien_kh_moi', 'so_luot_tham', 'hoat_dong', 'trang_thai', 'ghi_chu',
    'ngay_tao', 'ngay_cap_nhat'],
  Telesale: ['id', 'ngay', 'nhan_vien', 'khach_hang_id', 'ten_kh', 'sdt', 'ket_qua', 'thoi_luong_phut',
    'hen_goi_lai', 'ghi_chu', 'ngay_tao', 'ngay_cap_nhat'],
  HoatDong: ['id', 'thoi_gian', 'loai', 'doi_tuong', 'doi_tuong_id', 'noi_dung', 'nguoi_thuc_hien',
    'ngay_tao', 'ngay_cap_nhat'],
  NhanVien: ['id', 'ten', 'email', 'sdt', 'nhom_kd', 'vai_tro', 'trang_thai', 'ngay_tao', 'ngay_cap_nhat']
};

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

function doGet(e) {
  return handle_(e.parameter || {}, null);
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) { return json_({ ok: false, error: 'JSON không hợp lệ' }); }
  return handle_(e.parameter || {}, body);
}

function handle_(params, body) {
  var req = body || params;
  var token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!token || req.token !== token) return json_({ ok: false, error: 'Sai token' });

  var action = req.action;
  try {
    if (action === 'ping') return json_({ ok: true, data: 'pong' });
    if (action === 'all') return json_({ ok: true, data: readAll_() });
    if (action === 'otp_request') return json_(otpRequest_(req.email));
    if (action === 'otp_verify') return json_(otpVerify_(req.email, req.code));
    if (action === 'check_user') return json_(checkUser_(req.email));

    var sheet = req.sheet;
    if (!SCHEMA[sheet]) return json_({ ok: false, error: 'Bảng không tồn tại: ' + sheet });

    var lock = LockService.getScriptLock();
    if (action !== 'list') lock.waitLock(20000);
    try {
      switch (action) {
        case 'list': return json_({ ok: true, data: readSheet_(sheet) });
        case 'create': return json_({ ok: true, data: createRow_(sheet, req.data || {}) });
        case 'update': return json_({ ok: true, data: updateRow_(sheet, req.id, req.data || {}) });
        case 'delete': return json_({ ok: true, data: deleteRow_(sheet, req.id) });
        default: return json_({ ok: false, error: 'Action không hợp lệ: ' + action });
      }
    } finally {
      if (action !== 'list') lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* ĐĂNG NHẬP BẰNG MÃ OTP QUA EMAIL                                     */
/* Được vào: email có đuôi trong ALLOWED_DOMAINS (mặc định             */
/* tienloigroup.vn) HOẶC email có trong tab NhanVien.                  */
/* Nhân viên có trạng thái "Nghỉ việc" bị chặn.                        */
/* ------------------------------------------------------------------ */

function findUser_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Email không hợp lệ' };
  var staff = readSheet_('NhanVien').filter(function (n) { return String(n.email).trim().toLowerCase() === email; })[0];
  if (staff && staff.trang_thai === 'Nghỉ việc') return { ok: false, error: 'Tài khoản đã ngừng hoạt động' };
  var domains = (PropertiesService.getScriptProperties().getProperty('ALLOWED_DOMAINS') || 'tienloigroup.vn')
    .split(',').map(function (d) { return d.trim().toLowerCase(); }).filter(String);
  var domainOk = domains.indexOf(email.split('@')[1]) >= 0;
  if (!staff && !domainOk) return { ok: false, error: 'Email này chưa được cấp quyền. Liên hệ quản trị để được thêm vào danh sách Nhân viên.' };
  return { ok: true, email: email, ten: staff ? staff.ten : '' };
}

function checkUser_(email) {
  var u = findUser_(email);
  return u.ok ? { ok: true, data: { email: u.email, ten: u.ten } } : u;
}

function otpRequest_(email) {
  var u = findUser_(email);
  if (!u.ok) return u;
  var cache = CacheService.getScriptCache();
  if (cache.get('otp_wait:' + u.email)) return { ok: false, error: 'Vừa gửi mã, vui lòng đợi 1 phút rồi thử lại.' };
  var code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('otp:' + u.email, JSON.stringify({ code: code, tries: 0 }), 600);
  cache.put('otp_wait:' + u.email, '1', 60);
  MailApp.sendEmail({
    to: u.email,
    subject: 'Mã đăng nhập CRM TIẾN LỢI: ' + code,
    htmlBody: '<p>Xin chào ' + (u.ten || '') + ',</p><p>Mã đăng nhập CRM TIẾN LỢI của bạn là:</p>' +
      '<p style="font-size:28px;font-weight:700;letter-spacing:4px">' + code + '</p>' +
      '<p>Mã có hiệu lực 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>'
  });
  return { ok: true, data: { email: u.email } };
}

function otpVerify_(email, code) {
  email = String(email || '').trim().toLowerCase();
  var cache = CacheService.getScriptCache();
  var raw = cache.get('otp:' + email);
  if (!raw) return { ok: false, error: 'Mã đã hết hạn, vui lòng gửi lại mã mới.' };
  var st = JSON.parse(raw);
  st.tries++;
  if (String(code || '').trim() !== st.code) {
    if (st.tries >= 5) { cache.remove('otp:' + email); return { ok: false, error: 'Nhập sai quá 5 lần, vui lòng gửi lại mã mới.' }; }
    cache.put('otp:' + email, JSON.stringify(st), 600);
    return { ok: false, error: 'Mã không đúng (còn ' + (5 - st.tries) + ' lần thử).' };
  }
  cache.remove('otp:' + email);
  var u = findUser_(email);
  return u.ok ? { ok: true, data: { email: u.email, ten: u.ten } } : u;
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function readSheet_(name) {
  var sh = getSheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var head = headers_(sh);
  var values = sh.getRange(2, 1, last - 1, head.length).getValues();
  var tz = Session.getScriptTimeZone();
  return values.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    var o = {};
    head.forEach(function (h, i) {
      var v = r[i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm");
      o[h] = v;
    });
    return o;
  });
}

function readAll_() {
  var out = {};
  Object.keys(SCHEMA).forEach(function (k) { out[k] = readSheet_(k); });
  return out;
}

function createRow_(name, data) {
  var sh = getSheet_(name);
  var head = headers_(sh);
  var now = new Date().toISOString();
  data.id = data.id || Utilities.getUuid().slice(0, 8);
  data.ngay_tao = data.ngay_tao || now;
  data.ngay_cap_nhat = now;
  // Ghi dạng văn bản thuần để Sheet không tự đổi SĐT "09..." thành số, "2026-11" thành ngày…
  var row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, head.length).setNumberFormat('@')
    .setValues([head.map(function (h) { return data[h] === undefined || data[h] === null ? '' : String(data[h]); })]);
  return data;
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function updateRow_(name, id, data) {
  var sh = getSheet_(name);
  var row = findRow_(sh, id);
  if (row < 0) throw new Error('Không tìm thấy id ' + id);
  var head = headers_(sh);
  var range = sh.getRange(row, 1, 1, head.length);
  var cur = range.getValues()[0];
  data.ngay_cap_nhat = new Date().toISOString();
  var next = head.map(function (h, i) {
    var v = (h !== 'id' && data[h] !== undefined && data[h] !== null) ? data[h] : cur[i];
    return v instanceof Date ? v : String(v);
  });
  range.setNumberFormat('@').setValues([next]);
  var o = {};
  head.forEach(function (h, i) { o[h] = next[i]; });
  return o;
}

function deleteRow_(name, id) {
  var sh = getSheet_(name);
  var row = findRow_(sh, id);
  if (row < 0) throw new Error('Không tìm thấy id ' + id);
  sh.deleteRow(row);
  return { id: id };
}

/* ------------------------------------------------------------------ */
/* KHỞI TẠO — chạy tay 1 lần trong trình soạn Apps Script              */
/* ------------------------------------------------------------------ */

function setupSheets() {
  Object.keys(SCHEMA).forEach(function (name) { getSheet_(name); });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  if (readSheet_('NhanVien').length === 0) {
    [['Thu Hà', 'Nhóm KD1', 'Trưởng nhóm'], ['Hoàng Nam', 'Nhóm KD1', 'NVKD'],
     ['Khánh Duy', 'Nhóm KD2', 'NVKD'], ['Mai Anh', 'Telesale', 'Telesale']].forEach(function (r) {
      createRow_('NhanVien', { ten: r[0], nhom_kd: r[1], vai_tro: r[2], trang_thai: 'Đang làm' });
    });
  }
  if (readSheet_('KhachHang').length === 0) {
    createRow_('KhachHang', { ma_kh: 'KH-0001', ten: 'Công ty TNHH An Phát', loai: 'Pháp nhân', tinh: 'Hà Nội',
      nhom_kd: 'Nhóm KD1', nvkd: 'Thu Hà', nguoi_lien_he: 'Thu Trang', sdt: '0901000001',
      trang_thai: 'Tiềm năng', diem: 'A', nguon: 'Đi thị trường' });
  }
  Logger.log('Đã tạo xong các tab dữ liệu CRM.');
  try { SpreadsheetApp.getUi().alert('Đã tạo xong các tab dữ liệu CRM.'); } catch (e) { /* chạy từ trình soạn thảo: không có UI */ }
}
