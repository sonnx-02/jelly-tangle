# Jelly Tangle

Puzzle game cho mobile web (GameJam 2026). Gỡ những bé sâu kẹo dẻo ra khỏi hộp sô-cô-la, cho chúng nhảy lên khay và phun màu lấp đầy bức tranh jelly.

**Chơi ngay:** https://sonnx-02.github.io/jelly-tangle/ (bản dev có bảng cheat: https://sonnx-02.github.io/jelly-tangle/dev/)

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

### Hai bản: product và dev

Game có hai bản, dùng chung toàn bộ file:

| | Product (cho người chơi, BTC) | Dev (để test) |
|---|---|---|
| Web | `index.html`: https://sonnx-02.github.io/jelly-tangle/ | `dev/index.html`: https://sonnx-02.github.io/jelly-tangle/dev/ |
| APK | `JellyTangle-<bản>.apk`, app "Jelly Tangle" | `JellyTangle-<bản>-dev.apk`, app "Jelly Tangle Dev" |
| Bảng cheat | không có: `js/cheat.js` không được nạp (APK product không chứa file này), công tắc cheat còn sót trong bản lưu cũ cũng không có tác dụng | có (chạm 5 lần vào "Level N") |
| Tiến trình | bản lưu thật | bản lưu riêng: trên web lưu ở khoá khác (`jellytangle.dev.v1`), APK dev là một app khác, nên test không đụng đến bản lưu thật |

`dev/index.html` được sinh ra từ `index.html` (thêm `<base href="../">`, cờ `window.JT_DEV` và `js/cheat.js`), đừng sửa tay. Sửa `index.html` xong thì chạy lại:

```bash
python tools/make_dev.py
```

`python tools/make_dev.py --check` báo lỗi nếu `dev/index.html` chưa khớp `index.html`. Chạy server dev ở trên thì bản dev nằm ở http://localhost:5180/dev/.

### Đưa lên web

Bản đang chạy nằm trên GitHub Pages của repo này (Settings → Pages → Deploy from a branch → `main` / root). Mỗi lần đẩy lên `main`, GitHub tự build lại sau khoảng một phút:

```bash
git push
```

Repo là một trang tĩnh nên cũng đẩy nguyên thư mục lên được Netlify, Cloudflare Pages hay itch.io (HTML5).

### Bản Android (APK)

```bash
python tools/android/build_apk.py
```

```bash
python tools/android/build_apk.py --dev
```

Lệnh đầu ra bản product `dist/JellyTangle-1.1.9.apk` (khoảng 300 KB, phần lớn là font và ảnh bàn tay), lệnh sau ra bản dev `dist/JellyTangle-1.1.9-dev.apk`. Bản dev là một app khác (`vn.sonat.jellytangle.dev`, tên "Jelly Tangle Dev", phiên bản "1.1.9-dev") nên cài song song với bản product trên cùng một máy, mỗi bản giữ tiến trình riêng. Script dùng thẳng công cụ của Android SDK (aapt2, javac, d8, zipalign, apksigner), không qua Gradle nên không tải thêm gì. SDK và JDK 17 lấy từ `ANDROID_HOME` / `JAVA_HOME`; nếu không đặt, script tự tìm trong bản Unity có cài Android Build Support (`C:\Program Files\Unity\Hub\Editor\<bản>\...\AndroidPlayer`).

Cài lên máy: cắm điện thoại rồi chạy `adb install -r dist/JellyTangle-1.1.9.apk`, hoặc chép file APK sang máy và mở (cho phép "cài ứng dụng không rõ nguồn gốc"). Cả hai bản ký bằng khoá debug nằm ở `tools/android/keys/` (không đưa lên git) và được dùng lại, nên bản build sau cài đè lên bản trước được (các bản cũ tên `...-debug.apk` cũng là bản product, cài đè được).

Bản phát hành ký bằng khoá riêng của bạn (mật khẩu truyền qua biến môi trường, không ghi ra dòng lệnh):

```bash
JT_KEYSTORE=path/to/release.jks JT_KEY_ALIAS=jellytangle JT_STORE_PASS=... JT_KEY_PASS=... python tools/android/build_apk.py --release
```

File ký bằng khoá riêng có thêm đuôi `-release` (`dist/JellyTangle-1.1.9-release.apk`).

Đổi phiên bản ở `VERSION_CODE` / `VERSION_NAME` đầu `tools/android/build_apk.py` (mỗi bản đưa lên cửa hàng cần `VERSION_CODE` tăng lên).

