# Triển khai main trên Vercel và Firebase bxh-football

Frontend: https://duoc-premier-league-demo.vercel.app (tên project vẫn có chữ demo; nhánh mã là main).

## Vercel

- Production branch: `main`.
- `VITE_API_URL`: `https://duoc-premier-league-backend.onrender.com`, loại Config, Production.
- Build: `npm run build`; output: `dist`; cấu hình SPA đã có trong `vercel.json`.
- Redeploy sau khi lưu biến để URL mới được đưa vào JavaScript.

## Render main

Service: `duoc-premier-league-backend`, ID `srv-daaqujp5efls73b7fagg`, branch `main`.

| Biến | Giá trị |
|---|---|
| NODE_ENV | production |
| DB_MODE | firebase |
| DPL_DEPLOYMENT_ENV | production |
| DPL_DATABASE_PATH | / |
| FIREBASE_DATABASE_URL | https://bxh-football-default-rtdb.firebaseio.com |
| DPL_PRODUCTION_DATABASE_URL | https://bxh-football-default-rtdb.firebaseio.com |
| CLIENT_URL | https://duoc-premier-league-demo.vercel.app |
| TRUST_PROXY_HOPS | 1 |
| FIREBASE_SERVICE_ACCOUNT_JSON | Chủ tài khoản tự nhập nội dung service account JSON của project bxh-football trong Render; không gửi vào chat/Git. |
| JWT_SECRET | Giữ secret hiện tại nếu ít nhất 32 ký tự; nếu thiếu/không đủ, chủ tài khoản tự tạo và nhập secret mới trên Render. |

Xuất JSON sao lưu Firebase main trước khi khởi động backend mới. Không import dữ liệu demo vào main.

Backend khởi động sẽ chuyển cấu trúc cũ sang schema mới trong transaction: thêm ID/version, chuẩn hóa ngày, chuyển mật khẩu cũ sang bcrypt. Đây là migration có ghi dữ liệu, không phải chỉ đọc. Các trường dữ liệu ngoài schema được giữ lại. Tài khoản phải có role admin/referee/approver và mật khẩu/mã băm hợp lệ.

Mặc định vẫn là môi trường demo và không cho dùng root. Main phải khai báo production và xác nhận đúng URL database để tránh vô tình trỏ sai dữ liệu.

## Xác nhận sau triển khai

1. Render deploy Live, `/api/health` trả `schemaVersion: 2`.
2. Vercel deploy mới từ main Ready; `/`, `/btc`, `/thuky` tải trực tiếp không 404.
3. Trang khán giả có dữ liệu Firebase main và trạng thái kết nối xanh.
4. Chủ tài khoản tự đăng nhập admin main và kiểm tra danh sách đội/trận. Không tạo/xóa trận giả trong main để thử.

Không chuyển backend sang file local trên Render Free vì dữ liệu file có thể mất khi restart.
