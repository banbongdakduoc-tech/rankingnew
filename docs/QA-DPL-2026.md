# Báo cáo QA và thiết kế sản phẩm — Dược Premier League

Ngày: 02/10/2026. Mã nguồn đối chiếu: `02b825f`, nhánh `main`.

## 1. Kết luận và phạm vi kiểm tra

**Chưa đủ cơ sở cho phép tác nghiệp giải chính thức.** Build và lint thành công, nhưng tồn tại lỗi nghiệp vụ được tái hiện và lỗ hổng thiết kế phân quyền cần xử lý trước khi vận hành.

Đã đọc frontend, thuật toán nghiệp vụ, backend, cấu hình triển khai; chạy `npm run build`, `npm run lint` và chạy trực tiếp các hàm nghiệp vụ bằng Node với dữ liệu giả lập. Chưa kiểm thử trình duyệt của ứng dụng thật, Security Rules đang triển khai, tải đồng thời, thiết bị ngoài sân hoặc API production. Không sửa dữ liệu giải thật.

Phân biệt bằng chứng:

- **Tái hiện:** chạy hàm hiện tại, có kết quả sai cụ thể.
- **Code:** hành vi hoặc kiểm tra bị thiếu có thể xác định từ mã nguồn; chưa khẳng định đã xảy ra trên production.
- **Rủi ro:** cần môi trường staging hoặc cấu hình production để xác nhận.

Mức độ:

- **Blocker:** có thể phá vỡ quyền quản trị hoặc làm mất nguồn dữ liệu giải; chặn phát hành.
- **Critical:** sai kết quả, đội đi tiếp, kỷ luật hoặc mất diễn biến trận; phải sửa trước tác nghiệp.
- **Major:** hỏng một luồng quan trọng, có phương án xử lý thủ công.
- **Minor:** lỗi trình bày hoặc bất tiện không đổi kết quả.

## 2. Những quy định phải chốt trước kiểm thử

Không suy diễn quy định tích lũy thẻ hay xếp hạng từ tên FIFA/VPF. Đây là điều lệ của giải và phải lưu theo phiên bản trước khi khởi tranh.

