# CRM Tiến Lợi

CRM nội bộ chạy trên **GitHub + Cloudflare Workers**, dữ liệu nằm trong **Google Sheet** (qua Google Apps Script, không cần Google Cloud API key).

```
Trình duyệt ──► Cloudflare Worker (src/worker.js) giao diện từ public/
                 └─► /api  (functions/api.js)     giấu URL + token
                        └─► Google Apps Script (apps-script/Code.gs)
                               └─► Google Sheet  (mỗi tab = 1 bảng)
```

## Phân hệ

| Menu | Chức năng |
|---|---|
| Tổng quan CRM | KPI, pipeline theo giai đoạn, kế hoạch tháng, telesale 7 ngày, lịch gọi lại, hoạt động gần đây |
| Khách hàng | Lọc theo NVKD / nhóm KD / tỉnh / trạng thái, cảnh báo thiếu thông tin, hồ sơ chi tiết + hành trình tương tác, xuất CSV |
| Pipeline bán hàng | Kanban 6 giai đoạn, kéo thả, dự báo theo xác suất, tỷ lệ thắng |
| Telesale | Hàng đợi "cần gọi lại" / "chưa từng gọi", ghi kết quả 1 chạm, hẹn gọi lại, nhật ký cuộc gọi |
| Mục tiêu sản lượng | Theo từng khách hàng, đơn vị **tấn**: sản lượng năm trước (Mạ màu; Mạ kẽm + Mạ lạnh) bên cạnh ô nhập mục tiêu năm sau, % tăng trưởng, tổng. **Có phân quyền** (xem dưới) |
| Mục tiêu theo SKU | Nút **+** ở cột *Mục tiêu SKU*: chọn SKU từ danh mục, xem SL năm trước của KH theo SKU, nhập mục tiêu (tấn). MT nhóm của KH tự = tổng MT các SKU trong nhóm |
| Danh mục SKU | Mã, tên, nhóm (Mạ màu / Mạ kẽm / Mạ lạnh), quy cách, trạng thái. Mọi nhân viên thêm được SKU mới (cả ngay trong popup mục tiêu SKU); chỉ Quản lý sửa / ngừng bán |
| Thu thập thị trường | NVKD ghi nhận tin đối thủ, giá, nhu cầu, KH mới; thống kê theo tỉnh / người thu thập |
| Kế hoạch thị trường | Mục tiêu theo tháng × NVKD × khu vực, tiến độ, đối chiếu với số liệu CRM tự đếm, sao chép từ tháng trước |
| Nhân viên | Danh sách nhân viên dùng cho các ô chọn người phụ trách |

## Chạy thử trên máy (chế độ demo)

Cần Node.js. Không cần Google Sheet, dữ liệu mẫu lưu trong trình duyệt.

```powershell
node dev-server.js
```

Mở http://localhost:8788. Có thể bấm **Làm mới** ở góc trái dưới để tạo lại dữ liệu mẫu.

## Triển khai thật

### Bước 1. Tạo Google Sheet + Apps Script
1. Tạo Google Sheet mới, đặt tên ví dụ `CRM Tiến Lợi - Data`.
2. Menu **Tiện ích mở rộng → Apps Script**. Xóa nội dung mặc định, dán toàn bộ `apps-script/Code.gs`, bấm Lưu.
3. Biểu tượng bánh răng **Project Settings → Script properties → Add script property**:
   `API_TOKEN` = một chuỗi bí mật dài (ví dụ 32 ký tự ngẫu nhiên). Ghi lại chuỗi này.
4. Chọn hàm `setupSheets` ở thanh trên → **Run** → cấp quyền. Sheet sẽ có 7 tab: KhachHang, CoHoi, ThiTruong, KeHoach, Telesale, HoatDong, NhanVien.
5. **Deploy → New deployment → Web app**: *Execute as* = **Me**, *Who has access* = **Anyone** → Deploy. Copy **Web app URL** (dạng `https://script.google.com/macros/s/.../exec`).

> Mỗi lần sửa `Code.gs`, vào **Deploy → Manage deployments → Edit → Version: New version** để URL giữ nguyên.

### Bước 2. Đưa code lên GitHub
Tạo repo **private** mới trên GitHub (ví dụ `crm-tien-loi`), rồi đẩy thư mục này lên (bằng GitHub Desktop hoặc git).

### Bước 3. Cloudflare Workers
1. Đăng nhập https://dash.cloudflare.com → **Workers & Pages → Create application → Import a repository** → chọn repo `crm-tien-loi`.
2. Màn hình cấu hình:
   - *Project name* = **`crm-tien-loi`** (phải trùng `name` trong `wrangler.jsonc`)
   - *Build command* = để trống
   - *Deploy command* = `npx wrangler deploy` (mặc định)
   - *Preview command* = `npx wrangler preview` (mặc định)
   - *Path* = `/`
   - Bấm **Deploy**. Địa chỉ sẽ dạng `https://crm-tien-loi.<tài-khoản>.workers.dev`.
3. Vào Worker → **Settings → Variables and Secrets → Add**, chọn loại **Secret** cho cả hai:
   - `APPS_SCRIPT_URL` = Web app URL ở bước 1
   - `API_TOKEN` = chuỗi bí mật ở bước 1
4. Tải lại trang. Góc trái dưới giao diện sẽ hiện **Google Sheet** (xanh) thay vì **Chế độ demo**.

> Thư mục `functions/` vẫn tương thích Cloudflare Pages nếu sau này muốn dùng Pages (build output = `public`).