Thiết kế bản Android (`android/`):

- **Một WebView toàn màn hình** chạy đúng các file của bản web, phục vụ từ trong APK qua địa chỉ `https://appassets.androidplatform.net/www/` (địa chỉ dành riêng cho việc này, không đi ra mạng). Nhờ có origin https cố định, tiến trình lưu trong localStorage giữ nguyên qua các lần cập nhật app.
- **Icon thích ứng** (adaptive icon) vẽ bằng vector từ `assets/icon.svg`, nằm gọn trong vùng an toàn để mặt nạ tròn, squircle hay vuông bo góc đều không cắt góc; có bản đơn sắc cho themed icon của Android 13.
- **Màn chờ** cùng màu kem với màn khởi động của game (Android 12+ dùng splash hệ thống), nên không có chớp trắng khi mở app.
- **Toàn màn hình, khoá dọc**, vẽ tràn cả vùng tai thỏ; app báo độ cao tai thỏ cho trang qua `--st` / `--sb` để HUD tránh ra.
- **Nút Back**: đóng popup đang mở; đang chơi thì mở menu tạm dừng; ở trang chủ thì đưa app xuống nền (`JT.App.back()` trong `js/main.js`). Rời app giữa màn thì khi quay lại gặp menu tạm dừng.
- **Chơi offline hoàn toàn**: font Baloo 2 và Nunito nằm sẵn trong game (`assets/fonts/`, xem mục Font bên dưới), app không gửi request nào ra mạng.
- **Hơn bản web ở ba chỗ**: chọn tần số quét cao nhất của màn hình (90/120 Hz nếu máy có; trang web không tự chọn được); rung bằng bộ rung của máy (`window.JTNative.vibrate`, chạm ngắn dùng hiệu ứng tick/click có sẵn của Android, rung dài mạnh hơn rung ngắn); nếu Android tắt tiến trình WebView để lấy bộ nhớ, app dựng lại màn hình thay vì văng, tiến trình chơi vẫn còn.
- Android 8.0 (API 26) trở lên, target Android 15 (API 35). Quyền: rung, và Internet. Game không dùng mạng; quyền Internet được giữ vì thiếu nó WebView chuyển sang chặn mạng (`blockNetworkLoads`), và không phải phiên bản WebView nào cũng còn nạp trang https nội bộ trong trạng thái đó.

### Font

Baloo 2 (700, 800) và Nunito (700, 800, 900) nằm trong `assets/fonts/` dưới dạng woff2, giấy phép SIL Open Font License (`assets/fonts/OFL-*.txt`). `css/fonts.css` khai báo chúng; mỗi phần (Latin, tiếng Việt, Latin mở rộng) chỉ được tải khi chữ trên màn hình cần đến. Muốn đổi độ đậm hay cập nhật font thì chạy lại `python tools/fetch_fonts.py`.

## Luật chơi

1. Chạm một bé sâu có **lối ra trống** phía trước mặt. Chạm nhầm bé bị chặn không làm thua, chỉ bớt sao: không chạm nhầm lần nào được 3 sao, 1–2 lần được 2 sao, từ 3 lần được 1 sao.
2. Sâu cuộn thành viên jelly, nhảy vào **ô trống đầu tiên** trên khay (ô có mũi tên) rồi tự phun màu lên tranh.
3. Tranh nhận màu theo **từng vòng từ ngoài vào**. Dải màu ngay dưới tranh cho biết vòng đang mở còn cần bao nhiêu ô mỗi màu; các vòng bên trong để trống cho tới khi mở. Viên jelly chưa tới lượt sẽ ngủ gật trên khay.
4. Số trên sâu là lượng màu. Hết màu thì viên jelly nổ và trả lại ô khay.
5. Hai viên **cùng màu đứng cạnh nhau** gộp làm một. Màu đã đủ thì được đổi thành xu.
6. Khay đầy mà không viên nào phun được là thua.

Hộp sâu nằm ngang: 8×6 ô (một số màn 7×6, màn 2 là 7×5, màn 1 là 6×5).

