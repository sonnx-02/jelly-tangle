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

Màn 1–10 là màn thiết kế tay (bộ màn của nhóm, xem "Nướng màn chơi"); từ màn 11 là màn sinh tự động.
Cơ chế mở dần: sâu nằm đè (màn 3), kẹo bọc giấy (màn 6), sâu chóng mặt (màn 9), pha màu (màn 15).
Trợ giúp mở dần: Gợi ý (màn 3), Kẹp gắp (màn 5), Thêm ô (màn 7).
Màn khó có nhãn đỏ "KHÓ"; màn 10 là màn "SIÊU KHÓ" (bot chơi ngẫu nhiên thua khoảng 88%).

## Cấu trúc

```
index.html              trang duy nhất
css/style.css           HUD, trang chủ, popup (mọi kích thước theo --u = 1% bề ngang cột game)
js/core.js              luật chơi, bộ sinh màn, solver, bot đo độ khó; không đụng DOM
js/level-data.js        60 màn có sẵn: 10 màn thiết kế + 50 màn nướng (file sinh ra, không sửa tay)
js/levels.js            nạp màn: lấy từ dữ liệu nướng, ngoài bảng thì sinh lúc chạy
js/game.js              màn chơi: hoạt ảnh, nhập liệu, hướng dẫn, trình tự thắng thua
js/render.js            nét vẽ Canvas 2D: sâu kẹo dẻo, viên jelly, ô tranh, khay
js/fx.js                hạt, chữ bay, xu bay
js/audio.js             âm thanh và nhạc nền tổng hợp bằng WebAudio (không có file âm thanh), rung
js/ui.js                trang chủ, HUD, toàn bộ popup
js/cheat.js             bảng cheat để test (chạm 5 lần vào chữ "Màn N")
js/main.js              khởi động, vòng lặp, luồng màn hình, kinh tế trong game
js/i18n.js              chuỗi Tiếng Việt và English
js/util.js              toán, easing, màu, lưu tiến trình (localStorage)
tools/levels.html       công cụ nướng màn
tools/import_levels.py  nhập bộ màn thiết kế (file JSON) vào js/level-data.js
tools/dev_server.py     server dev
```

Chỉ có một file ảnh: bàn tay chỉ hướng dẫn (`assets/hand.png`, 115×145). Còn lại toàn bộ hình là vẽ thủ tục trên Canvas, âm thanh là tổng hợp, không có file âm thanh nào.

## Nướng màn chơi

Mỗi màn được sinh ngẫu nhiên theo cấu hình trong `LEVELS` (`js/core.js`), rồi phải qua hai bài kiểm tra: solver tìm được lời giải, và tỉ lệ thua của bot chơi ngẫu nhiên nằm trong dải độ khó của màn (dễ 0–25%, thường 25–55%, khó 55–85%, siêu khó 85–95%, hoặc dải `target` riêng của màn). Màn đạt yêu cầu được **lưu nguyên dạng dữ liệu**, nạp lại và giải lại lần nữa để chắc chắn bản lưu đúng là bản đã kiểm tra.

Sau khi sửa `LEVELS`, `PICS` hay luật trong `core.js`:

1. Chạy `python tools/dev_server.py`.
2. Mở http://localhost:5180/tools/levels.html và bấm **Bake**.
3. Công cụ ghi lại `js/level-data.js`. Nếu có màn không đạt thì không ghi gì cả.

### Màn thiết kế tay (màn 1–10)

Màn 1–10 lấy từ bộ màn của nhóm (file JSON: mỗi màn có mô tả dễ đọc và bản `baked` đúng định dạng `JT.LEVEL_DATA`). Nhập bằng:

```
python tools/import_levels.py duong/dan/jelly_tangle_levels_1-10.json
```

- Công cụ kiểm tra bản `baked` khớp với phần mô tả (kích thước hộp, số ô khay, tranh, từng con sâu: màu, lượng màu, ô, hướng đầu, ai đè ai), rồi thay đúng các màn có trong file; các màn khác giữ nguyên.
- Bộ màn vẽ hộp dọc (5×6, 6×7, 6×8) theo bố cục cũ, nên mỗi màn được **xoay một góc vuông** sang hộp ngang (6×5, 7×6, 8×6), hướng đầu sâu và hướng quay của sâu chóng mặt xoay theo. Câu đố không đổi: solver ra đúng lời giải ghi trong file, tỉ lệ thua của bot trùng khớp tuyệt đối với hộp gốc (cùng seed, 3000 lượt). Muốn giữ hộp dọc thì thêm `--keep-orientation`.
- `LEVELS[0..9]` trong `js/core.js` mang `designed: true` và `target` (dải tỉ lệ thua trong file). Kích thước hộp, số ô khay và tranh ở đó phải khớp dữ liệu, nếu không game sẽ bỏ dữ liệu và tự sinh màn khác. Khi **Bake**, `tools/levels.html` giữ nguyên các màn `designed` (sau khi giải lại để chắc chúng vẫn qua được) và chỉ sinh lại các màn còn lại.

