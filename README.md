# Jelly Tangle

Puzzle game cho mobile web (GameJam 2026). Gỡ những bé sâu kẹo dẻo ra khỏi hộp sô-cô-la, cho chúng nhảy lên khay và phun màu lấp đầy bức tranh jelly.

**Chơi ngay:** https://sonnx-02.github.io/jelly-tangle/

Đây là bản làm lại hoàn toàn về hình ảnh và cảm giác chơi của prototype **Hose Out**, giữ nguyên bộ luật gốc. Tên "Jelly Tangle" là tên tạm, đổi ở `index.html`, `manifest.webmanifest` và logo trong `js/ui.js`.

## Chạy game

Không cần build, không cần Node. Toàn bộ là HTML/CSS/JS thuần.

```bash
python tools/dev_server.py
```

Mở http://localhost:5180/. Server này chỉ phục vụ file tĩnh (tắt cache để sửa là thấy ngay) và nhận dữ liệu từ công cụ nướng màn. Để chỉ chơi thì server tĩnh nào cũng được:

```bash
python -m http.server 5180
```

Mở thẳng `index.html` bằng trình duyệt cũng chạy được.

### Đưa lên web

Bản đang chạy nằm trên GitHub Pages của repo này (Settings → Pages → Deploy from a branch → `main` / root). Mỗi lần đẩy lên `main`, GitHub tự build lại sau khoảng một phút:

```bash
git push
```

Repo là một trang tĩnh nên cũng đẩy nguyên thư mục lên được Netlify, Cloudflare Pages hay itch.io (HTML5).

## Luật chơi

1. Chạm một bé sâu có **lối ra trống** phía trước mặt. Chạm nhầm bé bị chặn không làm thua, chỉ bớt sao: không chạm nhầm lần nào được 3 sao, 1–2 lần được 2 sao, từ 3 lần được 1 sao.
2. Sâu cuộn thành viên jelly, nhảy vào **ô trống đầu tiên** trên khay (ô có mũi tên) rồi tự phun màu lên tranh.
3. Tranh nhận màu theo **từng vòng từ ngoài vào**. Dải màu ngay dưới tranh cho biết vòng đang mở còn cần bao nhiêu ô mỗi màu; các vòng bên trong để trống cho tới khi mở. Viên jelly chưa tới lượt sẽ ngủ gật trên khay.
4. Số trên sâu là lượng màu. Hết màu thì viên jelly nổ và trả lại ô khay.
5. Hai viên **cùng màu đứng cạnh nhau** gộp làm một. Màu đã đủ thì được đổi thành xu.
6. Khay đầy mà không viên nào phun được là thua.

Hộp sâu nằm ngang: 8×6 ô (một số màn 7×6, màn 1 là 6×5).

Cơ chế mở dần: sâu nằm đè (màn 9), kẹo bọc giấy (màn 11), sâu chóng mặt (màn 13), pha màu (màn 15).
Trợ giúp mở dần: Gợi ý (màn 3), Kẹp gắp (màn 5), Thêm ô (màn 7).

## Cấu trúc

```
index.html              trang duy nhất
css/style.css           HUD, trang chủ, popup (mọi kích thước theo --u = 1% bề ngang cột game)
js/core.js              luật chơi, bộ sinh màn, solver, bot đo độ khó; không đụng DOM
js/level-data.js        60 màn đã nướng sẵn (file sinh ra, không sửa tay)
js/levels.js            nạp màn: lấy từ dữ liệu nướng, ngoài bảng thì sinh lúc chạy
js/game.js              màn chơi: hoạt ảnh, nhập liệu, hướng dẫn, trình tự thắng thua
js/render.js            nét vẽ Canvas 2D: sâu kẹo dẻo, viên jelly, ô tranh, khay
js/fx.js                hạt, chữ bay, xu bay
js/audio.js             âm thanh và nhạc nền tổng hợp bằng WebAudio (không có file âm thanh), rung
js/ui.js                trang chủ, HUD, toàn bộ popup
js/main.js              khởi động, vòng lặp, luồng màn hình, kinh tế trong game
js/i18n.js              chuỗi Tiếng Việt và English
js/util.js              toán, easing, màu, lưu tiến trình (localStorage)
tools/levels.html       công cụ nướng màn
tools/dev_server.py     server dev
```

Không có file ảnh hay âm thanh nào: toàn bộ hình là vẽ thủ tục trên Canvas, âm thanh là tổng hợp.

## Nướng màn chơi

Mỗi màn được sinh ngẫu nhiên theo cấu hình trong `LEVELS` (`js/core.js`), rồi phải qua hai bài kiểm tra: solver tìm được lời giải, và tỉ lệ thua của bot chơi ngẫu nhiên nằm trong dải độ khó của màn (dễ 0–25%, thường 25–55%, khó 55–85%). Màn đạt yêu cầu được **lưu nguyên dạng dữ liệu**, nạp lại và giải lại lần nữa để chắc chắn bản lưu đúng là bản đã kiểm tra.

Sau khi sửa `LEVELS`, `PICS` hay luật trong `core.js`:

1. Chạy `python tools/dev_server.py`.
2. Mở http://localhost:5180/tools/levels.html và bấm **Bake**.
3. Công cụ ghi lại `js/level-data.js`. Nếu có màn không đạt thì không ghi gì cả.

Lưu ý: bộ sinh màn từng dùng phép sắp xếp với bộ so sánh ngẫu nhiên, khiến cùng một seed có thể ra màn khác nhau tuỳ thời điểm chạy. Bộ so sánh đã được sửa cho nhất quán, và game không còn dựng màn từ seed nữa mà đọc thẳng dữ liệu đã nướng.

