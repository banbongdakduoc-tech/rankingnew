# Hướng dẫn sử dụng Dược Premier League

Cập nhật: **06/10/2026**, nhánh **demo**. Hướng dẫn theo hành vi hiện có của ứng dụng.

## 1. Các cổng và trạng thái trận

| Cổng | Đường dẫn | Người sử dụng |
|---|---|---|
| Khán giả | `/` | Xem BXH, lịch/kết quả, thống kê, sơ đồ knockout và đội hình |
| Thư ký | `/thuky` | Tác nghiệp những trận được BTC phân công |
| Ban tổ chức | `/btc` | Cấu hình, quản lý cầu thủ, lịch, duyệt biên bản, kỷ luật, tài khoản và dữ liệu |

Luồng trận: **Sắp diễn ra → Đang LIVE → Chờ duyệt → Đã xong**. BTC có thể trả biên bản thành **Bị từ chối** để thư ký sửa và nộp lại. Trận đã duyệt phải được BTC mở lại trước khi sửa.

**STT trận** được tính trên toàn giải theo ngày giờ, không bắt đầu lại khi lọc bảng/đội hoặc vào knockout. Đổi lịch có thể đổi STT; mã trận vẫn là định danh ổn định. Trận chưa xếp giờ nằm cuối. Thứ tự nhánh knockout dựa vào tên Tứ Kết 1–4/Bán Kết 1–2, không dựa vào STT hoặc thứ tự giờ đá.

## 2. Chuẩn bị giải bằng tài khoản BTC

1. Đăng nhập `/btc`. Trong giai đoạn cấu hình, nhập tên giải, đơn vị tổ chức, logo, thể thức, số bảng, thời lượng hiệp và knockout.
2. Thể thức knockout bắt đầu từ tứ kết cần 8 suất, từ bán kết cần 4 suất. Các tổ hợp hiện hỗ trợ: **1, 2 hoặc 4 bảng**, với đủ số đội cần thiết.
3. Nhập đội và cầu thủ, kiểm tra số áo/tên đội rồi sinh lịch vòng bảng.
4. Điền ngày giờ Việt Nam, sân, trọng tài và **thư ký phụ trách** cho từng trận. Chốt lịch/khởi tranh khi đã kiểm tra đủ cặp đấu.
5. Tạo tài khoản thư ký ở mục riêng, sau đó phân công tài khoản đó vào lịch.

### Lưu ý cấu hình và lịch

- Chọn điều lệ trước khi bắt đầu tác nghiệp. Các trường quan trọng như thể thức, thời lượng hiệp, ngưỡng vàng, luân lưu và hiệp phụ bị khóa khi giải đã có trận tác nghiệp.
- Logo, tên giải và đơn vị tổ chức có mục chỉnh sửa riêng cho BTC.
- Giờ nhập là giờ Việt Nam; hệ thống lưu UTC và hiển thị lại giờ Việt Nam.
- Cùng sân không được có hai trận chồng thời lượng. Một đội cần đủ khoảng nghỉ cấu hình giữa hai trận.
- Tên trọng tài/tên thư ký ghi trên biên bản khác với **tài khoản thư ký phụ trách**. Chỉ nhập tên người tác nghiệp không tự cấp quyền tài khoản.
- Thay toàn bộ lịch khi đã có trận tác nghiệp sẽ bị chặn. Chỉnh từng trường lịch để sửa những trận được phép.

## 3. Tài khoản và cầu thủ

### Tạo tài khoản thư ký

BTC → **Tài khoản thư ký** → nhập họ tên, tên đăng nhập và mật khẩu → tạo → quay lại lịch để phân công.

- Tên đăng nhập: 3–40 ký tự, chữ thường/số/`_`/`-`; không trùng tài khoản đã có.
- Mật khẩu ít nhất 12 ký tự; giới hạn phía máy chủ là 72 byte UTF-8. Ứng dụng bảo vệ mật khẩu tự động.
- Tài khoản tạo trong Firebase Authentication không tự trở thành tài khoản của ứng dụng. Dùng chức năng tạo thư ký của BTC; tài khoản admin khởi tạo theo hướng dẫn triển khai.
- Thư ký đăng nhập được nhưng không thấy trận: kiểm tra tài khoản đã được phân công trận đó hay chưa.