### Bước 4. Đăng nhập (có sẵn, không cần cấu hình thêm)
Khi đã nối Google Sheet, CRM yêu cầu đăng nhập bằng **mã 6 số gửi qua email** (gửi từ tài khoản Google sở hữu Sheet, qua Apps Script).

| Ai được vào | Cách cấp quyền |
|---|---|
| Email đuôi `@tienloigroup.vn` | Tự động được vào |
| Email khác (Gmail…) | Thêm 1 dòng vào trang **Nhân viên** (hoặc tab `NhanVien` trong Sheet) có cột **email** |
| Chặn một người | Đổi trạng thái nhân viên thành **Nghỉ việc** (bị đăng xuất ở lần mở app kế tiếp) |

- Đổi/thêm đuôi email được phép: Script properties → `ALLOWED_DOMAINS` = `tienloigroup.vn,congtykhac.vn`.
- Phiên đăng nhập giữ 7 ngày. Mã hết hạn sau 10 phút, sai 5 lần phải gửi mã mới.
- Giới hạn gửi mail của Google: 100 mail/ngày (Gmail cá nhân) hoặc 1.500 mail/ngày (Google Workspace).

### Bước 5. Phân quyền trang Mục tiêu sản lượng
Quyền được kiểm tra ở Apps Script theo **email đăng nhập ↔ tab NhanVien** (cột `email`, `ten`, `vai_tro`, `nhom_kd`), và **cột `nvkd` của khách hàng phải trùng đúng `ten` của nhân viên**.

| Vai trò (`vai_tro`) | Thấy / nhập mục tiêu của | Nhập SL năm trước | Sửa danh sách Nhân viên |
|---|---|---|---|
| Quản lý | Tất cả khách hàng | ✅ | ✅ |
| Trưởng nhóm | KH của mình + KH thuộc cùng `nhom_kd` | ❌ | ❌ |
| NVKD / Telesale | Chỉ KH có NVKD phụ trách = mình | ❌ | ❌ |
| Email chưa có trong NhanVien | Không thấy gì | ❌ | ❌ |

- **Lần đầu:** khi chưa có ai là "Quản lý", bất kỳ ai cũng sửa được trang Nhân viên → hãy thêm chính mình với vai trò **Quản lý** (đúng email đăng nhập). Từ đó chỉ Quản lý sửa được.
- Chỉ Quản lý / Trưởng nhóm được đổi "NVKD phụ trách" của khách hàng (tránh NVKD tự chuyển khách về mình).
- **Sản lượng năm trước (tấn):** Quản lý gõ trực tiếp trên trang, hoặc dán vào tab `MucTieu` trong Sheet: mỗi dòng ghi `nam` (năm mục tiêu, vd `2027`), `ma_kh`, `sl_ma_mau`, `sl_kem_lanh`. Để trống cột `id` (tự sinh). Không cần điền `khach_hang_id`, hệ thống tự khớp theo `ma_kh`.
- Đơn vị: tấn (đổi ở `OPT.dvSanLuong` trong `public/js/schema.js`). Số lẻ gõ bằng dấu phẩy, vd `12,5`; trong Sheet số lưu dạng `12.5`.
- **Mục tiêu theo SKU** (tab `MucTieuSKU`, mỗi dòng = 1 KH × 1 SKU × 1 năm): cùng quy tắc phân quyền. Dán SL năm trước theo SKU vào Sheet với các cột `nam`, `ma_kh`, `ma_sku`, `sl_nam_truoc`. Mã SKU phải có trong tab `SKU`.
  - Khi KH có ít nhất 1 SKU đặt mục tiêu trong nhóm, MT nhóm (Mạ màu hoặc Mạ kẽm + Mạ lạnh) tự bằng tổng các SKU và không sửa tay được nữa.
  - NVKD bỏ 1 SKU đã có SL năm trước thì chỉ xóa mục tiêu, giữ lại SL; Quản lý xóa được hẳn dòng.
- Các trang khác (Khách hàng, Pipeline…) hiện vẫn cho mọi người đã đăng nhập xem.

## Sửa / mở rộng
- Thêm trường dữ liệu: thêm cột vào `SCHEMA` trong `Code.gs` (và cột tương ứng ở dòng 1 của tab trong Sheet), thêm vào `fields` trong `public/js/schema.js`.
- Danh mục lựa chọn (nguồn KH, nhóm KD, giai đoạn, kết quả gọi…): sửa `OPT` trong `public/js/schema.js`.
- Có thể sửa / dán dữ liệu trực tiếp trên Google Sheet; bấm **Tải lại** trên giao diện để cập nhật.
- **Cột `id` tự sinh:** dòng dán vào Sheet mà để trống `id` sẽ được tự điền mã (khi dán, khi mở CRM, hoặc menu **CRM TIẾN LỢI → Tạo ID cho các dòng còn thiếu** trên Sheet). Dòng không có `id` thì CRM không hiển thị.
- **Dán vào mà CRM không hiện?** Trên Sheet chọn menu **CRM TIẾN LỢI → Kiểm tra dữ liệu**: báo tên cột sai, `ma_kh` / `ma_sku` không khớp, NVKD không trùng tên trong tab NhanVien, nhân viên thiếu email… (Lần đầu: dán Code.gs mới, tải lại trang Sheet để menu hiện ra.)

## Giới hạn cần biết
- Phù hợp khoảng vài chục nghìn dòng và dưới ~20 người thao tác đồng thời. Mỗi lần ghi mất khoảng 1–2 giây.
- Khi vượt ngưỡng: chuyển dữ liệu sang Cloudflare D1, chỉ cần viết lại `functions/api.js`, giao diện giữ nguyên.