Lưu ý: bộ sinh màn từng dùng phép sắp xếp với bộ so sánh ngẫu nhiên, khiến cùng một seed có thể ra màn khác nhau tuỳ thời điểm chạy. Bộ so sánh đã được sửa cho nhất quán, và game không còn dựng màn từ seed nữa mà đọc thẳng dữ liệu đã nướng.

## Hiệu năng và hiển thị

- **Tần số quét:** vòng lặp chạy bằng `requestAnimationFrame` và mọi chuyển động tính theo thời gian thực, nên trình duyệt cấp 60, 90 hay 120 Hz thì game vẽ đúng chừng đó. Trang web không tự chọn được tần số quét; phần game lo là giữ cho mỗi khung hình đủ nhẹ.
- **Sâu đứng yên được dựng sẵn thành ảnh** (`wormSprite` trong `js/game.js`), chỉ con đang uốn, nháy hay phát sáng mới vẽ lại từng nét.
- **Tự hạ độ phân giải:** bộ đo trong `js/main.js` theo dõi khoảng cách giữa các khung. Khi hơn 30% khung đến trễ, canvas hạ một nấc (2,5x → 2x → 1,5x); nếu hạ mà không đỡ thì trả lại độ nét cũ và thôi không thử nữa.
- **Xem số liệu:** bật "Hiện FPS" trong Cài đặt để thấy `fps / Hz trình duyệt cấp / độ phân giải canvas`.
- **Dark mode của điện thoại:** game chỉ có một bảng màu sáng. `index.html` và `css/style.css` khai báo `color-scheme` để Chrome, Samsung Internet và WebView trong app không tự đổi màu trang.

## Bảng cheat (để test)

Chạm **5 lần liên tiếp** (mỗi lần cách nhau dưới 0,6 giây) vào chữ "Màn N": ở thanh trên cùng khi đang chơi, hoặc ở ruy-băng của thẻ màn ngoài trang chủ. Bảng mở ra như một popup của game và game tạm dừng trong lúc mở.

- **Màn chơi:** thông tin màn đang chọn (tranh, hộp, số ô khay, số sâu, số màu, độ khó, tỉ lệ thua của bot, màn thiết kế hay sinh tự động, cơ chế có trong màn) và **lời giải** theo số thứ tự sâu. Chọn màn bất kỳ (±1, ±10) rồi chơi (đi tới màn sau mức đang mở thì mở khoá luôn tới đó). Trong màn: thắng ngay với 3/2/1 sao, thua ngay (kẹt khay / hết nước), chơi lại, Gợi ý / Kẹp gắp / +1 ô khay miễn phí. **Tự chơi** theo bộ Gợi ý: chỉ màn này, hoặc liên tục từ màn này sang màn khác (tự bấm qua các popup). Công tắc: chạm nhầm không mất sao, hiện số trên sâu (số dùng trong lời giải và trong file màn).
- **Kho đồ:** cộng / đặt lại xu, thêm bớt từng trợ giúp, mở khoá mọi trợ giúp, trợ giúp vô hạn.
- **Hệ thống:** tốc độ game (¼× đến 4×), hiện FPS, mở khoá mọi màn, hoàn thành bộ sưu tập, xem lại hướng dẫn (hướng dẫn màn 1, mẹo, giới thiệu cơ chế hiện lại), xoá tiến trình (chạm 2 lần), thông tin thiết bị (web hay APK, kích thước, DPR, Hz).

Các công tắc làm thay đổi cách chơi (tốc độ, không mất sao, trợ giúp vô hạn, số trên sâu) được lưu lại qua các lần mở game, và khi còn bật thì có nhãn tím **CHEAT · …** ở góc phải trên, để không ai nhầm một lượt test với lượt chơi thật.

## Kiểm thử tự động

Trong console của trang game:

```js
JT.Debug.advance(2000)        // chạy vòng lặp 2 giây không cần requestAnimationFrame, trả về trạng thái
JT.Debug.play(20, 1500)       // đi 20 nước theo solver, mỗi nước cách 1,5 giây
JT.Debug.tick(t)              // chạy đúng một vòng lặp tại mốc thời gian t (ms): giả lập nhịp khung hình bất kỳ
JT.Game.debug.state()         // trạng thái màn hiện tại
JT.App.startLevel(8)          // nhảy tới màn 9 (chỉ số tính từ 0)
JT.Save.reset()               // xoá tiến trình
JT.Cheat.open()               // mở bảng cheat
JT.Game.cheat.auto = 2        // tự chơi liên tục (như nút "Liên tục" trong bảng cheat)
```

## Trạng thái

Đã có: 60 màn (10 màn đầu thiết kế tay), 30 tranh trong 5 trang bộ sưu tập, 4 cơ chế nâng cao, 3 trợ giúp, sao, xu, hướng dẫn màn đầu, hai ngôn ngữ, lưu tiến trình, bảng cheat để test.

Chưa có: quảng cáo và mua trong ứng dụng (giá xu hiện chỉ để minh hoạ), service worker cho chơi offline, tệp font đóng gói sẵn (đang tải Baloo 2 và Nunito từ Google Fonts).