### Danh sách cầu thủ

Chọn đội → thêm thủ công hoặc import JSON → kiểm tra bản xem trước → chọn **gộp** hoặc **thay thế** → lưu. Tải ảnh từ máy/điện thoại để cắt vuông và nén.

- JSON import cầu thủ khác với JSON backup toàn giải; không dùng lẫn hai chức năng.
- Kiểm tra đúng đội, số áo và tên trước khi xác nhận. Không cho số áo trùng trong một đội.
- Ảnh phải là định dạng được hỗ trợ và không vượt giới hạn upload; dùng công cụ cắt ảnh thay vì dán ảnh lớn vào JSON.
- Cầu thủ đã có biên bản cần giữ mã ID; không xóa rồi tạo lại để đổi tên/số áo. Đổi hồ sơ giữ lịch sử trong biên bản cũ.
- Thư ký không tự bổ sung cầu thủ ngoài danh sách chính thức; yêu cầu BTC cập nhật.

## 4. Thư ký tác nghiệp: 5 bước

### Bước 1 — Chọn trận

Đăng nhập `/thuky`, lọc bảng hoặc tìm đội, chọn đúng trận theo cặp đấu và ngày giờ. Trận LIVE/bị trả lại có nút tiếp tục; trận đã nộp/duyệt không được sửa trực tiếp.

### Bước 2 — Thông tin trận và tổ trọng tài

Kiểm tra ngày giờ, nhập đầy đủ trọng tài và tên thư ký ghi biên bản rồi lưu. Sân được BTC nhập trong lịch.

### Bước 3 — Treo giò và điểm danh

Đọc cảnh báo cầu thủ bị cấm thi đấu. Điểm danh **không bắt buộc**, không có số lượng tối thiểu để bắt đầu trận.

- Không điểm danh không có nghĩa được dùng cầu thủ treo giò. Hệ thống vẫn chặn ghi nhận bàn thắng/luân lưu của cầu thủ còn án và chặn đánh dấu cầu thủ treo giò ra sân.
- Khi có sai sót về án, BTC kiểm tra trận nguồn và quyết định gỡ án; không đổi tên cầu thủ để né cảnh báo.

### Bước 4 — Đồng hồ, sự kiện và luân lưu

Bắt đầu trận → dùng tạm dừng/tiếp tục/nghỉ giữa hiệp/sang hiệp → chọn đội, cầu thủ, loại sự kiện → kiểm tra phút → lưu.

- Phút có thể tự lấy từ đồng hồ hoặc nhập bù giờ như `20+1`, `40+2`. Chọn đúng hiệp; không dùng phút âm hoặc ký hiệu không hợp lệ.
- Bàn thường/penalty trong trận cộng cho đội ghi bàn. Phản lưới ghi tên cầu thủ của đội phạm lỗi và cộng bàn cho đối thủ; không tính Vua phá lưới.
- Hai vàng cùng trận được chuẩn hóa thành vàng thứ hai/truất quyền. Thẻ vàng trong loạt luân lưu tách khỏi vàng trong thời gian thi đấu.
- Xóa sự kiện là hủy có lịch sử, không xóa dấu vết tác nghiệp. Kiểm tra lại tỷ số sau khi hủy.

#### Luân lưu

Chỉ thực hiện khi trận knockout hòa; nếu cấu hình hiệp phụ thì phải hoàn tất hai hiệp phụ trước. Chọn đội và cầu thủ, ghi **Vào/Trượt** từng lượt.

- Bảng luân lưu chia theo đội; lượt 1 của đội A đối chiếu lượt 1 của đội B. Có thể chọn đội khách sút trước, sau đó phải luân phiên.
- Một cầu thủ phải chờ các cầu thủ đủ điều kiện khác sút hết vòng trước khi sút lại.
- Đỏ trực tiếp/vàng thứ hai hiện ngay ở khu vực luân lưu và khóa chọn cầu thủ. Thẻ đã hủy không còn khóa; vàng ở hai giai đoạn không bị cộng nhầm thành vàng thứ hai.
- Khi đã phân thắng bại sớm, nút ghi lượt tiếp theo bị khóa. Đột tử chỉ chốt thắng sau đủ một cặp lượt.
- Hủy lượt cuối/đá lại chỉ dùng để sửa lượt sai. Tổng tỷ số được tính lại từ các lượt còn hiệu lực, dùng chung cho tổng kết và bản in.
- Thao tác sai bị chặn trước khi gửi. Máy chủ vẫn kiểm tra lại; thao tác bị từ chối do không hợp lệ không nằm trong hàng đợi chờ đối chiếu. Xung đột do thiết bị khác sửa vẫn cần xử lý.
- Luân lưu không cộng vào tỷ số thời gian thi đấu, BXH vòng bảng hoặc Vua phá lưới.

