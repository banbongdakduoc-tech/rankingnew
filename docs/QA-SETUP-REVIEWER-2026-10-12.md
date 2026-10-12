# QA tạo bảng và admin phụ — 12/10/2026

Nhánh demo. Toàn bộ `npm run check`: **106/106 test đạt**, không fail/skip; lint/build đạt.

## Tạo bảng

Nguyên nhân: Firebase Realtime Database bỏ trường mảng rỗng `teams: []`. Dữ liệu đọc lại thiếu `teams` bị validator coi là bảng không hợp lệ, kể cả khi người dùng chỉ lưu cấu hình.

Sửa: chuẩn hóa bảng thiếu danh sách đội thành danh sách rỗng khi khởi tạo/đọc trạng thái; giữ kiểm tra loại dữ liệu, tên bảng trùng và đội trùng. Ghi cấu hình, bảng, trạng thái setup bằng một lệnh nguyên tử, tránh lưu một phần khi lỗi. Sửa giới hạn frontend để hỗ trợ đúng 1/2/4 bảng như backend.

Kiểm tra: 1/2/4 bảng; vòng tròn League; giả lập Firebase xóa trường đội rỗng rồi thêm đội; cấu hình sai không đổi trạng thái; bảng trùng vẫn bị chặn.

## Admin phụ

Admin chính → Tài khoản tác nghiệp → chọn Admin phụ · Duyệt biên bản → tạo tài khoản. Người nhận đăng nhập `/btc`.

Vai trò `approver`: chỉ thao tác trên biên bản Chờ duyệt, sửa trường nội dung cho phép, duyệt/trả biên bản, đọc chữ ký/ghi chú của biên bản chờ duyệt. Giao diện riêng dùng chung bộ đối chiếu với admin chính.

Máy chủ chặn: tạo tài khoản, xuất/phục hồi backup, reset, thay cấu hình/đội/cầu thủ/kỷ luật/lịch/đội hình/chữ ký, tự tác nghiệp LIVE, tạo trận, mở lại trận đã duyệt hoặc tự cấp toàn quyền. Chỉ admin chính được tạo tài khoản; endpoint chỉ nhận vai trò referee hoặc approver.

Kiểm tra: tạo tài khoản/API, bcrypt/login, quyền admin phụ duyệt/trả, nguyên trạng không cần ghi chú, sửa nội dung cần lý do, retry không trùng, DTO không lộ account/hash và hạn chế các lệnh kể cả gọi API trực tiếp.

Preview local đã kiểm tra chọn vai trò admin phụ, danh sách chờ duyệt và mở hộp duyệt có đủ nút in/trả/duyệt. Không tạo mật khẩu/tài khoản thật hoặc duyệt biên bản cloud thay người dùng.

Các test API dùng server local/bộ nhớ. Các bài kiểm tra mùa giải, BXH/H2H, knockout, luân lưu, kỷ luật, đồng hồ/nháp và sao lưu trước đó cũng được chạy lại cùng bộ 106 test.
