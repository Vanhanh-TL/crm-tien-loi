/**
 * BACKEND CRM TIỆN LỢI — chạy trên Google Apps Script, dữ liệu nằm trong Google Sheet.
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
  SpreadsheetApp.getUi().alert('Đã tạo xong các tab dữ liệu CRM.');
}