### Bước 5 — Kiểm tra, ký và nộp

Kết thúc trận → đối chiếu tỷ số, sự kiện, luân lưu → nhập ghi chú nếu có → lấy chữ ký đội trưởng hai đội và trọng tài → nộp lên BTC.

- Ghi chú thư ký là tùy chọn; ba chữ ký là bắt buộc trong luồng nộp thông thường.
- Chỉ nộp khi có kết nối và không còn thao tác hợp lệ chờ gửi/xung đột. Nút nộp sẽ thử gửi hết hàng đợi trước.
- Kiểm tra nội dung trước khi ký. Khi sửa nội dung, cần đối chiếu lại chữ ký; đừng dùng chữ ký cũ cho nội dung mới.
- Có thể in A4 để kiểm tra/đối chiếu; bản in không thay thao tác nộp và duyệt.

## 5. Mất mạng, F5 và chấm trạng thái

Chấm cuối trang: **xanh** đã kết nối; **cam** đang kết nối/chờ đồng bộ/cần xử lý; **đỏ** mất kết nối. Chạm để đọc chi tiết, gửi lại nháp hoặc xem xung đột.

- Thao tác hợp lệ khi offline được giữ trên trình duyệt theo tài khoản. Kết nối lại sẽ gửi theo hàng đợi; ID thao tác giúp tránh ghi trùng khi retry.
- F5 có thể khôi phục nháp/đồng hồ/chữ ký đã lưu trên máy. Vẫn kiểm tra lại sau khi khôi phục, nhất là khi thiết bị khác hoặc BTC đã cập nhật phiên bản trận.
- Không xóa dữ liệu trình duyệt/đăng xuất/đóng cửa sổ ẩn danh khi còn nháp chưa đồng bộ. Nháp trên máy không tự chuyển sang điện thoại hoặc máy khác.
- Thông báo “trận đã thay đổi trên thiết bị khác”: dừng tác nghiệp cùng lúc, xuất nháp để đối chiếu, rồi xử lý theo bản mới nhất. Không bỏ thao tác hợp lệ một cách tùy tiện.
- Cửa sổ ẩn danh xóa dữ liệu khi đóng phiên; ưu tiên trình duyệt thường cho tác nghiệp ngoài sân.

## 6. BTC duyệt, trả lại và mở lại biên bản

Điều hành → danh sách biên bản chờ duyệt → **Xem & Duyệt** → đối chiếu tỷ số với từng bàn → kiểm tra thẻ/luân lưu/chữ ký → duyệt.

- Giữ nguyên nội dung thư ký đã nộp và đủ chữ ký: **không phải điền ghi chú BTC**.
- Nếu sửa nội dung hoặc xử lý ngoại lệ thiếu chữ ký, phải có lý do. Đồng bộ lại tỷ số không thay việc kiểm tra đúng người ghi bàn.
- Tỷ số không khớp sự kiện bị chặn; chỉ kết quả hành chính/xử thua có lý do mới dùng luồng riêng, không tạo cầu thủ ghi bàn giả.
- Trả lại cần lý do để thư ký biết cần sửa gì. BTC duyệt xong thì khán giả mới nhận kết quả/thống kê chính thức.
- Mở lại trận đã duyệt phải ghi lý do; hệ thống lưu phiên bản trước, hủy chữ ký cũ và khóa các trận phụ thuộc chưa bắt đầu.
- Nếu trận phụ thuộc đã bắt đầu, việc mở lại bị chặn. BTC cần xử lý toàn nhánh trước, không chỉ sửa tỷ số trận nguồn.

## 7. Kỷ luật và trận nguồn

Cảnh báo tự động dựa trên các trận **đã được BTC duyệt**: đỏ trực tiếp, vàng thứ hai cùng trận hoặc đủ ngưỡng vàng qua các trận.