## Hiệu năng và hiển thị

- **Tần số quét:** vòng lặp chạy bằng `requestAnimationFrame` và mọi chuyển động tính theo thời gian thực, nên trình duyệt cấp 60, 90 hay 120 Hz thì game vẽ đúng chừng đó. Trang web không tự chọn được tần số quét; phần game lo là giữ cho mỗi khung hình đủ nhẹ.
- **Sâu đứng yên được dựng sẵn thành ảnh** (`wormSprite` trong `js/game.js`), chỉ con đang uốn, nháy hay phát sáng mới vẽ lại từng nét.
- **Tự hạ độ phân giải:** bộ đo trong `js/main.js` theo dõi khoảng cách giữa các khung. Khi hơn 30% khung đến trễ, canvas hạ một nấc (2,5x → 2x → 1,5x); nếu hạ mà không đỡ thì trả lại độ nét cũ và thôi không thử nữa.
- **Xem số liệu:** mở game với `?dev` trên địa chỉ (ví dụ `http://localhost:5180/?dev`) để hiện công tắc "Hiện FPS" trong Cài đặt, rồi bật nó để thấy `fps / Hz trình duyệt cấp / độ phân giải canvas`. Người chơi thường không thấy công tắc này.

## Màu sắc

- **Bảng màu kẹo** (`PALETTE` trong `js/core.js`) được chỉnh bằng số liệu: với mọi cặp màu cùng xuất hiện trong một bức tranh, tính khoảng cách CIEDE2000 ở mắt thường và ở ba dạng mù màu mô phỏng (Machado 2009). Mỗi màu chỉ dịch tối đa khoảng ΔE 9, chủ yếu về độ sáng, nên vẫn giữ đúng sắc kẹo. Cặp gần nhau nhất ở mắt thường từ ΔE 14 lên 17.
- **Viền sáng cho kẹo tối:** sâu nào có độ tương phản WCAG dưới 4:1 với nền sô-cô-la thì có thêm viền sáng (`haloOf` trong `js/render.js`).
- **Ký hiệu màu** (Cài đặt → Ký hiệu màu, mặc định tắt): mỗi màu có một hình riêng (tim, tam giác, sao, …), hiện trên thân sâu, trên viên jelly, trên dải màu và ở ô tranh của vòng đang mở. Dành cho người mù màu; vài cặp như Lam/Tím gần như trùng nhau với người mù màu đỏ-lục, chỉnh màu không tách hẳn được.
- **Mỗi trang bộ sưu tập có phông nền riêng** (`ALBUM[].bg` trong `js/core.js`): Ngày nắng hồng đào, Phiêu lưu xanh trời, Tiệm bánh hồng kem, Đại dương xanh ngọc, Rừng xanh xanh lá. Trang chủ dùng phông của màn kế tiếp.

## Âm thanh

Toàn bộ là tổng hợp bằng WebAudio (`js/audio.js`). Mức âm lượng đã được đo chứ không chỉnh theo cảm tính: mỗi âm được dựng lại trong `OfflineAudioContext` và đo đoạn 50 ms to nhất sau bộ nén.

| Nhóm | Âm | Mức to nhất (50 ms) |
|---|---|---|
| Ăn mừng | xong tranh, xong vòng, sao, thua | −14 đến −19 dB |
| Hành động của người chơi | kéo sâu, đáp khay, gộp, pha màu, đụng vật cản | khoảng −21 đến −24 dB |
| Âm lặp nhiều lần | phun màu, xu, nổ viên jelly | −29 đến −34 dB |
| Nhạc nền | | khoảng −34 dB (cửa sổ 400 ms), tự hạ khi ăn mừng |

Mọi âm có cao độ đều nằm trong thang ngũ cung Đô trưởng, cùng giọng với nhạc nền. Âm gỗ và chuông dùng FM hai toán tử, thêm một phòng vang ngắn, và có biến thiên ngẫu nhiên nhỏ để âm lặp lại không nghe như máy. Khi quá nhiều âm dồn cùng lúc (mưa xu cuối màn), các âm ít quan trọng tự bị bỏ bớt.
- **Dark mode của điện thoại:** game chỉ có một bảng màu sáng. `index.html` và `css/style.css` khai báo `color-scheme` để Chrome, Samsung Internet và WebView trong app không tự đổi màu trang.

## Kiểm thử tự động

Trong console của trang game:

```js
JT.Debug.advance(2000)        // chạy vòng lặp 2 giây không cần requestAnimationFrame, trả về trạng thái
JT.Debug.play(20, 1500)       // làm theo Gợi ý 20 bước, mỗi bước cách 1,5 giây (Gợi ý bảo chờ thì chờ)
JT.Debug.tick(t)              // chạy đúng một vòng lặp tại mốc thời gian t (ms): giả lập nhịp khung hình bất kỳ
JT.Game.debug.state()         // trạng thái màn hiện tại
JT.App.startLevel(8)          // nhảy tới màn 9 (chỉ số tính từ 0)
JT.Save.reset()               // xoá tiến trình
```

## Trạng thái

Đã có: 60 màn, 30 tranh trong 5 trang bộ sưu tập, 4 cơ chế nâng cao, 3 trợ giúp, sao, xu, hướng dẫn màn đầu, hai ngôn ngữ, lưu tiến trình.

Chưa có: quảng cáo và mua trong ứng dụng (giá xu hiện chỉ để minh hoạ), service worker cho chơi offline, tệp font đóng gói sẵn (đang tải Baloo 2 và Nunito từ Google Fonts).