Màn 1–11 là màn thiết kế tay: màn 2 (Cầu vồng) được thiết kế riêng, các màn còn lại lấy từ bộ màn của nhóm (xem "Nướng màn chơi"). Màn 23 cũng làm tay: chính màn 16 nhưng không pha màu. Các màn khác từ màn 12 trở đi là màn sinh tự động.
Cơ chế mở dần: sâu nằm đè (màn 4), kẹo bọc giấy (màn 7), sâu chóng mặt (màn 10), pha màu (màn 16).
Trợ giúp mở dần: Gợi ý (màn 4), Kẹp gắp (màn 6), Thêm ô (màn 8).
Màn khó có nhãn đỏ "KHÓ"; màn 11 là màn "SIÊU KHÓ" (bot chơi ngẫu nhiên thua khoảng 88%).

### Màn 2: Cầu vồng

Tranh là một hình vuông cầu vồng, mỗi vòng một màu: đỏ ngoài cùng, rồi cam, vàng, xanh lá, lam, tím ở tâm. Nhờ vậy luật tô từng vòng từ ngoài vào hiện ra rõ ràng ngay sau màn hướng dẫn. Hộp sâu cũng xếp thành cầu vồng (hộp 7×5, khay 6 ô, 11 sâu) và được bóc dần từ trên xuống:

```
R< R  R  R^ R  R  R>     ba sâu đỏ ra được ngay, gộp làm một trên khay và tô kín vòng ngoài
O< O  O  R  O  O  O>     hai sâu cam ra được ngay từ đầu nhưng phải chờ tới vòng của mình
G^ Y< Y  Y  Y  Y  G^     lối ra của sâu vàng bị sâu xanh lá chặn: cất sâu xanh lá lên khay trước, nó sẽ tự phun khi tới vòng xanh
G  .  B^ P  B^ .  G      một sâu lam là đủ cho vòng lam, sâu lam còn lại được đổi thành xu
.  .  B  Pv B  .  .      sâu tím ra được ngay từ đầu nhưng cần sau cùng: kéo sớm thì nó chiếm một ô khay tới cuối màn
```

(`< > ^ v`: đầu sâu và hướng nó đi ra.) Bot chơi ngẫu nhiên thua 5%, khó hơn màn 1 (0%) và dễ hơn màn Mèo cam ngay sau (20%). Lần thua nào cũng rơi vào vòng ngoài cùng, khi khay đã đầy những màu chưa tới lượt, đúng bài học của màn. Lần đầu vào màn có một lời nhắc: dải màu dưới tranh cho biết vòng đang sáng còn cần màu nào.

Cầu vồng nằm ở trang Ngày nắng của bộ sưu tập (trang này có 7 tranh, các trang khác 6).

### Màn 23: Kẹo sọc, không pha màu

Bản sao của màn 16 (màn đầu tiên có pha màu): cùng hộp 7×6, khay 5 ô, 12 sâu ở đúng chỗ cũ, cùng hướng đầu và cùng lượng màu. Chỉ khác là sâu mang sẵn màu của tranh (cam, xanh lá, tím) nên không có gì phải pha. Mỗi sâu lấy màu kế tiếp trên vòng màu: sâu đỏ thành cam, sâu vàng thành xanh lá, sâu lam thành tím. Trong sáu cách đổi màu, cách này chơi khó nhất. Bỏ pha màu thì màn nhẹ đi hẳn: bot chơi ngẫu nhiên thua 13% (màn 16 thua 83%), nên màn này là một màn nghỉ giữa màn 22 (33%) và màn 24 (57%).

Tranh vẫn là Kẹo sọc của màn 16, nên màn 23 không có thẻ riêng trong bộ sưu tập: thẻ Kẹo sọc vẫn mở màn 16, và màn 23 mang phông của trang Tiệm bánh.

### Các màn chen vào sau

Cầu vồng và màn 23 chỉ chơi ở vòng đầu. Từ vòng thứ hai (màn 33 trở đi), các màn đi lại 30 tranh kia y như trước. Mọi màn khác vẫn y nguyên, chỉ lùi một số (màn 3–22) hoặc hai số (từ màn 24); bộ sinh màn vẫn dùng số cũ làm seed, nên nướng lại vẫn ra đúng các màn đó. Tiến trình lưu từ trước được dời theo khi mở game: sao, kỷ lục và màn kế tiếp đi theo đúng màn cũ. Ai vừa qua màn ngay trước một màn mới (màn 1 hoặc màn 22) sẽ gặp màn mới đó tiếp theo. Ai đã đi xa hơn thì thấy Cầu vồng mở sẵn trong bộ sưu tập; màn 23 không có thẻ riêng nên người đó đi tiếp mà không gặp nó (vẫn chơi được qua bảng cheat).

