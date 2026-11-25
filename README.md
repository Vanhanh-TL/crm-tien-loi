# CRM Tiện Lợi

CRM nội bộ chạy trên **GitHub + Cloudflare Pages**, dữ liệu nằm trong **Google Sheet** (qua Google Apps Script, không cần Google Cloud API key).

```
Trình duyệt ──► Cloudflare Pages (public/)        giao diện
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
1. Tạo Google Sheet mới, đặt tên ví dụ `CRM Tiện Lợi - Data`.
2. Menu **Tiện ích mở rộng → Apps Script**. Xóa nội dung mặc định, dán toàn bộ `apps-script/Code.gs`, bấm Lưu.
3. Biểu tượng bánh răng **Project Settings → Script properties → Add script property**:
   `API_TOKEN` = một chuỗi bí mật dài (ví dụ 32 ký tự ngẫu nhiên). Ghi lại chuỗi này.
4. Chọn hàm `setupSheets` ở thanh trên → **Run** → cấp quyền. Sheet sẽ có 7 tab: KhachHang, CoHoi, ThiTruong, KeHoach, Telesale, HoatDong, NhanVien.
5. **Deploy → New deployment → Web app**: *Execute as* = **Me**, *Who has access* = **Anyone** → Deploy. Copy **Web app URL** (dạng `https://script.google.com/macros/s/.../exec`).

> Mỗi lần sửa `Code.gs`, vào **Deploy → Manage deployments → Edit → Version: New version** để URL giữ nguyên.

### Bước 2. Đưa code lên GitHub
Tạo repo **private** mới trên GitHub (ví dụ `crm-tien-loi`), rồi đẩy thư mục này lên (bằng GitHub Desktop hoặc git).

### Bước 3. Cloudflare Pages
1. Đăng nhập https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → chọn repo.
2. Build settings: *Framework preset* = **None**, *Build command* = để trống, *Build output directory* = `public`.
3. **Settings → Variables and Secrets** (Production) thêm:
   - `APPS_SCRIPT_URL` = Web app URL ở bước 1
   - `API_TOKEN` = chuỗi bí mật ở bước 1 (chọn loại *Secret*)
4. Deploy lại. Góc trái dưới giao diện sẽ hiện **Google Sheet** (xanh) thay vì **Chế độ demo**.

### Bước 4. Giới hạn người được truy cập (khuyến nghị)
**Cloudflare Zero Trust → Access → Applications → Add → Self-hosted**, domain = `<tên>.pages.dev`, policy *Allow* với *Emails ending in* `@tienloigroup.vn`. Nhân viên đăng nhập bằng mã OTP gửi về email. Miễn phí tới 50 người.

## Sửa / mở rộng
- Thêm trường dữ liệu: thêm cột vào `SCHEMA` trong `Code.gs` (và cột tương ứng ở dòng 1 của tab trong Sheet), thêm vào `fields` trong `public/js/schema.js`.
- Danh mục lựa chọn (nguồn KH, nhóm KD, giai đoạn, kết quả gọi…): sửa `OPT` trong `public/js/schema.js`.
- Có thể sửa dữ liệu trực tiếp trên Google Sheet; bấm **Tải lại** trên giao diện để cập nhật.

## Giới hạn cần biết
- Phù hợp khoảng vài chục nghìn dòng và dưới ~20 người thao tác đồng thời. Mỗi lần ghi mất khoảng 1–2 giây.
- Khi vượt ngưỡng: chuyển dữ liệu sang Cloudflare D1, chỉ cần viết lại `functions/api.js`, giao diện giữ nguyên.
