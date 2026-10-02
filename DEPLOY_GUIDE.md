# Triển khai nhánh demo, giữ main nguyên trạng

## Backend

URL `https://duoc-premier-league-backend.onrender.com` đã được kiểm tra chỉ đọc ngày 02/10/2026; API đang chạy chưa báo schema 2. Không trỏ demo mới vào service cũ để tác nghiệp. Việc push nhánh demo không tự nâng cấp service đang theo dõi main.

Tạo service Render riêng từ **branch demo**, theo `render.yaml` (tên `duoc-premier-league-demo-api`). Có thể dùng cùng Firebase project với main nhưng bắt buộc namespace `environments/demo2026`; mã demo từ chối root và các namespace ngoài `environments/demo…`.

Thiết lập `FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON` (secret từ Firebase service account, không đưa vào frontend/Git/chat), `TRUST_PROXY_HOPS=1` theo blueprint Render; local để 0. `CLIENT_URL` là origin Netlify demo chính xác. Blueprint tạo `JWT_SECRET` ngẫu nhiên. Không đặt `CLIENT_URL=*`. Node 24 được khuyến nghị; file database không được phép trong production vì filesystem Render không bền vững.

Firebase client rules của namespace demo phải từ chối đọc/ghi trực tiếp; server Admin SDK truy cập qua service account. Ví dụ thêm rules riêng `environments/demo2026: { ".read": false, ".write": false }` và kiểm tra không có quyền true kế thừa từ root (Firebase không thể thu hồi quyền đã cấp ở parent). Không sửa rules của giải thật mà chưa kiểm tra ảnh hưởng. Đây là bước cấu hình tài khoản cloud, không được thực hiện tự động bởi push.

Namespace mới không có tài khoản mặc định. Chủ hệ thống tạo `accounts/<username>` (username viết thường) qua Firebase Console trong namespace demo: `role` là `admin` hoặc `referee`, `name`, `passwordHash` bcrypt, `sessionVersion: 0`. Tạo hash trên máy bằng `npm run account:hash` (nhập mật khẩu qua terminal, không nằm trong lịch sử lệnh). Không lưu mật khẩu plaintext. Đổi `sessionVersion` hoặc `disabled:true` thu hồi phiên. Dữ liệu cũ sao chép vào demo cần có bản sao lưu gốc; startup migration gắn mã cầu thủ/sự kiện ổn định, hash mật khẩu cũ và giữ kết quả luân lưu tổng lịch sử. Trận dữ liệu cũ thiếu phân công phải được BTC chỉ định thư ký trước tác nghiệp.

Kiểm tra `/api/health` trả `schemaVersion:2`, tài khoản đúng/sai, public DTO, và CORS từ Netlify demo trước dùng. Backend không khởi động nếu thiếu secrets/namespace hoặc dùng file ở production.

## Frontend

Netlify kết nối branch **demo**, build `npm run build`, publish `dist`; `VITE_API_URL` là URL **service demo v2**. `netlify.toml` hỗ trợ reload `/btc` và `/thuky`. Build lại khi thay biến Vite. Không thay branch deploy của site main. Service worker chỉ cache giao diện và tài nguyên tĩnh; không cache API/token.

Tác nghiệp offline chỉ khả dụng sau khi thiết bị từng tải ứng dụng và dữ liệu trận. Bộ nhớ trình duyệt phải hoạt động; xóa dữ liệu trình duyệt/chế độ riêng tư/dung lượng cạn có thể làm mất nháp. Xuất nháp trước đổi máy. Thao tác conflict được giữ trên máy, người dùng đối chiếu và nhập lại rồi loại bỏ bản conflict; không tự ghi đè dữ liệu mới trên server. Đồng hồ canonical dùng mốc server; trình duyệt lưu offset giờ server và nháp offline. BTC/thư ký có nút chỉnh phút để đối chiếu thời gian trọng tài.

## Kiểm tra sau triển khai

Chạy theo báo cáo QA với dữ liệu demo; kiểm tra ba cổng, ký/nộp/duyệt, offline/F5/kết nối lại, vòng bảng→knockout, backup→phục hồi và print preview A4 trên thiết bị mục tiêu. Không dùng fixture/test tự động để ghi vào Firebase giải thật. Việc deploy và kiểm thử cloud cần tài khoản Render/Firebase/Netlify của chủ hệ thống; trong phiên sửa này chỉ kiểm thử local và đọc health backend hiện có.
# Kích hoạt CI cho demo

Mẫu tại `docs/ci-demo-workflow.yml` chỉ chạy trên nhánh `demo`. Để kích hoạt, dùng GitHub UI hoặc token có quyền `workflow` đưa file vào `.github/workflows/demo-check.yml` trên nhánh demo. Token dùng trong lần push này thiếu quyền đó; các kiểm tra `npm run check` và `npm audit` đã chạy local trước push.


### Quản trị demo sau khởi tạo

BTC đã đăng nhập có thể mở **Tài khoản thư ký** để tạo người dùng; backend tự hash mật khẩu, chỉ cấp quyền `referee`. Chọn thư ký theo họ tên tại lịch thi đấu, không nhập username thủ công. Tài khoản BTC đầu tiên vẫn khởi tạo theo hướng dẫn phía trên.

Trong **Điều lệ & dữ liệu**, BTC chỉnh tên giải, đơn vị tổ chức, logo (cắt vuông/nén), điều lệ, sao lưu và nhật ký. Khi tạo giải mới, tên/đơn vị/logo cũng có trong bước cấu hình ban đầu.

Điểm danh là tùy chọn; không có số lượng tối thiểu. Cảnh báo và chặn cầu thủ đang treo giò vẫn có hiệu lực. Trang khán giả chỉ có BXH/thống kê/kết quả đã duyệt; ticker LIVE vẫn cập nhật trận đang diễn ra. Đèn đồng bộ nằm cuối trang: xanh đã kết nối, cam đang kết nối/chờ đồng bộ, đỏ mất kết nối; chạm đèn để xem chi tiết hoặc xử lý nháp.
