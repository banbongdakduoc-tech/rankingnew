# 🚀 HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG LÊN NETLIFY & RENDER

Hệ thống **Dược Premier League 2026** đã được xây dựng hoàn chỉnh với kiến trúc tách biệt Frontend & Backend bảo mật cao:
- **Frontend (Giao diện Khán giả, Thư ký, Ban Tổ Chức)**: Triển khai lên **Netlify**.
- **Backend (API Server + Database An Toàn + WebSocket Realtime)**: Triển khai lên **Render.com**.

---

## 🌟 PHẦN 1: TRIỂN KHAI BACKEND LÊN RENDER.COM (Làm trước)

### Bước 1: Đẩy mã nguồn lên GitHub / GitLab
1. Khởi tạo Git (nếu chưa có) và push toàn bộ mã nguồn dự án lên repository của bạn trên GitHub.

### Bước 2: Tạo Web Service trên Render
1. Đăng nhập vào [Render Dashboard](https://dashboard.render.com/).
2. Bấm nút **New +** ➔ Chọn **Web Service**.
3. Chọn Repository GitHub dự án `duoc-premier-league`.
4. Điền các thông số cấu hình như sau:
   - **Name**: `duoc-premier-league-backend` (hoặc tên tùy thích).
   - **Region**: `Singapore` (để tốc độ truyền tải về Việt Nam nhanh nhất).
   - **Branch**: `main` (hoặc `master`).
   - **Runtime**: `Node`.
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (hoặc Starter).

### Bước 3: Thêm Biến Môi Trường (Environment Variables) trên Render
Tại mục **Environment Variables**, thêm các cặp khóa - giá trị sau:
- `NODE_ENV`: `production`
- `PORT`: `5000`
- `JWT_SECRET`: `duoc_premier_league_2026_super_secret_jwt_key_secure_xyz` (hoặc chuỗi bí mật của bạn)
- `ADMIN_USER`: `admin`
- `ADMIN_PASSWORD`: `btc2026`
- `REFEREE_USER`: `thuky`
- `REFEREE_PASSWORD`: `thuky2026`
- `CLIENT_URL`: `*` (hoặc điền link Netlify sau khi tạo xong ở Phần 2).

5. Bấm **Create Web Service**.
6. Chờ Render build và khởi chạy trong 1-2 phút. Sau khi xong, bạn sẽ nhận được **Backend URL** (Ví dụ: `https://duoc-premier-league-backend.onrender.com`).

---

## 🌐 PHẦN 2: TRIỂN KHAI FRONTEND LÊN NETLIFY

### Bước 1: Tạo Site mới trên Netlify
1. Đăng nhập vào [Netlify Dashboard](https://app.netlify.com/).
2. Bấm **Add new site** ➔ Chọn **Import an existing project** ➔ Chọn **GitHub**.
3. Chọn repository `duoc-premier-league`.

### Bước 2: Cấu hình Build & Deploy trên Netlify
1. Các thông số cấu hình Netlify sẽ tự động nhận diện từ file `netlify.toml`:
   - **Base directory**: để trống.
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
2. **Thêm Biến Môi Trường (Environment Variables) trên Netlify**:
   - Bấm vào **Site configuration** ➔ **Environment variables** ➔ **Add variable**:
     * **Key**: `VITE_API_URL`
     * **Value**: Điền link Backend trên Render ở Phần 1 (Ví dụ: `https://duoc-premier-league-backend.onrender.com`)

3. Bấm **Deploy Site**.
4. Netlify sẽ biên dịch và cấp cho bạn một tên miền miễn phí (Ví dụ: `https://duoc-premier-league.netlify.app`).

---

## 🔒 PHẦN 3: TÀI KHOẢN ĐĂNG NHẬP MẶC ĐỊNH

| Vai Trò | Tên Đăng Nhập | Mật Khẩu | Quyền Hạn |
|---|---|---|---|
| **Ban Tổ Chức (BTC)** | `admin` | `btc2026` | Quản trị mùa giải, sinh lịch, duyệt kết quả, nạp đội, knockout, backup |
| **Thư Ký Bàn** | `thuky` | `thuky2026` | Bấm giờ trực tiếp, ghi bàn, rút thẻ, nộp biên bản & ký tên |
| **Khán Giả** | Không cần tài khoản | — | Xem BXH, kết quả, tỉ số, diễn biến trực tiếp |

*(Bạn có thể đổi mật khẩu bất kỳ lúc nào tại mục Environment Variables trên Render)*.

---

## 📦 PHẦN 4: SAO LƯU & AN TOÀN DỮ LIỆU (BACKUP & RESTORE)

- **Tự động sao lưu**: Mỗi khi có thay đổi lớn hoặc reset giải đấu, backend tự động lưu một bản backup trong thư mục `server/storage/backups/`.
- **Sao lưu thủ công**: BTC có thể bấm nút xuất file backup bất kỳ lúc nào để tải về máy tính file `.json` chứa 100% dữ liệu giải đấu và khôi phục lại chỉ với 1 click.
