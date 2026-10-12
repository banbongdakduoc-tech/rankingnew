# Rà soát bảo mật dữ liệu và tài khoản — 12/10/2026

Phạm vi: mã main, thư viện npm, Firebase bxh-football Rules, API main chỉ đọc và kiểm thử tài khoản giả cục bộ. Không dò mật khẩu, tạo/xóa tài khoản thật hay sửa kết quả thi đấu để kiểm tra. Đây là rà soát có giới hạn, không phải chứng nhận an toàn tuyệt đối hoặc pentest đầy đủ.

## Critical — Đã xử lý quyền Firebase công khai

- Trước kiểm tra: Rules gốc `.read: true`, `.write: true`. Người không đăng nhập có thể truy cập trực tiếp database, bỏ qua toàn bộ kiểm tra API. Nhánh tài khoản và biên bản cũng chịu quyền gốc này.
- Sau khi chủ tài khoản đồng ý, đã Publish `.read: false`, `.write: false` trên project bxh-football. Không xóa dữ liệu.
- Xác nhận thực tế: GET `/accounts.json?shallow=true` không có thông tin xác thực trả HTTP 401 Permission denied. Không thử ghi trái phép vào database thật.
- Backend sử dụng Admin SDK và vẫn hoạt động: API health HTTP 200, schemaVersion 2; web Vercel kết nối thành công.
- Không thể xác định có ai từng tải/sửa dữ liệu trước khi khóa từ các bằng chứng hiện có. Nên đổi mật khẩu các tài khoản từng tồn tại trong giai đoạn Rules mở, đặc biệt nếu tái sử dụng mật khẩu ở dịch vụ khác. Việc đổi mật khẩu/nhập thông tin xác thực phải do chủ tài khoản thực hiện. Chỉ xóa trường password sau migration không thu hồi thông tin đã bị tải trước đó.
- Tài liệu: https://firebase.google.com/docs/database/security ; https://firebase.google.com/docs/database/admin/start

## Critical / Major — Thư viện có lỗ hổng, đã cập nhật bản vá

- npm audit ban đầu: proxy-addr Critical, GHSA-jqcg-44mw-7w3h; source-map-js High, GHSA-68fv-2mgg-jv7q.
- Cập nhật 2 thư viện bằng bản vá tương thích trong lockfile. npm audit sau cập nhật: 0 vulnerabilities được công cụ biết đến tại thời điểm kiểm tra. Điều này không loại trừ lỗ hổng chưa công bố.
- Phạm vi khai thác của proxy-addr phụ thuộc cấu hình trust proxy thực tế; không khẳng định service đã bị khai thác. source-map-js thuộc chuỗi công cụ build, không đồng nghĩa API runtime có đường khai thác.

## Major — Token và dữ liệu offline trên thiết bị, còn cần nâng cấp

- Không lưu mật khẩu vào frontend/localStorage; nhưng JWT được lưu trong localStorage với thời hạn 12 giờ. JavaScript chạy cùng origin có thể đọc token nếu xuất hiện XSS.
- Logout hiện xóa phiên ở trình duyệt, chưa thu hồi token đã sao chép ở phía server. Đổi sessionVersion/khóa tài khoản thu hồi token; xóa tài khoản phụ mới bổ sung cũng thu hồi ngay.
- IndexedDB lưu bản xem offline và thao tác nháp theo username, gồm thông tin biên bản riêng khi user có quyền; không phải dữ liệu mã hóa. Logout không xóa toàn bộ cache/nháp để tránh mất tác nghiệp. Máy dùng chung hoặc thiết bị bị lấy có thể lộ dữ liệu này.
- Hướng nâng cấp: phiên HttpOnly Secure cookie hoặc BFF cùng origin, đi kèm CSRF và Socket.IO authentication; quản lý logout/revoke phía server; lựa chọn xóa cache khi đăng xuất sau khi đồng bộ/export nháp. Không chỉ chuyển sang sessionStorage rồi coi là đã chống XSS.
- Tài liệu: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html ; https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html

## Major — Tài khoản phụ thiếu chức năng xóa, đã bổ sung