1. Điểm: thắng 3, hòa 1, thua 0. BXH chính thức chỉ dùng kết quả đã duyệt; BXH LIVE là chế độ riêng có nhãn tạm tính.
2. Hai đội bằng điểm: tính tổng đối đầu nếu có nhiều lượt, rồi GD toàn bảng, GF toàn bảng, tên theo quy định bạn cung cấp.
3. Từ ba đội bằng điểm: đề xuất bảng phụ gồm các trận giữa các đội đồng điểm; xét điểm H2H → GD H2H → GF H2H → GD toàn bảng → GF toàn bảng → tên. BTC phải phê chuẩn thứ tự này và quyết định có áp dụng lại H2H cho nhóm con còn bằng nhau hay không.
4. Hai thẻ vàng cùng trận là truất quyền thi đấu do vàng thứ hai, phải phân biệt với đỏ trực tiếp. Số trận cấm do mỗi loại và việc cộng các thẻ này vào tích lũy phải theo điều lệ. Cơ sở truất quyền thi đấu: [IFAB Law 12](https://www.theifab.com/laws/latest/fouls-and-misconduct/).
5. Đề xuất ngưỡng tích lũy 2 vàng ở các trận khác nhau theo yêu cầu. Tẩy số vàng tích lũy tại mốc vào knockout không tự động hủy án cấm đã phát sinh; có tùy chọn điều lệ rõ ràng nếu giải áp dụng cách khác.
6. Luân lưu tách riêng khỏi bàn thắng trong trận và Vua phá lưới; cấu hình có/không hiệp phụ, số lượt đầu và lượt đột tử. [IFAB Law 10](https://www.theifab.com/laws/latest/determining-the-outcome-of-a-match/).
7. Bỏ cuộc, xử thua và trận hủy cần kiểu kết quả hành chính riêng. Không tạo cầu thủ ghi bàn giả để khớp tỷ số xử thua 0–3.
8. Tranh hạng ba cần xác định đội thắng nếu không chấp nhận đồng hạng; không thể chỉ bỏ qua đội đi tiếp mà thiếu kết quả phân hạng.

## 3. Phát hiện và phương án khắc phục

### B01 — Blocker — Cơ chế đăng nhập frontend không tạo danh tính được xác thực

**Code:** `src/services/authService.js` đọc `accounts/{username}`, so mật khẩu trực tiếp rồi lưu role vào `dpl_auth_session`. `src/App.jsx` dùng role trong localStorage để mở cổng. Không thấy luồng đăng nhập Firebase Auth hay JWT backend được sử dụng bởi các trang.

- Tái hiện trên staging: đổi session thành role admin, mở `/btc`, rồi thử ghi dữ liệu bằng danh tính chưa xác thực.
- Kết quả mở được giao diện quản trị có căn cứ từ code; **quyền ghi trái phép còn phụ thuộc Security Rules chưa được cung cấp**. Nếu Rules chặn người chưa đăng nhập thì luồng đăng nhập hiện tại lại không đủ để tác nghiệp.
- Sửa: Firebase Auth + role phía server/custom claims, hoặc backend kiểm chứng token rồi ghi DB. Không cho browser đọc password. Phân quyền theo giải và trận được phân công; Rules/API kiểm tra quyền cho từng mutation. Kiểm thử Rules bằng emulator. [Firebase Security Rules](https://firebase.google.com/docs/database/security).

### B02 — Blocker — Backend công khai toàn bộ DB

**Code:** `server/routes/tournament.js` GET `/data` trả `db.getAll()` không xác thực; `server/index.js` gửi `initial_data` toàn DB cho mọi socket. DB có nhánh `accounts`; backend login so mật khẩu dạng rõ.

- Nếu DB backend có tài khoản, các endpoint này có thể lộ password. Đây là lỗi trong code; chưa gọi API production để xác nhận dữ liệu đang chứa gì.
- Sửa: DTO công khai chỉ chứa dữ liệu cần xem; không phát tài khoản, chữ ký hoặc thông tin nội bộ qua socket public. Hash password nếu tiếp tục dùng backend account; kiểm tra thu hồi phiên và thay tài khoản đã bị lộ nếu xác minh có sự cố.

### B03 — Blocker — Hai nguồn DB độc lập, backend lưu file trên Render Free

**Code + rủi ro triển khai:** frontend ghi Firebase; backend dùng `server/storage/dpl_database.json`, không có cầu nối Firebase. `render.yaml` dùng Free, không cấu hình persistent disk.

- Backup/API backend có thể không chứa dữ liệu đang thấy trên frontend. Nếu dùng backend lưu trận thật, dữ liệu ghi file có nguy cơ mất khi restart/redeploy. [Render Free](https://render.com/docs/free) xác nhận filesystem tạm thời.
- Sửa: một nguồn chuẩn là Firebase; Express dùng Admin SDK để ghi/đọc cùng nguồn. Backup cùng nguồn chuẩn, có phiên bản schema và kiểm tra phục hồi. Không dùng file cục bộ làm kho dữ liệu chính.

### C01 — Critical — Tam giác H2H không ổn định

**Tái hiện:** `calculateGroupStandings` dùng comparator từng cặp và `matches.find`. A thắng B 1–0; B thắng C 2–0; C thắng A 3–0. Đầu vào `[A,B,C]`, `[A,C,B]`, `[B,A,C]` lần lượt ra `[A,B,C]`, `[B,C,A]`, `[C,A,B]`.

- Sửa: gom nhóm đồng điểm trước khi xét bảng phụ. Không xét thắng trực tiếp trong comparator tạo vòng A>B>C>A. Với điều lệ đề xuất: C (GD +1, GF 3), B (GD +1, GF 2), A (GD −2).
- Thêm kiểm tra bất biến khi hoán vị đội/trận, tính tổng H2H hai lượt và hiển thị lý do xếp hạng.

### C02 — Critical — Bỏ sót vàng thứ hai và trộn mô hình kỷ luật

**Tái hiện:** hai event Vàng cho cùng cầu thủ cùng trận → `detectViolations` trả `[]`; `lastMatchId` chỉ đếm một vàng/trận. Event Đỏ được diễn giải luôn là đỏ trực tiếp.

- Sửa: loại `yellow`, `second_yellow_red`, `direct_red`; vàng thứ hai tạo truất quyền thi đấu với liên kết tới hai event gốc. Không tạo hai án phạt cho cùng một lần truất quyền thi đấu.
- Giữ thống kê lịch sử riêng với số vàng đang tích lũy. Không xóa số vàng tích lũy chỉ vì nhận đỏ trực tiếp trừ khi điều lệ quy định.

### C03 — Critical — Mất đồng hồ và dữ liệu chưa đồng bộ khi F5

**Code:** đồng hồ chỉ nằm trong React state, chạy `setInterval` ở bước 4; chọn lại trận LIVE không khôi phục timestamp/hiệp. Đội hình nháp, ghi chú và chữ ký trước nộp chưa có kho nháp bền vững.

- Firebase Web không bảo toàn offline writes ngoài phiên trang hiện tại. Mất mạng rồi đóng/reload trang có thể mất ghi chép chưa gửi. [Firebase Web read/write](https://firebase.google.com/docs/database/web/read-and-write?hl=en).
- Sửa: IndexedDB lưu command và nháp trước khi báo đã lưu; mỗi command có UUID/idempotency key, phiên bản trận, trạng thái pending/ack/conflict. PWA cache app shell hỗ trợ mở lại offline.
- Đồng hồ lưu `period`, `elapsedBeforeRun`, `startedAt`, `pausedAt` với mốc server; tính thời gian từ mốc, không cộng một giây mỗi callback. Không ép dừng đồng hồ bóng đá mỗi khi có gián đoạn; thao tác dừng/đổi hiệp là quyết định trọng tài/thư ký.

### C04 — Critical — Ghi đè sự kiện khi hai thiết bị tác nghiệp

**Code:** `handleAddEvent` gửi lại toàn mảng `events` từ state cục bộ. Listener cập nhật `allMatches` nhưng không hòa giải state `events` của trận đang chọn.

- Hai thiết bị cùng đọc bản 1, mỗi bên thêm một event → lần ghi sau có thể xóa event của bên trước.
- Sửa: lưu event theo ID riêng; transaction append hoặc server command; khóa người tác nghiệp có lease; cập nhật theo version, trả conflict 409, không ghi đè âm thầm.

### C05 — Critical — Duyệt chỉ kiểm tỷ số ở UI; backend cho sửa trạng thái tùy ý

**Code:** `handleSaveAndApprove` có đối chiếu tỷ số/event; `/approve` không kiểm. Staff `PUT /matches/:id` merge toàn body, có thể sửa `status`, `advancingTeam`, đội và kết quả đã duyệt.

- Sửa: allowlist field; state machine phía server; chỉ BTC được duyệt/mở lại. Server tính score từ event, kiểm phạm vi đội/cầu thủ, type/detail, số nguyên và chữ ký/ngoại lệ; version check và audit bắt buộc.

### C06 — Critical — Có thể duyệt đội thắng sai hoặc luân lưu chưa phân thắng bại

**Code:** đội đi tiếp chỉ được gợi ý lúc mở review. Khi đổi score/event, giá trị cũ có thể còn. Duyệt chỉ yêu cầu có `advancingTeam`, không đối chiếu với winner suy ra, không bắt buộc penA khác penB khi hòa. Tranh hạng ba được miễn kiểm tra này.

- Sửa: winner là giá trị tính toán lại trên mỗi thay đổi và kiểm lại phía server. Trận hòa chưa kết thúc luân lưu không được duyệt. Kết quả hành chính có đường xử lý riêng, lý do và người duyệt.

### C07 — Critical — Bốn bảng nhưng sinh cặp từ hai bảng đầu

**Tái hiện:** 4 bảng A/B/C/D mỗi bảng 2 đội; `generateKnockoutPairs` vẫn lấy A/B, trả tên placeholder Tư/Ba bảng A/B; bỏ C/D dù `getQualifyingCount` có hỗ trợ 4 bảng.

- Sửa: bracket template theo cấu hình hợp lệ; 4 bảng lấy 2 đội → đủ 8 đội thực, mỗi đội đúng một lần. Không cho tạo nếu chưa đủ suất hoặc kết quả chưa chính thức.

### C08 — Critical — Sửa kết quả đã duyệt không có quản lý ảnh hưởng

**Code:** BTC đã có nút sửa/duyệt lại trận trong bảng trận. Không thấy revision, lý do mở lại, invalidation chữ ký hoặc quan hệ nguồn kết quả để cập nhật trận knockout đã sinh.

- Sửa: bản đã duyệt bất biến; tạo revision mới khi mở lại. Xem trước ảnh hưởng BXH, người đi tiếp, treo giò, bán kết/chung kết; khóa tự cập nhật khi trận sau đã bắt đầu. BTC quyết định phương án, lưu audit. Chữ ký gắn hash biên bản, thay đổi nội dung cần ký lại hoặc ngoại lệ có lý do.

### M01 — Major — Báo thành công trước khi server xác nhận

**Code:** nhiều `update/set/remove` không await/catch, toast thành công ngay. Sửa bằng ba trạng thái “Đã lưu trên máy / Đang gửi / Đã xác nhận”; thất bại hiển thị inline và có retry giữ nháp.

### M02 — Major — Định danh cầu thủ dựa vào tên và số áo

**Code:** thống kê/án phạt dùng `${team}@@${player}`. Đổi số áo, tên hoặc import ghi đè có thể tách thống kê, mất đối chiếu treo giò. Dùng `teamId/playerId` bất biến và snapshot tên tại thời điểm trận.

### M03 — Major — Không bắt buộc đủ chữ ký khi nộp

**Code:** `handleSubmitReport` chấp nhận chữ ký rỗng. Yêu cầu đủ ba bên hoặc ghi người từ chối/vắng mặt và lý do; BTC thấy rõ ngoại lệ. Chữ ký nháp được lưu trên máy và gắn revision.

### M04 — Major — Không có thời hạn/tiến trình chấp hành án

**Code:** `suspensions` chỉ có reason/matchId/createdAt, tồn tại đến khi gỡ thủ công. Thiếu remainingMatches, eligibleFrom và nhật ký đã chấp hành. Mô hình án phạt cần chỉ rõ trận áp dụng, số trận còn lại và trạng thái kháng nghị.

### M05 — Major — Trận chờ duyệt biến mất khỏi BXH/thống kê

**Code:** hàm thống kê tính LIVE và Đã xong nhưng không tính Chờ duyệt. Chuyển LIVE → Chờ duyệt làm số điểm/bàn vừa hiển thị biến mất. Tách “chính thức” và “tạm tính”; trận đã kết thúc chờ duyệt vẫn xuất hiện trong kết quả với nhãn thích hợp.

### M06 — Major — Backup/import thiếu kiểm tra và tính toàn vẹn

**Code:** backend import chỉ kiểm là object rồi thay DB; frontend import cầu thủ map dữ liệu và ghi đè. Cần schemaVersion, validate quan hệ, preview diff, backup trước thao tác, phục hồi transaction. Export công khai không chứa tài khoản/chữ ký; backup nội bộ phải bảo vệ quyền truy cập.

### M07 — Major — Bù giờ sắp xếp sai giữa hai hiệp

**Code:** `parseInt('20+3')` thành 20; event auto hiệp 1 20+3 có minute 23, hiệp 2 phút 21 có minute 21. Sort chỉ theo minute có thể đưa bàn hiệp 2 trước bù giờ hiệp 1. Lưu period + regulationMinute + addedMinute + sequence; hiển thị tách với khóa sắp xếp.

### M08 — Major — Chỉ sinh danh sách cặp, chưa xếp vòng/sân/giờ

**Code:** frontend sinh mọi cặp với round “Vòng Bảng”; backend tăng round cho từng cặp. Đủ cặp không đồng nghĩa lịch từng vòng hợp lệ. Dùng circle method, hỗ trợ BYE đội lẻ, kiểm một đội chỉ đá một trận/vòng và thời gian nghỉ giữa hai trận.

### M09 — Major — Vua phá lưới chỉ loại phản lưới, không allowlist loại bàn

**Tái hiện phòng vệ:** event `type: goal, detail: shootout` vẫn được cộng. UI hiện nhập luân lưu bằng penA/penB nên không khẳng định UI tự tạo lỗi này. Rủi ro đến từ API/import. Tách `shootout_kick` và chỉ tính goal normal/penalty hợp lệ.

### N01 — Minor — Hiệu năng, listener và khả năng truy cập

- Build cảnh báo bundle JS 627.43 kB trước gzip; cân nhắc tách lazy các cổng.
- `onValue` ở các trang không cleanup: chuyển cổng nhiều lần có thể giữ listener thừa. Return unsubscribe trong useEffect.
- Rủi ro cần kiểm UI: modal focus, bàn phím, tương phản, tên dài, màu thẻ không kèm chữ, bracket màn nhỏ, bản in nhiều trang. Chưa đánh dấu fail khi chưa chạy thực tế.

## 4. Test plan

### Môi trường và dữ liệu

- Staging tách Firebase project/namespace và account khỏi giải thật; chạy Rules emulator trước E2E.
- Role: khán giả, thư ký được phân trận A, thư ký trận B, BTC, tài khoản bị thu hồi.
- Thiết bị: Chrome/Edge desktop; Safari iPhone, Chrome Android; 360/390/768/1440 px; kiểm landscape và zoom 200%.
- Mạng: online, offline 10 phút, RTT 1–3 giây, reconnect liên tục, request lỗi, đóng tab, F5, hai thiết bị.
- Dataset: 2 bảng × 4 đội; 4 bảng × 2 đội; 5 đội một bảng; 3 đội tam giác; đội trùng tên sau chuẩn hóa; cầu thủ trùng tên khác ID; trận nhiều bàn/thẻ và ký dài.
- Dữ liệu riêng cho quy định vàng: 1 vàng vòng bảng, 2 vàng vòng bảng, đỏ chưa chấp hành trước knockout, vàng thứ hai cùng trận, thẻ trong luân lưu.

### Chiến lược

1. Unit cho BXH, score, winner, discipline, thời gian và pairing; kiểm tra bất biến bằng hoán vị dữ liệu.
2. Integration cho phân quyền, state machine, transaction, idempotency, backup/restore và version conflict.
3. E2E hành trình thư ký → ký → BTC duyệt → khán giả; offline/F5; in A4; mở lại trận.
4. UAT với thư ký thực tại sân, BTC và đội trưởng: một trận 2×20 phút cộng bù giờ và một trận knockout có luân lưu.

### Tiêu chí đầu ra đề xuất

- Không còn Blocker/Critical mở; 100% test liên quan kết quả/quyền/dữ liệu đạt. Major ảnh hưởng tác nghiệp phải xử lý trước giải hoặc có quyết định chấp nhận cụ thể của BTC.
- Replay 100 command có gửi lại: không mất/trùng event; mất mạng + F5 phục hồi đủ nháp.
- Tỷ số, người ghi bàn, BXH, kỷ luật và bracket thống nhất sau duyệt và sau sửa.
- Mục tiêu staging: acknowledgement online p95 ≤2 giây; public nhận cập nhật p95 ≤3 giây với 100 người xem/2 thư ký. Đây là mục tiêu cần đo, chưa phải kết quả benchmark.
- Backup được phục hồi trên staging và đối chiếu toàn bộ ID, quan hệ, revision; không chỉ kiểm số lượng bản ghi.

## 5. Test cases chi tiết

Quy ước: mỗi dòng ghi tiền điều kiện/dữ liệu, thao tác và kết quả mong đợi. Các case là kế hoạch chưa chạy trừ những tái hiện ghi ở phần 3.

### A. Quyền và dữ liệu

| ID / Mức | Tiền điều kiện và bước thực hiện | Kết quả mong đợi |
|---|---|---|
| SEC01 Blocker | Không đăng nhập; giả localStorage role admin; mở /btc; gửi ghi trận và accounts | Không có quyền ghi; không đọc mật khẩu; UI kiểm lại danh tính xác thực |
| SEC02 Blocker | Client public gọi /data, kết nối socket initial_data, đọc nhánh accounts | Chỉ nhận DTO công khai; tài khoản và thông tin nội bộ bị loại |
| SEC03 Critical | Thư ký A sửa trận B, PUT status Đã xong, thay advancingTeam | 403; dữ liệu/version không đổi; audit ghi thao tác hợp lệ theo chính sách |
| SEC04 Major | Đăng nhập rồi BTC thu hồi account; tiếp tục gửi command | Phiên bị từ chối; nháp còn trên máy; không mất dữ liệu khi yêu cầu đăng nhập lại |
| SEC05 Major | Mở trang / bằng session BTC và không session | Không có nút login/điều hành; back/forward không làm rò giao diện quản trị |

### B. Tỷ số và cầu thủ ghi bàn

| ID / Mức | Tiền điều kiện và bước thực hiện | Kết quả mong đợi |
|---|---|---|
| G01 Critical | A–B; thêm A bàn thường, A penalty trong trận, A phản lưới | Score 2–1; A có 2 bàn cá nhân; phản lưới không cộng Vua phá lưới |
| G02 Critical | G01; sửa người phản lưới thành cầu thủ B rồi xóa bàn penalty | Score và thống kê tính lại đúng; không còn đóng góp của event đã hủy |
| G03 Critical | Event tổng 1–0; nhập 2–0; duyệt bằng UI và gọi API trực tiếp | Cả hai đường từ chối với chi tiết bên sai; không đổi status |
| G04 Major | Chọn đội A nhưng player thuộc B; player không có ID hợp lệ; số áo trùng | Không ghi event sai; bàn chỉ cho cầu thủ đủ điều kiện. Thẻ dự bị/ban huấn luyện dùng loại đối tượng riêng |
| G05 Critical | Gửi cùng eventId 3 lần khi retry; click nhanh hai lần | Một command lặp chỉ tạo một event; hai event khác nhau vẫn lưu đủ |
| G06 Major | Score −1, 1.5, NaN, chuỗi lạ; phút 0/âm/20+abc | Server trả lỗi validation, không tự biến dữ liệu sai thành 0 hoặc 1 |
| G07 Major | Cùng tên hai cầu thủ khác ID; đổi tên/số áo sau 2 trận | Thống kê không gộp/tách sai; lịch sử trận giữ snapshot |
| G08 Critical | B bỏ cuộc; BTC xử 3–0 không có bàn thực | ResultType hành chính; bảng điểm đúng; không có hat-trick giả |

### C. Thẻ và án phạt

| ID / Mức | Tiền điều kiện và bước thực hiện | Kết quả mong đợi |
|---|---|---|
| D01 Critical | P nhận vàng phút 5 và 15 cùng trận | Truất quyền thi đấu do vàng thứ hai; một cảnh báo/án phù hợp; không ghi thành đỏ trực tiếp |
| D02 Critical | P có một vàng trận trước rồi đỏ trực tiếp trận sau | Đỏ trực tiếp độc lập; số vàng tích lũy xử lý theo điều lệ; không reset tùy tiện |
| D03 Critical | P vàng ở hai trận khác nhau đã duyệt | Đúng một cảnh báo đủ ngưỡng; treo giò trận kế tiếp có ID và thời hạn |
| D04 Critical | P một vàng vòng bảng; vào KO nhận một vàng | Nếu điều lệ tẩy tại mốc KO: chưa đủ hai vàng; tổng thẻ lịch sử vẫn là hai |
| D05 Critical | P đủ hai vàng/đỏ ở trận cuối bảng, án chưa chấp hành; vào KO | Reset vàng không xóa án đang chờ chấp hành, trừ điều lệ đã cấu hình khác |
| D06 Major | BTC hủy vàng sai sau khi ban; mở lại biên bản | Tính lại căn cứ án, yêu cầu quyết định sửa/thu hồi; handledViolation cũ không che sự kiện mới |
| D07 Major | Hai cảnh báo khác loại cùng player/trận; ân xá một cảnh báo | ID vi phạm khác nhau; ân xá một không ẩn cái còn lại |
| D08 Critical | P bị truất quyền thi đấu; ghi bàn sau phút bị đuổi | Chặn hoặc yêu cầu sửa thứ tự/sự kiện có căn cứ; vẫn cho ghi thẻ/lỗi sau khi bị đuổi nếu nghiệp vụ cho phép |
| D09 Major | P có thẻ trong trận và luân lưu | Tách phase kỷ luật, xử lý theo luật/điều lệ đã chốt; không dùng một counter thiếu phase |
| D10 Major | P treo một trận; trận kế tiếp hoãn hoặc xử bỏ cuộc | Chỉ đánh dấu chấp hành theo điều lệ; không giảm án vì đổi ngày hoặc lịch chưa diễn ra |

### D. BXH và lịch

| ID / Mức | Tiền điều kiện và bước thực hiện | Kết quả mong đợi |
|---|---|---|
| R01 Critical | Hai đội bằng điểm; A thắng đối đầu nhưng GD thấp hơn B | A trên B theo H2H; bảng hiển thị tiêu chí phân hạng |
| R02 Critical | A>B 1–0, B>C 2–0, C>A 3–0; hoán vị đội/trận | Theo bảng phụ đề xuất: C>B>A; mọi hoán vị cho cùng kết quả |
| R03 Critical | Ba đội bằng điểm; H2H tách một đội, hai đội còn bằng nhau | Áp đúng chính sách xét lại nhóm con đã chốt; không comparator theo cặp |
| R04 Critical | Hai lượt A–B 2–0 và 0–3; đổi thứ tự hai trận | Tổng H2H A 2–3 B; không chỉ dùng trận đầu matches.find |
| R05 Major | Đổi LIVE → Chờ duyệt → Đã xong → sửa lại | BXH chính thức chỉ đổi khi duyệt; BXH tạm tính có nhãn và lịch sử chuyển rõ ràng |
| R06 Major | Sinh vòng tròn 4 và 5 đội; kiểm toàn lịch | 6 và 10 cặp; không self-match/trùng cặp; đội lẻ có BYE; mỗi đội tối đa một trận/vòng |
| R07 Critical | Giải có kết quả; bấm sinh lại lịch hai lần | Chặn ghi đè hoặc migration có preview/backup; không xóa trận đã tác nghiệp |
| R08 Major | Xếp cùng đội hai trận trùng sân/giờ hoặc nghỉ quá ngắn | Cảnh báo xung đột; sửa trước công bố theo ngưỡng nghỉ cấu hình |

### E. Knockout và luân lưu

| ID / Mức | Tiền điều kiện và bước thực hiện | Kết quả mong đợi |
|---|---|---|
| K01 Critical | 4 bảng×2 đội, tất cả hoàn thành; sinh tứ kết | Tám đội A/B/C/D xuất hiện đúng một lần theo template; không placeholder |
| K02 Critical | Hai bảng thiếu đội hoặc bảng còn trận Chờ duyệt | Không sinh nhánh chính thức thiếu suất; báo bảng/trận còn thiếu |
| K03 Critical | KO hòa 1–1; luân lưu 4–3 | Winner A; score trận vẫn 1–1; GF/GD/Vua phá lưới không cộng bảy lượt luân lưu |
| K04 Critical | KO hòa; pen trống/một bên trống/3–3; thử chọn winner | Không duyệt bằng chọn đội thủ công; yêu cầu loạt sút hợp lệ hoặc quyết định hành chính |
| K05 Critical | Mở review A thắng 2–1; sửa thành B thắng 2–3 | Winner đổi sang B; server từ chối winner A cũ |
| K06 Major | Năm lượt hòa 4–4; đột tử A vào, B chưa sút rồi B trượt | Chưa kết thúc khi hai bên chưa đủ lượt tương ứng; kết thúc sau B trượt |
| K07 Major | A dẫn 3–0 sau ba lượt mỗi bên với thể thức 5 lượt | Kết thúc sớm khi B không còn khả năng bắt kịp; không đợi đủ 10 cú |
| K08 Critical | Duyệt bán kết/chung kết/tranh ba hòa chưa phân thắng | Không công bố podium sai; vô địch/á quân/hạng ba suy ra từ kết quả đúng |

### F. Ngoài sân, biên bản và mở lại

| ID / Mức | Tiền điều kiện và bước thực hiện | Kết quả mong đợi |
|---|---|---|
| O01 Critical | Phút 12 hiệp 1; offline; ghi 2 bàn/1 thẻ; F5; reconnect | Nháp phục hồi đủ, đồng hồ đúng; command gửi mỗi cái một lần; cảnh báo offline rõ |
| O02 Critical | Đang hiệp 2; khóa màn hình 3 phút, mở lại | Đồng hồ theo timestamp không trễ ba phút; vẫn đúng hiệp và trạng thái chạy/dừng |
| O03 Major | Hiệp 1 20+3 ghi bàn; hiệp 2 phút 21 ghi thẻ; nhập 20+10 | Timeline giữ đúng hiệp; parse đầy đủ phần bù giờ; không sort hiệp 2 trước hiệp 1 |
| O04 Critical | Hai thư ký cùng thêm event từ một version; BTC duyệt lúc thư ký còn ghi | Lưu đủ hoặc báo conflict; không stale write sau duyệt; người tác nghiệp có khóa/lease |
| O05 Major | Nhập đội hình/ghi chú/ký hai bên; F5 trước nộp | Khôi phục nháp và chữ ký; không nộp biên bản thiếu bên thứ ba |
| O06 Major | Thiếu chữ ký trọng tài hoặc đội trưởng từ chối | Chặn nộp thông thường; ngoại lệ ghi rõ người/lý do và BTC xét |
| O07 Critical | Trận đã duyệt; thư ký sửa/delete event trực tiếp | Bị từ chối; chỉ BTC mở lại theo quy trình revision |
| O08 Critical | Mở lại tứ kết làm đổi winner; bán kết chưa bắt đầu | Preview ảnh hưởng; cập nhật nhánh theo quyết định; tính lại BXH/kỷ luật; ký revision mới |
| O09 Critical | O08 nhưng bán kết đã LIVE hoặc Đã xong | Không thay đội âm thầm; khóa tự động, chuyển xử lý BTC có audit |
| O10 Major | Backup → thay dữ liệu → restore bản hợp lệ và bản hỏng | Bản hợp lệ phục hồi toàn quan hệ; bản hỏng từ chối, DB hiện hành không đổi |
| O11 Major | Upload 20 MB, PNG trong suốt, ảnh xoay, HEIC, file giả ảnh | Preview crop, báo lỗi rõ nếu không hỗ trợ; không crash; chặn kích thước đầu vào; ảnh sau nén được đo dung lượng |
| O12 Major | In A4 biên bản 30 cầu thủ/đội, 60 event, tên dài, chữ ký | Không cắt bảng/chữ ký; có page break/header; không in nút; nội dung đúng revision |
| O13 Minor | Bàn phím/zoom 200%, modal, màn 360px, xem bracket | Focus đúng, thoát modal được, không mất nút chính; vùng scroll riêng cho bảng/bracket |

## 6. Thiết kế tính năng mới

| Ưu tiên | Tính năng | Giá trị và tiêu chí nghiệm thu |
|---|---|---|
| P0 | Trung tâm đồng bộ ngoài sân | Badge online/offline, số thao tác pending, khôi phục sau F5; không mất/trùng event |
| P0 | Chế độ luân lưu từng lượt | Cầu thủ, lượt, vào/trượt/đá lại; winner tính tự động; phase độc lập với goal |
| P0 | Mở lại có revision | Lý do, người sửa, diff, ảnh hưởng trận sau, chữ ký gắn hash; bản cũ luôn tra cứu được |
| P0 | Kiểm tra trước duyệt | Score/event, chữ ký, eligibility, winner, version; lỗi có liên kết tới chỗ cần sửa |
| P1 | Quản lý án theo trận | Thời hạn, đã chấp hành, kháng nghị/ân xá; khóa điểm danh khi còn án |
| P1 | Xếp lịch có sân và thời gian nghỉ | Preview, phát hiện trùng, BYE, đổi lịch và ghi lý do |
| P1 | Giải thích thứ hạng | Bấm H2H mở bảng phụ và thứ tự tiêu chí, giảm tranh cãi |
| P1 | Import có xem trước | Validate, chỉ rõ lỗi từng dòng, merge theo ID, undo phiên import |
| P1 | Ảnh cầu thủ có chỉnh vùng cắt | Preview vuông, xoay/zoom, dung lượng thực sau nén; không hứa mọi ảnh đều 10 KB |
| P2 | Theo dõi đội yêu thích | Lọc lịch/kết quả, chia sẻ link trận; thông báo chỉ sau opt-in |
| P2 | Hồ sơ mùa giải | Thống kê theo phase và mùa, tìm nhanh cầu thủ, tải biên bản được cấp quyền |

## 7. Thiết kế UI chuyên nghiệp

File `docs/dpl-ui-prototype.html` là prototype tương tác nhẹ với ba cổng, dữ liệu minh họa; chưa nối Firebase/API và không thay giao diện production.

### Design system

- Giữ nhận diện xanh DPL nhưng giảm neon/glow. Khán giả dùng navy tối, BTC ưu tiên nền sáng để đọc bảng và kiểm lỗi, thư ký mặc định nền sáng dễ đọc ngoài trời và có chế độ tối tùy chọn.
- Font system hỗ trợ tiếng Việt; thân chữ 14–16 px, score 48–64 px; số dùng tabular numerals. Spacing 4/8/12/16/24/32; radius 8–12 px.
- Màu luôn kèm chữ/icon: “LIVE”, “Chờ duyệt”, “Mất mạng”, “Bị từ chối”. Không dùng xanh/đỏ làm tín hiệu duy nhất. Mục tiêu tương phản chữ thường ≥4.5:1.
- Nút tác nghiệp tối thiểu 48×48 px, một hành động chính mỗi khối. Dialog có focus trap, label, Esc và trả focus; trạng thái pending thông báo cho screen reader.
- Skeleton trong tải ban đầu; lỗi kết nối không giả làm “mùa giải chưa bắt đầu”. Empty state có hành động phù hợp vai trò.

### Trang khán giả

- Header chỉ logo, tên giải, mùa và trạng thái giải. Không đưa đường dẫn nội bộ/login vào public navigation.
- LIVE nổi bật đầu trang; score lớn, hiệp/phút rõ, đồng bộ lần cuối. Chờ duyệt hiển thị “Kết thúc · Chờ BTC xác nhận”.
- Tabs: Tổng quan, BXH, Lịch & kết quả, Knockout, Thống kê. Bộ lọc ngày/bảng/đội giữ trên URL khi triển khai.
- BXH: đội và điểm ưu tiên, highlight suất đi tiếp, legend rõ, nút “Vì sao xếp hạng?” mở H2H. Mobile giữ cột đội/điểm và scroll phần số liệu.
- Chi tiết trận: Tổng quan, Diễn biến, Đội hình. Bàn phản lưới ghi người phản lưới và đội hưởng bàn; luân lưu ở khu riêng.
- Bracket desktop có đường nối; mobile xem theo vòng với nhãn nguồn “Thắng TK1”. Vô địch chỉ xuất hiện khi chung kết chính thức.

### Cổng thư ký

- Danh sách trận theo ngày/sân và người được phân công. Trận đang tác nghiệp được ghim đầu và có nút tiếp tục.
- Quy trình đúng 5 bước sản phẩm: 1 Điểm danh & thông tin → 2 Đồng hồ → 3 Sự kiện → 4 Ký xác nhận → 5 Nộp biên bản. Đồng hồ vẫn tồn tại/chạy khi chuyển bước phù hợp.
- Match header sticky: đội, score, hiệp, phút, mạng, số thao tác pending. Nút “Bàn thắng”, “Thẻ”, “Luân lưu” đủ lớn để dùng một tay.
- Chọn cầu thủ qua số áo + tên + avatar; bàn thắng chỉ chọn người hợp lệ; thẻ có nhóm dự bị/cán bộ nếu điều lệ cho phép.
- Event mới có nhãn pending; Undo ngắn hạn cho thao tác vừa ghi, hủy event giữ lý do/audit. Đỏ và vàng thứ hai mở xác nhận có tên cầu thủ.
- Cuối trận checklist score/chữ ký/dữ liệu pending. Mất mạng vẫn ký/lưu nháp nhưng không tuyên bố BTC đã nhận.

### Cổng BTC

- Sidebar: Tổng quan, Trận đấu, Đội & cầu thủ, Kỷ luật, Lịch/Knockout, Cấu hình, Sao lưu, Nhật ký.
- Tổng quan ưu tiên việc cần xử lý: chờ duyệt, lệch score, cảnh báo kỷ luật, lỗi đồng bộ.
- Review hai cột: biên bản & timeline bên trái, checklist bên phải. Hiển thị score nhập/event đối chiếu từng đội. Nút duyệt khóa với lỗi chặn có giải thích ngay tại chỗ.
- Mở lại bắt buộc lý do; preview diff và danh sách trận/án bị ảnh hưởng trước xác nhận. Không dùng toast dài làm nơi duy nhất giải thích sai lệch.
- Backup/import có preview và lịch sử phục hồi; thao tác xóa/sinh lại yêu cầu đối chiếu tên giải, sao lưu và preview ảnh hưởng.

## 8. Lộ trình xử lý

1. Chốt nguồn DB chuẩn, xác thực/phân quyền, DTO public và bảo vệ backup.
2. Sửa H2H, vàng thứ hai, winner, pairing; mô hình ID, phase và event dùng chung frontend/backend.
3. Hoàn thiện offline/F5, version conflict, acknowledgement và state machine duyệt/mở lại.
4. Triển khai UI ba cổng theo prototype, kiểm A4/accessibility và UAT ngoài sân.
5. Chỉ kết luận phát hành sau khi chạy ma trận staging và đóng các lỗi bắt buộc; build/lint thành công không thay thế kiểm thử nghiệp vụ.
