# Dược Premier League · Demo v2

Giữ giao diện Stadium nền tối, xanh neon/vàng của dự án. Ba cổng: khán giả `/`, thư ký `/thuky`, BTC `/btc`.

[Hướng dẫn sử dụng theo từng cổng và nhánh knockout](docs/HUONG-DAN-SU-DUNG-DPL.md).

## Chạy và kiểm tra

Node.js 22.12+ hoặc 24, `npm ci`, `npm run check`. Frontend `npm run dev`; backend `npm run server`. Cấu hình theo `.env.example` và [hướng dẫn triển khai](DEPLOY_GUIDE.md).

Demo local tách khỏi giải thật:

1. Tạo `.env.demo.local` (được Git bỏ qua), đặt `DB_MODE=file`, `DPL_DB_FILE=/private/tmp/dpl-demo-qa.json`, `DPL_DEMO_PASSWORD` tối thiểu 12 ký tự, `JWT_SECRET` ngẫu nhiên tối thiểu 32 ký tự, `PORT=5051`, `CLIENT_URL=http://127.0.0.1:5173,http://localhost:5173`, `VITE_API_URL=http://127.0.0.1:5051`.
2. `node --env-file=.env.demo.local server/scripts/seed-demo.js` tạo dữ liệu mẫu và hai tài khoản `admin`, `thuky`. Script từ chối ghi đè file hiện có. Mật khẩu lấy từ biến môi trường trên.
3. `node --env-file=.env.demo.local server/index.js`, rồi `npm run dev -- --host 127.0.0.1 --mode demo` ở terminal khác.

## Hành vi chính

- Server xác thực JWT, bcrypt và quyền theo trận được phân công. Frontend không đọc/ghi trực tiếp Firebase. API công khai không có tài khoản, chữ ký hay ghi chú riêng.
- BXH chính thức chỉ dùng trận được duyệt. Khán giả xem bảng phụ đối đầu nhiều đội; không có chế độ BXH tạm tính ở cổng khán giả.
- Event có ID, phút/hiệp/bù giờ; phản lưới tính cho đối phương; luân lưu lưu riêng từng lượt. Hai vàng cùng trận chuẩn hóa thành truất quyền, tách khỏi tích lũy qua trận.
- Nháp thư ký lưu IndexedDB/localStorage theo tài khoản. F5 khôi phục đồng hồ mốc thời gian, sự kiện và chữ ký. Kết nối lại gửi hàng đợi có chống lặp, hiển thị xung đột để xử lý. Nộp/duyệt cần online.
- Ba chữ ký gắn với nội dung biên bản. BTC xử lý ngoại lệ có lý do; mở lại có lưu phiên bản, khóa nhánh phụ thuộc và chặn khi vòng sau đã bắt đầu.
- Import cầu thủ có kiểm tra, xem trước, gộp/thay và hoàn tác lần nhập gần nhất. Cắt vuông/xoay/nén ảnh ngay trong trình duyệt.
- Hồ sơ mùa giải lưu khi reset; thống kê lọc vòng bảng/knockout, lịch nhập theo giờ Việt Nam và lưu UTC.
- Backup schema 2 được kiểm tra trước phục hồi; tài khoản giữ nguyên. Tự lưu tối đa 5 bản trước thao tác thay dữ liệu.

[QA ban đầu](docs/QA-DPL-2026.md) và [kết quả kiểm thử bản sửa](docs/QA-DEMO-RESULTS.md). Không thể chứng minh phần mềm không còn mọi lỗi chỉ bằng bộ kiểm thử; các giới hạn triển khai và kiểm thử được ghi rõ trong báo cáo.