## Cấu trúc

```
index.html              trang game, bản product (không có bảng cheat)
dev/index.html          trang bản dev, sinh từ index.html bằng tools/make_dev.py (không sửa tay)
css/style.css           giao diện "tiệm bánh": token màu, HUD, trang chủ, popup (mọi kích thước theo --u = 1% bề ngang cột game)
js/core.js              luật chơi, bộ sinh màn, solver, bot đo độ khó; không đụng DOM
js/level-data.js        62 màn có sẵn: 12 màn thiết kế + 50 màn nướng (file sinh ra, không sửa tay)
js/levels.js            nạp màn: lấy từ dữ liệu nướng, ngoài bảng thì sinh lúc chạy
js/game.js              màn chơi: hoạt ảnh, nhập liệu, hướng dẫn, trình tự thắng thua
js/render.js            nét vẽ Canvas 2D: nền giấy, thẻ sứ, hộp sô-cô-la, sâu kẹo dẻo, viên jelly, ô tranh
js/fx.js                hạt, chữ bay, xu bay
js/audio.js             âm thanh ASMR và nhạc nền, dựng từng mẫu bằng JavaScript (không có file âm thanh), rung
js/ui.js                trang chủ, HUD, toàn bộ popup
js/cheat.js             bảng cheat để test, chỉ bản dev nạp (chạm 5 lần vào chữ "Level N" / "Màn N")
js/cursor.js            bàn tay hướng dẫn làm con trỏ chuột khi chơi
js/main.js              khởi động, vòng lặp, luồng màn hình, kinh tế trong game
js/i18n.js              chuỗi English (mặc định) và Tiếng Việt
js/util.js              toán, easing, màu, lưu tiến trình (localStorage)
tools/levels.html       công cụ nướng màn
tools/import_levels.py  nhập bộ màn thiết kế (file JSON) vào js/level-data.js
tools/dev_server.py     server dev
tools/make_dev.py       sinh dev/index.html (bản dev) từ index.html
tools/fetch_fonts.py    tải font về assets/fonts và viết css/fonts.css
tools/android/          build_apk.py: dựng file APK (bản product, hoặc --dev cho bản dev)
android/                bản Android: AndroidManifest, MainActivity (WebView), icon, màn chờ
```

Chỉ có một file ảnh: bàn tay chỉ hướng dẫn (`assets/hand.png`, 115×145). Còn lại toàn bộ hình là vẽ thủ tục trên Canvas, âm thanh là tổng hợp, không có file âm thanh nào.

## Nướng màn chơi

Mỗi màn được sinh ngẫu nhiên theo cấu hình trong `LEVELS` (`js/core.js`), rồi phải qua hai bài kiểm tra: solver tìm được lời giải, và tỉ lệ thua của bot chơi ngẫu nhiên nằm trong dải độ khó của màn (dễ 0–25%, thường 25–55%, khó 55–85%, siêu khó 85–95%, hoặc dải `target` riêng của màn). Màn đạt yêu cầu được **lưu nguyên dạng dữ liệu**, nạp lại và giải lại lần nữa để chắc chắn bản lưu đúng là bản đã kiểm tra.

Sau khi sửa `LEVELS`, `PICS` hay luật trong `core.js`:

1. Chạy `python tools/dev_server.py`.
2. Mở http://localhost:5180/tools/levels.html và bấm **Bake**.
3. Công cụ ghi lại `js/level-data.js`. Nếu có màn không đạt thì không ghi gì cả.

### Màn thiết kế tay (màn 1–11 và 23)

Màn 1 và 3–11 lấy từ bộ màn của nhóm (file JSON: mỗi màn có mô tả dễ đọc và bản `baked` đúng định dạng `JT.LEVEL_DATA`). Cầu vồng chen vào làm màn 2, nên từ màn 2 của bộ màn trở đi, màn n của bộ màn là màn n + 1 trong game (từ màn 22 của bộ màn là n + 2, vì có thêm màn 23); công cụ nhập tự dời số. Cầu vồng và màn 23 không có trong bộ màn: dữ liệu của chúng chỉ nằm trong `js/level-data.js`, ý đồ thiết kế ghi ở chú thích `LEVELS` trong `js/core.js`. Nhập bộ màn hay **Bake** đều giữ nguyên chúng. Nhập bằng:

```
python tools/import_levels.py duong/dan/jelly_tangle_levels_1-10.json
```

- Công cụ kiểm tra bản `baked` khớp với phần mô tả (kích thước hộp, số ô khay, tranh, từng con sâu: màu, lượng màu, ô, hướng đầu, ai đè ai), rồi thay đúng các màn có trong file; các màn khác giữ nguyên.
- Bộ màn vẽ hộp dọc (5×6, 6×7, 6×8) theo bố cục cũ, nên mỗi màn được **xoay một góc vuông** sang hộp ngang (6×5, 7×6, 8×6), hướng đầu sâu và hướng quay của sâu chóng mặt xoay theo. Câu đố không đổi: solver ra đúng lời giải ghi trong file, tỉ lệ thua của bot trùng khớp tuyệt đối với hộp gốc (cùng seed, 3000 lượt). Muốn giữ hộp dọc thì thêm `--keep-orientation`.
- `LEVELS[0..10]` và `LEVELS[22]` trong `js/core.js` mang `designed: true` và `target` (dải tỉ lệ thua trong file). Kích thước hộp, số ô khay và tranh ở đó phải khớp dữ liệu, nếu không game sẽ bỏ dữ liệu và tự sinh màn khác. Khi **Bake**, `tools/levels.html` giữ nguyên các màn `designed` (sau khi giải lại để chắc chúng vẫn qua được) và chỉ sinh lại các màn còn lại.

Lưu ý: bộ sinh màn từng dùng phép sắp xếp với bộ so sánh ngẫu nhiên, khiến cùng một seed có thể ra màn khác nhau tuỳ thời điểm chạy. Bộ so sánh đã được sửa cho nhất quán, và game không còn dựng màn từ seed nữa mà đọc thẳng dữ liệu đã nướng.

## Hiệu năng và hiển thị

- **Tần số quét:** vòng lặp chạy bằng `requestAnimationFrame` và mọi chuyển động tính theo thời gian thực, nên trình duyệt cấp 60, 90 hay 120 Hz thì game vẽ đúng chừng đó. Trang web không tự chọn được tần số quét; phần game lo là giữ cho mỗi khung hình đủ nhẹ.
- **Sâu đứng yên được dựng sẵn thành ảnh** (`wormSprite` trong `js/game.js`), chỉ con đang uốn, nháy hay phát sáng mới vẽ lại từng nét.
- **Tự hạ độ phân giải:** bộ đo trong `js/main.js` theo dõi khoảng cách giữa các khung. Khi hơn 30% khung đến trễ, canvas hạ một nấc (2,5x → 2x → 1,5x); nếu hạ mà không đỡ thì trả lại độ nét cũ và thôi không thử nữa.
- **Xem số liệu:** mở game với `?dev` trên địa chỉ (ví dụ `http://localhost:5180/?dev`) để hiện công tắc "Hiện FPS" trong Cài đặt, rồi bật nó để thấy `fps / Hz trình duyệt cấp / độ phân giải canvas`. Người chơi thường không thấy công tắc này.

## Giao diện

Giao diện được thiết kế cho nhóm người chơi chính của dòng puzzle này: 25–55 tuổi, nòng cốt là nữ 30–45 (75% nữ, thích hợp tác và cái đẹp; 22% nam, thích thi đua và tốc độ). Từ đó ra các nguyên tắc:

- **Dịu và sang thay vì sặc sỡ:** phong cách "tiệm bánh" (pâtisserie): thẻ trắng sứ trên nền giấy pastel có vân nhẹ, chữ nâu espresso, điểm nhấn hồng đất (nút chính), xanh xô thơm (tiến độ, công tắc bật), vàng mật ong (xu, sao). Độ sâu bằng bóng mềm, không dùng gờ nổi kiểu hoạt hình. Hộp sâu là hộp sô-cô-la khuôn, có viền vàng mảnh.
- **Đọc thoải mái ở khoảng cách tay cầm:** chữ thân không nhỏ hơn 4 đơn vị (khoảng 15 px trên máy 390 px), chữ trắng trên nút hồng đạt tương phản 3:1 trở lên (mức AA cho chữ lớn), nút chạm từ 12 đơn vị (khoảng 47 px) trở lên.
- **Một hệ chữ và một bộ icon:** Nunito cho mọi chữ giao diện, Baloo 2 chỉ còn cho logo và số trên sâu. Icon nét tròn cùng một kiểu, vẽ tay bằng SVG trong `js/ui.js`.
- **Mục tiêu nhìn thấy được:** thẻ màn ở trang chủ cho biết tranh sắp làm thuộc trang nào của bộ sưu tập và trang đó đã xong mấy tranh. Bảng thắng đóng khung bức tranh như một bản in.
- **Lớp thi đua nhẹ cho người chơi nhanh:** bảng thắng hiện thời gian chơi màn đó (không tính lúc tạm dừng) và kỷ lục của chính người chơi. "Kỷ lục mới!" chỉ hiện khi phá kỷ lục cũ, không hiện ở lần thắng đầu. Trong lúc chơi không có đồng hồ, để không tạo áp lực.
- **Chuyển động chậm và mềm:** nút chính "thở" nhẹ thay vì nảy, logo trôi nhẹ, các bé sâu ở trang chủ ít và chậm hơn, màu nhạt hơn một chút để lùi về làm nền.
- **Tiếng Anh là ngôn ngữ mặc định**, đổi sang tiếng Việt ở Settings → Language. Game chỉ giữ ngôn ngữ người chơi tự chọn (`settings.langPicked` trong `js/util.js`). Save cũ chưa từng chọn sẽ chuyển sang tiếng Anh, vì trước đây save nào cũng ghi sẵn `lang: 'vi'`, dù người chơi có chọn hay không.
- **Con trỏ bàn tay khi chơi bằng chuột:** trong màn chơi (cả popup trong màn), con trỏ là bàn tay đeo găng của phần hướng dẫn màn 1. Đầu ngón tay nằm đúng chỗ chuột trỏ; khi bấm, ngón tay ấn xuống như cú chạm trong hướng dẫn và để lại một vòng trắng. Chạm bằng tay hay bút thì bàn tay ẩn đi; ở trang chủ con trỏ thường quay lại.

Các token màu, bóng và cỡ chữ nằm ở đầu `css/style.css`. Canvas dùng cùng bảng màu (`R.TRAY`, `R.PICBG`, `R.panel` trong `js/render.js`).

## Màu sắc

- **Bảng màu kẹo** (`PALETTE` trong `js/core.js`) được chỉnh bằng số liệu: với mọi cặp màu cùng xuất hiện trong một bức tranh, tính khoảng cách CIEDE2000 ở mắt thường và ở ba dạng mù màu mô phỏng (Machado 2009). Mỗi màu chỉ dịch tối đa khoảng ΔE 9, chủ yếu về độ sáng, nên vẫn giữ đúng sắc kẹo. Cặp gần nhau nhất ở mắt thường từ ΔE 14 lên 17.
- **Viền sáng cho kẹo tối:** sâu nào có độ tương phản WCAG dưới 4:1 với nền sô-cô-la thì có thêm viền sáng (`haloOf` trong `js/render.js`).
- **Ký hiệu màu** (Cài đặt → Ký hiệu màu, mặc định tắt): mỗi màu có một hình riêng (tim, tam giác, sao, …), hiện trên thân sâu, trên viên jelly, trên dải màu và ở ô tranh của vòng đang mở. Dành cho người mù màu; vài cặp như Lam/Tím gần như trùng nhau với người mù màu đỏ-lục, chỉnh màu không tách hẳn được.
- **Mỗi trang bộ sưu tập có phông nền riêng** (`ALBUM[].bg` trong `js/core.js`), đều là màu giấy nhạt để thẻ sứ và màu kẹo luôn nổi lên: Ngày nắng hồng đào, Phiêu lưu xanh trời, Tiệm bánh hồng kem, Đại dương xanh ngọc, Rừng xanh xanh lá. Trang chủ dùng phông của màn kế tiếp.
- **Dark mode của điện thoại:** game chỉ có một bảng màu sáng. `index.html` và `css/style.css` khai báo `color-scheme` để Chrome, Samsung Internet và WebView trong app không tự đổi màu trang.

## Âm thanh

Toàn bộ là tổng hợp, không có file âm thanh (`js/audio.js`). Hướng âm thanh là ASMR: tiếng động gần, có chất liệu và có sức nặng, thay vì tiếng bíp.