- Chỉ admin chính gọi DELETE `/api/auth/accounts/:username`, phải xác nhận đúng tên đăng nhập.
- Không xóa admin chính/bản thân; admin phụ và thư ký không được xóa tài khoản.
- Xóa theo cơ chế thu hồi: disabled, deletedAt/deletedBy, tăng sessionVersion, loại bỏ password/passwordHash. Tombstone giữ tên/role để bảo toàn lịch sử; tên đăng nhập cũ không được tái sử dụng.
- Ẩn khỏi danh sách quản lý và lựa chọn phân công; bỏ phân công của trận Sắp diễn ra, tăng version để thiết bị cũ không ghi đè. Trận đã duyệt giữ thông tin nguồn thư ký, có thể sao lưu/khôi phục.
- Chặn xóa nếu thư ký còn trận LIVE, chờ duyệt hoặc bị trả; phải hoàn tất biên bản hoặc đổi phân công trước. Không xóa sự kiện/kết quả.
- Broadcast khiến phiên Socket.IO bị thu hồi; HTTP tiếp theo và login bằng mật khẩu cũ đều bị chặn. Kiểm thử cục bộ xác nhận JWT cũ vô hiệu.

## Major / Minor — Giới hạn chống dò và bảo vệ vận hành

- Có giới hạn 20 lần đăng nhập/IP/15 phút, nằm trong RAM của một process. Restart/multiple instances làm giới hạn không còn dùng chung; một tài khoản đăng nhập thành công xóa bộ đếm IP.
- Chưa có giới hạn bền vững theo tài khoản, MFA hoặc cảnh báo đăng nhập bất thường. Cần rate limit dùng chung, thêm theo username và IP, hạn chế flood request ở hạ tầng nếu quy mô tăng.
- Đã giới hạn mật khẩu login tối đa 72 byte trước bcrypt, đồng nhất với tạo tài khoản. Tài khoản mới tối thiểu 12 ký tự; tài khoản cũ được migration không tự nâng độ mạnh mật khẩu.
- Render còn các biến ADMIN_PASSWORD, REFEREE_PASSWORD của phiên bản cũ; backend hiện dùng accounts Firebase, không dùng chúng. Có thể gỡ sau khi xác nhận không cần rollback backend cũ. Không đọc/hiển thị giá trị các biến này.
- File export đầy đủ từ Firebase có thể chứa tài khoản/mã băm; file service account chứa private key. Không chia sẻ/upload lên GitHub. File backup từ cổng BTC hiện loại accounts khỏi export.

## Những kiểm tra đạt

- API khán giả thực tế: không có accounts, password/passwordHash, signatures, secretaryNote, assignedSecretary, signatureHash; 2 bảng, 12 trận ở thời điểm kiểm tra.
- API backup không token trả HTTP 401. API HTTP local kiểm tra staff/admin phụ không tạo hoặc xóa tài khoản, xuất backup, reset, sửa cấu hình.
- Mật khẩu được hash bcrypt cost 12 ở backend; không trả hash/password trong login hoặc DTO staff/admin. JWT kiểm tra HS256, issuer, audience, role và sessionVersion với dữ liệu tài khoản server.
- React render chuỗi; không thấy dangerouslySetInnerHTML/eval trong mã đã tìm. Đây không phải bằng chứng loại trừ mọi XSS. Các đường dẫn dữ liệu chặn __proto__/constructor/prototype.
- .env được ignore. File database mẫu đang tracked không có tài khoản/mật khẩu hoặc trận. Chưa kiểm toán toàn bộ lịch sử Git, IAM/service-account permissions hoặc mọi bản export ngoài workspace.
- 111/111 kiểm thử đạt, lint và build thành công sau thay đổi. UI cục bộ bằng dữ liệu giả: xác nhận sai giữ tài khoản; xác nhận đúng xóa admin phụ khỏi danh sách. Chưa xóa tài khoản thật để thử.

## Ưu tiên tiếp theo

1. Chủ tài khoản đổi mật khẩu các tài khoản từng có khi Firebase mở; không dùng lại mật khẩu email/GitHub/Render.
2. Giữ Firebase Rules đóng, chỉ backend đọc/ghi; bảo vệ private key và tài khoản quản lý cloud.
3. Nâng cấp phiên đăng nhập và quản lý cache offline; áp dụng rate limit bền vững.
4. Giữ bản backup sau ngày thi đấu; kiểm tra nhật ký và dữ liệu giải khi nghi ngờ sửa trái phép.
