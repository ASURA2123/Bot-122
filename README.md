# Facebook Messenger Bot

Bot Messenger sử dụng Node.js và facebook-chat-api với cấu trúc code rõ ràng và khả năng xử lý lỗi tốt.

## Cài đặt

1. Clone repository
2. Chạy `npm install` để cài đặt các dependencies
3. Copy file `.env.example` thành `.env` và điền các thông tin cần thiết:
   - FB_EMAIL: Email hoặc số điện thoại Facebook
   - FB_PASSWORD: Mật khẩu Facebook
4. Khởi động bot bằng lệnh `npm run dev`

## Lưu ý bảo mật

- **KHÔNG CHIA SẺ** thông tin đăng nhập của bạn cho người khác
- Nên sử dụng tài khoản Facebook riêng cho bot thay vì tài khoản chính
- Bot sẽ tự động lưu trạng thái đăng nhập vào file `fbstate.json` để sử dụng cho lần sau

## Tính năng

- [x] Đăng nhập an toàn qua email/password
- [x] Tự động thử lại khi mất kết nối
- [x] Xử lý tin nhắn nhóm và cá nhân 
- [x] Hệ thống lệnh với prefix
- [x] Phân quyền admin/owner
- [x] Chống out nhóm
- [x] Tự động làm mới phiên đăng nhập
- [ ] Bảng điều khiển xem log lỗi

## Cách xử lý khi gặp lỗi

1. **Lỗi đăng nhập**: 
   - Kiểm tra thông tin đăng nhập trong file .env
   - Thử đăng nhập lại Facebook trên trình duyệt để xác nhận tài khoản còn hoạt động
   - Xóa file fbstate.json và thử khởi động lại bot

2. **Lỗi checkpoint**:
   - Đăng nhập Facebook trên trình duyệt và xác nhận các thông báo bảo mật
   - Cập nhật lại thông tin đăng nhập trong .env nếu cần

3. **Lỗi mất kết nối**:
   - Bot sẽ tự động thử kết nối lại
   - Kiểm tra kết nối mạng
   - Kiểm tra logs để xem chi tiết lỗi

## Đóng góp

Mọi đóng góp và phản hồi đều được chào đón! Vui lòng tạo issue hoặc pull request.