- **Dựng sẵn từng mẫu âm:** khi âm thanh bắt đầu (lần chạm đầu tiên), game tính từng mẫu một bằng JavaScript (nhiễu lọc, vật rung tắt dần, sóng sin trượt cao độ, bão hoà mềm) thành vài biến thể cho mỗi âm. Lúc phát, game chọn ngẫu nhiên một biến thể rồi xê dịch cao độ và độ to một chút, nên không có hai lần nghe giống hệt nhau. Phần dựng sẵn chạy rải rác từng âm một, không làm khựng game.
- **Có sức nặng:** tiếng bé jelly rơi vào khay có một tiếng "bịch" trầm. Tiếng trầm này được bão hoà để sinh hoà âm, nhờ đó loa điện thoại, vốn không phát được tần số gốc, vẫn truyền được cảm giác nặng. Bên trên là tiếng nhầy, tiếng chạm ướt, và một chút rung sau đó.
- **Từng âm:**
  - sâu bị kéo ra: tiếng trượt nhầy và dính, có những tiếng tách nhỏ, rồi "póc" khi ra khỏi hộp;
  - sâu va vào sâu khác: tiếng cao su đục;
  - hai jelly gộp lại: hai tiếng "ọc" rồi lắng xuống;
  - pha màu: tiếng nước xoáy;
  - giọt màu chạm tranh: một tiếng "pop" nhỏ, ấm, trong và êm. Cao độ nảy nhẹ lên đúng một nốt ngũ cung trong khoảng Mi4–Mi5 (cùng giọng với nhạc nền, các nốt cao dần khi vòng tô sắp đầy), tiếng vào mềm (3 ms). Thân tiếng là tiếng nhiễu ngân rỗng ở đúng nốt đó, có chút trọng lượng bên dưới, và một tiếng nảy giòn nhưng nhỏ (1,1–1,35 kHz) giữ cho tiếng pop rõ ràng. Mỗi tiếng tắt sau khoảng 65 ms nên một tràng pop không bị nhoè vào nhau. Qua loa điện thoại, một tràng tô màu nhỏ hơn tiếng cũ khoảng 3 dB và gần như không còn năng lượng ở dải 1,5–5 kHz, dải tai nhạy nhất (4% so với 15%), không có tiếng tách;
  - jelly hết màu: tiếng bong bóng vỡ;
  - bóc giấy bạc: tiếng sột soạt;
  - xu: tiếng leng keng kim loại;
  - nút bấm: tiếng gõ gỗ;
  - phần thưởng: đàn kalimba trong một căn phòng ấm.
- **Âm thanh có vị trí:** sâu ở bên trái hộp thì nghe lệch bên trái (lệch tối đa 55%).
- **Mức to được đặt sẵn từ lúc dựng:** mỗi biến thể được đo đoạn 50 ms to nhất rồi chỉnh về đúng mức của âm đó (`TARGET` trong `js/audio.js`). Kiểm tra bằng `JT.Audio.levels()` trong console.

| Nhóm | Âm | Mức to nhất (50 ms) |
|---|---|---|
| Hành động nặng | jelly rơi, sâu va, gộp, trống "Màn khó" | −14 đến −15 dB |
| Phần thưởng | nốt kalimba (sao, xong vòng, thắng), tiếng gỗ báo khay đầy | −17 đến −18 dB, thắng và xong vòng là vài nốt chồng lên |
| Hành động thường | kéo sâu, bong bóng, nước xoáy, giấy bạc | −17 đến −19 dB |
| Âm nhỏ, lặp nhiều | xu, gõ gỗ, nút bấm, giọt màu | −20 đến −22,5 dB |
| Không khí | tiếng thở dài khi thua, tiếng lấp lánh | −24 đến −27 dB |

Nhạc nền là đàn kalimba chậm (84 bpm) trên nền bass sin mềm, đi qua bộ lọc và tiếng vọng, tự hạ xuống khi ăn mừng. Mọi âm có cao độ đều nằm trong thang ngũ cung Đô trưởng, cùng giọng với nhạc nền. Khi quá nhiều âm dồn cùng lúc (mưa xu cuối màn), các âm ít quan trọng tự bị bỏ bớt.

## Bảng cheat (để test)

Chỉ **bản dev** có bảng này: web ở https://sonnx-02.github.io/jelly-tangle/dev/ và APK `JellyTangle-<bản>-dev.apk` (xem "Hai bản: product và dev"). Bản product cho người chơi và BTC không có cheat.