1. Đọc tên cầu thủ, đội, lỗi và **trận nguồn**: STT, cặp đấu, vòng, thời gian; có nút xem biên bản nguồn.
2. Chọn treo giò và số trận cấm (1–20, tổng án tối đa 20) hoặc ân xá cảnh báo có lý do.
3. Kiểm tra danh sách đang cấm: trận nguồn vẫn hiển thị, cùng số trận còn lại. Gỡ án cần lý do.

- Cảnh báo và án đã duyệt là hai bước khác nhau. Đỏ/vàng thứ hai đã truất quyền trong trận vẫn làm cầu thủ không được sút luân lưu ngay cả khi BTC chưa quyết định án trận sau.
- Tẩy vàng khi vào knockout chỉ tẩy tích lũy theo cấu hình, không xóa lịch sử thẻ hoặc án còn phải chấp hành.
- Án giảm khi duyệt trận tiếp theo đủ điều kiện; không giảm hai lần khi duyệt lại, không giảm vì xử thua hành chính hoặc khi cầu thủ bị cấm vẫn được ghi nhận tham gia.
- Nếu biên bản nguồn bị sửa/mở lại khiến căn cứ án thay đổi, hệ thống ghi cần xét lại. BTC phải đối chiếu rồi quyết định.
- Nếu trận nguồn không còn trong lịch hiện hành, hiển thị thông tin đã lưu/mã trận thay vì gán nhầm sang trận khác.

## 8. Knockout: suất đi tiếp và nhánh đấu

Chỉ sinh cặp khi **mọi trận vòng bảng đã duyệt** và đủ suất. `A1/A2` dưới đây nghĩa là **nhất/nhì bảng A**, không phải đội có tên “Dược A1/A2”. Bảng A/B/C/D theo thứ tự bảng đang cấu hình.

### 4 bảng, bắt đầu từ tứ kết (2 đội/bảng)

| Vị trí nhánh | Cặp đấu |
|---|---|
| Tứ Kết 1 | Nhất A – Nhì B |
| Tứ Kết 2 | Nhất C – Nhì D |
| Tứ Kết 3 | Nhất B – Nhì A |
| Tứ Kết 4 | Nhất D – Nhì C |
| Bán Kết 1 | Thắng Tứ Kết 1 – Thắng Tứ Kết 2 |
| Bán Kết 2 | Thắng Tứ Kết 3 – Thắng Tứ Kết 4 |
| Chung Kết | Thắng Bán Kết 1 – Thắng Bán Kết 2 |
| Tranh Hạng 3 | Thua Bán Kết 1 – Thua Bán Kết 2 |

Đổi giờ Tứ Kết 3 đá trước Tứ Kết 1 chỉ đổi STT lịch, **không đổi vị trí nhánh**.

### Các cấu hình khác

| Cấu hình | Cặp vòng đầu theo thứ tự 1 → 4 |
|---|---|
| 2 bảng → tứ kết (4 đội/bảng) | A1–B4; B2–A3; B1–A4; A2–B3 |
| 1 bảng → tứ kết (8 đội) | Hạng 1–8; 4–5; 2–7; 3–6 |
| 4 bảng → bán kết (nhất mỗi bảng) | A1–D1; B1–C1 |
| 2 bảng → bán kết (2 đội/bảng) | A1–B2; B1–A2 |
| 1 bảng → bán kết (4 đội) | Hạng 1–4; 2–3 |

### Quy trình tạo vòng sau

1. BTC sinh cặp gợi ý, đối chiếu BXH, kiểm tra cặp rồi nhập lịch. Nếu chỉnh đội gợi ý, đối chiếu điều lệ trước khi tạo.
2. Duyệt đủ 4 tứ kết và xác định winner mới tạo 2 bán kết. Nếu bắt đầu từ bán kết thì bỏ bước tứ kết.
3. Duyệt đủ 2 bán kết mới tạo chung kết và tranh hạng 3.
4. Điền sân, giờ và phân công thư ký cho các trận mới. Không coi “đã tạo trận” là “đã xếp lịch”.
5. Không tự tráo nhãn Tứ Kết/Bán Kết để đổi thứ tự giờ đá. Tên vòng giữ vị trí nhánh; lịch quyết định STT.