Chạm **5 lần liên tiếp** (mỗi lần cách nhau dưới 0,6 giây) vào chữ "Level N" ("Màn N" khi chơi tiếng Việt): ở thanh trên cùng khi đang chơi, hoặc ở ruy-băng của thẻ màn ngoài trang chủ. Bảng mở ra như một popup của game và game tạm dừng trong lúc mở.

- **Màn chơi:** thông tin màn đang chọn (tranh, hộp, số ô khay, số sâu, số màu, độ khó, tỉ lệ thua của bot, màn thiết kế hay sinh tự động, cơ chế có trong màn) và **lời giải** theo số thứ tự sâu. Chọn màn bất kỳ (±1, ±10) rồi chơi (đi tới màn sau mức đang mở thì mở khoá luôn tới đó), hoặc **mở khoá mọi màn** một lần, để bộ sưu tập mở hết các thẻ (nút này có cả ở tab Hệ thống). Trong màn: thắng ngay với 3/2/1 sao, thua ngay (kẹt khay / hết nước), chơi lại, Gợi ý / Kẹp gắp / +1 ô khay miễn phí. **Tự chơi** theo bộ Gợi ý: chỉ màn này, hoặc liên tục từ màn này sang màn khác (tự bấm qua các popup). Công tắc: chạm nhầm không mất sao, hiện số trên sâu (số dùng trong lời giải và trong file màn).
- **Kho đồ:** cộng / đặt lại xu, thêm bớt từng trợ giúp, mở khoá mọi trợ giúp, trợ giúp vô hạn.
- **Giao diện:** ô checkbox để ẩn từng phần khỏi màn hình khi quay video: nút menu, tên màn, xu, thanh trợ giúp, lời nhắc và banner, bàn tay hướng dẫn, chữ bay và xu bay, nhãn cheat và FPS; ô "Ẩn tất cả" bật / tắt cả loạt. Các phần chỉ bị ẩn đi, vẫn giữ chỗ, nên bàn chơi không xê dịch. Tên màn đã ẩn vẫn nhận 5 lần chạm để mở lại bảng cheat.
- **Hệ thống:** tốc độ game (¼× đến 4×), hiện FPS, mở khoá mọi màn, hoàn thành bộ sưu tập, xem lại hướng dẫn (hướng dẫn màn 1, mẹo, giới thiệu cơ chế hiện lại), xoá tiến trình (chạm 2 lần), thông tin thiết bị (web hay APK, kích thước, DPR, Hz).

Các công tắc làm thay đổi cách chơi (tốc độ, không mất sao, trợ giúp vô hạn, số trên sâu) và các phần giao diện đã ẩn được lưu lại qua các lần mở game, và khi còn bật thì có nhãn tím **CHEAT · …** ở góc phải trên (nhãn "UI" khi có phần bị ẩn), để không ai nhầm một lượt test với lượt chơi thật.

## Kiểm thử tự động

Trong console của trang game:

```js
JT.Debug.advance(2000)        // chạy vòng lặp 2 giây không cần requestAnimationFrame, trả về trạng thái
JT.Debug.play(20, 1500)       // làm theo Gợi ý 20 bước, mỗi bước cách 1,5 giây (Gợi ý bảo chờ thì chờ)
JT.Debug.tick(t)              // chạy đúng một vòng lặp tại mốc thời gian t (ms): giả lập nhịp khung hình bất kỳ
JT.Game.debug.state()         // trạng thái màn hiện tại
JT.App.startLevel(8)          // nhảy tới màn 9 (chỉ số tính từ 0)
JT.Save.reset()               // xoá tiến trình
JT.Cheat.open()               // mở bảng cheat
JT.Game.cheat.auto = 2        // tự chơi liên tục (như nút "Liên tục" trong bảng cheat)
```

## Trạng thái

Đã có: 62 màn (12 màn thiết kế tay), 31 tranh trong 5 trang bộ sưu tập, 4 cơ chế nâng cao, 3 trợ giúp, sao, xu, thời gian và kỷ lục từng màn, hướng dẫn màn đầu, hai ngôn ngữ (mặc định tiếng Anh), lưu tiến trình, giao diện "tiệm bánh" cho người chơi 25–45 tuổi, âm thanh ASMR tổng hợp, con trỏ bàn tay khi chơi bằng chuột, bảng cheat để test, bản Android (APK).

Chưa có: quảng cáo và mua trong ứng dụng (giá xu hiện chỉ để minh hoạ), service worker để bản web chơi offline (bản Android đã chơi offline được).