BXH: thắng 3/hòa 1/thua 0 → điểm → đối đầu (bảng phụ điểm/hiệu số/bàn thắng, xét lại nhóm con nếu còn hòa) → hiệu số toàn bảng → bàn thắng → tên. Ba đội bằng điểm phải xét cả tam giác đối đầu, không chỉ một cặp trận.

## 9. Khán giả

Mở `/`, dùng các tab BXH, Lịch & Kết quả, Knockout, thống kê và đội hình. Bộ lọc đội nằm trong **Lịch & Kết quả**, cạnh tìm kiếm và bảng/vòng.

- Kết quả/BXH/Vua phá lưới chính thức chỉ tính trận đã duyệt; LIVE có hiển thị trực tiếp riêng.
- Chưa thấy kết quả sau thư ký nộp: BTC cần duyệt; không phải khán giả cần đăng nhập.
- Phản lưới và sút luân lưu không tính Vua phá lưới. Penalty ghi trong trận vẫn tính.

## 10. Sao lưu, phục hồi và dữ liệu test

BTC → **Điều lệ & dữ liệu** → xuất database JSON → giữ bản hiện hành → xem trước phục hồi → kiểm tra số đội/trận → xác nhận.

- Chỉ dùng backup `schemaVersion: 2`. Phục hồi thay dữ liệu giải; giữ tài khoản hiện có, tạo backup trước phục hồi và kiểm tra toàn vẹn.
- Backup không chứa mật khẩu/tài khoản. Không import backup vào Firebase root bằng tay để sử dụng chức năng phục hồi.
- Dữ liệu mẫu vòng bảng trong `test-data/` là bộ test để sinh knockout, không phải bản sao toàn bộ ghi chú/chữ ký/phân công của giải thật.
- Reset mùa cần nhập đúng tên giải; lưu hồ sơ mùa và backup, giữ tài khoản. Chỉ reset sau khi đã xuất dữ liệu cần giữ.

## 11. Lỗi thao tác thường gặp

| Hiện tượng | Kiểm tra và xử lý |
|---|---|
| Không đăng nhập được dù đã tạo trên Firebase | Tạo đúng tài khoản ứng dụng; kiểm tra username/mật khẩu và tài khoản bị khóa |
| Thư ký không thấy trận | BTC phân công đúng tài khoản trong lịch |
| Thiếu thông tin ở bước 2 | Điền ngày giờ, trọng tài và tên thư ký |
| Chưa điểm danh nên lo không bắt đầu được | Điểm danh tùy chọn; kiểm tra treo giò là phần cần chú ý |
| Tỷ số sai sau phản lưới | Chọn đội của người phản lưới; bàn được cộng cho đối phương |
| Không chọn được người sút | Xem đỏ/vàng thứ hai, treo giò, cầu thủ đã sút và lượt đội |
| Không ghi thêm được pen | Có thể đã phân thắng bại; chỉ hủy lượt cuối nếu lượt đó sai |
| Tổng kết pen khác lượt sút | Dùng phiên bản mới; kiểm tra hàng đợi và từng lượt, không tự nhập tổng pen |
| Nộp bị chặn | Đủ ba chữ ký, có mạng, hết nháp hợp lệ/xung đột; mở chấm trạng thái để đọc lý do |
| BTC bị yêu cầu lý do khi duyệt | Kiểm tra thực sự có sửa nội dung hoặc thiếu chữ ký; nguyên trạng đủ chữ ký không cần ghi chú |
| Không tạo knockout/bán kết/chung kết được | Đủ suất, duyệt hết vòng trước, winner đã xác định, đúng thể thức cấu hình |
| Bị chặn đổi lịch | Kiểm tra sân trùng, khoảng nghỉ, phiên bản và trạng thái đã duyệt |
| Án kỷ luật không đúng kỳ vọng | Xem biên bản trận nguồn, thẻ bị hủy, phase luân lưu, án còn lại và cờ cần xét lại |

## 12. Phạm vi kiểm thử

Báo cáo chạy và giới hạn kiểm thử nằm trong [QA ngày 06/10/2026](QA-LOGIC-2026-10-06.md). Kiểm thử tự động dùng bộ nhớ/API local, không nộp hay duyệt thay các biên bản người dùng đang test trên cloud.
