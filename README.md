# 📝 TÀI LIỆU — README 📝
# API FREE FIRE (LEGI STUDIO)

API này cung cấp **toàn bộ các endpoint** cho các dịch vụ giải đấu free fire (bảng xếp hạng, lineup, profile,...)

> **Thông tin API:** API có hai kiểu gọi dùng key.
> - `x-bot-key` (header) — dùng cho các API `/api-legi/*` và `/api-legi/lineup`.
> - `apikey` (query) — dùng cho các API `/api-legi/lineup/layouts`, `/api-legi/profile/layouts`, `/api-legi/tinhdiem`.

---

## 📌 Tổng quan endpoints

1. **/api-bot/team**
   - `POST /api-legi/team/add` — Thêm / cập nhật team 
   - `GET /api-legi/team/list` — Lấy danh sách team
   - `GET /api-legi/team/info` — Lấy info 1 team 
   - `DELETE|POST /api-legi/team/remove` — Xoá team.

2. **/api-bot/profile**
   - `GET /api-legi/profile/layouts` — Lấy danh sách profile layouts
   - `POST /api-legi/profile` — Render tạo ảnh profile

3. **/api/lineup**
   - `GET /api-legi/lineup/layouts` — Lấy danh sách lineup layouts
   - `POST /api-legi/lineup` — Render tạo ảnh lineup

4. **/api/tinhdiem**
   - `GET /api-legi/tinhdiem` — Tính điểm & render bảng điểm (trả base64 JSON hoặc stream PNG).

---

## 🔐 Authentication / Key

- **API Key**: API key được sử dụng khi gọi cùng các endpoint, bạn có thể liên hệ với tôi qua **Facebook** hoặc bất kỳ nên tảng cá nhân nào của tôi để có thể mua KEY

Nếu key **không hợp lệ**, server trả status 401/403

---

# 1) `/api-legi/team` — CHI TIẾT

### POST `/api-legi/team/add`
Thêm hoặc cập nhật team. Nếu team tồn tại -> merge IDs; nếu gửi file `image` (logo) sẽ cập nhật logo.

**Auth:** header `x-bot-key` (bắt buộc)  
**Method:** POST  
**Content-Type:** `multipart/form-data`

**Fields**
- `uid` (string) — sender UID (bắt buộc)
- `teamName` (string) — tên team (bắt buộc)
- `accountIDs` — có thể
  - Chuỗi mảng JSON: `["123","456"]`
  - cách nhau bằng dấu xuống dòng: `123\n456`
  - cách nhau bằng dấu phẩy: `123,456`
- `mode` (tùy chọn) — `original|removebg|border`

**Ví dụ curl**
```bash
curl -v -X POST "https://legistudio.site/api-legi/team/add" \
  -H "x-bot-key: API_KEY" \
  -F "uid=UID" \
  -F "teamName=TEAM_NAME" \
  -F 'accountIDs=["123456789012345","987654321098765"]' \
  -F "mode=removebg" \
  -F "image=@/path/to/logo.png"
```

**Ví dụ phản hồi (create)**
```json
{
  "success": true,
  "action": "create",
  "message": "✅ Tạo team thành công",
  "teamName": "TEAM_NAME",
  "addedIDs": ["#00000001"],
  "allIDs": ["#00000001"],
  "totalIDs": 1,
  "logo": "Có"
}
```

**Ví dụ phản hồi (update)**
```json
{
  "success": true,
  "action": "update",
  "message": "♻️ Cập nhật team thành công",
  "teamName": "TEAM_NAME",
  "addedIDs": ["#00000002"],
  "allIDs": ["#00000001","#00000002"],
  "totalIDs": 2,
  "logo": "Có"
}
```

**Lưu ý**
- Mỗi team tối đa **8 IDs**.
- Mỗi `sender_uid` tối đa **24 teams**.

---

### GET `/api-legi/team/list`
Lấy tất cả team của `uid`.

**Auth:** header `x-bot-key`  
**Query:** `?uid=UID`

**Curl**
```bash
curl -v "https://legistudio.site/api-legi/team/list?uid=UID" \
  -H "x-bot-key: API_KEY"
```

**Phản hồi**
```json
{
  "success": true,
  "data": [
    {
      "stt": 1,
      "teamName": "TEAM_NAME",
      "accountID": ["#00000001","#00000002"],
      "logo": "/uploads/bot/UID/1680000.png"
    }
  ]
}
```

---

### GET `/api-legi/team/info`
Lấy chi tiết 1 team.

**Auth:** header `x-bot-key`  
**Query:** `?uid=UID&teamName=TEAM_NAME`

**Curl**
```bash
curl -v "https://legistudio.site/api-legi/team/info?uid=UID&teamName=TEAM_NAME" \
  -H "x-bot-key: API_KEY"
```

**Phản hồi**
```json
{
  "success": true,
  "data": {
    "teamName": "TEAM_NAME",
    "accountID": ["#00000001","#00000002"],
    "logo": "/uploads/bot/UID/1680000.png"
  }
}
```

---

### DELETE / POST `/api-legi/team/remove`
Xoá team; hỗ trợ `DELETE` query hoặc `POST` body.

**Auth:** header `x-bot-key`

**DELETE (query)**
```bash
curl -v -X DELETE "https://legistudio.site/api-legi/team/remove?uid=UID&teamName=TEAM_NAME" \
  -H "x-bot-key: API_KEY"
```

**POST (json)**
```bash
curl -v -X POST "https://legistudio.site/api-bot/team/remove" \
  -H "x-bot-key: API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"uid":"UID","teamName":"TEAM_NAME"}'
```

**Phản hồi**
```json
{
  "success": true,
  "message": "🗑️ Đã xoá team TEAM_NAME"
}
```

---

# 2) `/api-legi/profile` — CHI TIẾT

### GET `/api-legi/profile/layouts`
Lấy danh sách layouts profile.  

**Curl**
```bash
curl -v "https://legistudio.site/api-legi/profile/layouts?apikey=API_KEY"
```

**Phản hồi**
```json
{
  "success": true,
  "layouts": [
    { "layout": "layout1", "tier": "default" },
    { "layout": "layout_vip", "tier": "vip" }
  ]
}
```

---

### POST `/api-legi/profile` — Render tạo ảnh profile
**Auth:** header `x-bot-key`
**Method:** POST `multipart/form-data`  
**Files:** `pngavatar` (nếu avatar=true), `pnglogoteam` (nếu logoteam=true)

**Bắt buộc fields**
- `layout` — layout id (folder name)
- `tengame`, `tenthat`, `ngaysinh`, `tengiai`, `tenteam`
- `vitri` — `t, s, b, sp, r, c`
- `sung1`, `sung2` — Nhập đúng tên súng trong game
- `nhanvat1`, `nhanvat2`, `nhanvat3`, `nhanvat4` — Nhập đúng tên nhân vật trong game
- `avatar` (`true`/`false`) — nếu `true` phải gửi `pngavatar` - file ảnh png
- `logoteam` (`true`/`false`) — nếu `true` phải gửi `pnglogoteam` - file ảnh png

**Ví dụ**
```bash
curl -v -X POST "https://legistudio.site/api-legi/profile" \
  -H "x-bot-key: API_KEY" \
  -F "layout=LAYOUT_ID" \
  -F "tengame=GIẢI" \
  -F "tenthat=TÊN" \
  -F "ngaysinh=2000-01-31" \
  -F "tengiai=GIẢI" \
  -F "tenteam=TEAM" \
  -F "vitri=t" \
  -F "sung1=CHIM GO KIEN" \
  -F "sung2=NO" \
  -F "nhanvat1=NV1"
  -F "nhanvat2=NV2"
  -F "nhanvat3=NV3" 
  -F "nhanvat4=NV4" \
  -F "avatar=true" 
  -F "logoteam=true" \
  -F "pngavatar=@/path/avatar.png" \
  -F "pnglogoteam=@/path/logo.png"
```

**Response JSON (base64)**
```json
{
  "success": true,
  "imageBase64": "data:image/png;base64,...."
}
```

**Stream image**
Nếu gửi `stream=true` (field), server trả `Content-Type: image/png` trực tiếp; lưu bằng `--output`:
```bash
curl -v -X POST "https://legistudio.site/api-legi/profile" \
  -H "x-bot-key: API_KEY" \
  -F "stream=true" \
  ...other fields... \
  --output profile.png
```

---

# 3) `/api-legi/lineup` — CHI TIẾT

### GET `/api-legi/lineup/layouts`
Lấy danh sách layouts lineup.  

**Curl**
```bash
curl -v "https://legistudio.site/api-legi/lineup/layouts?apikey=API_KEY"
```

**Phản hồi**
```json
{
  "success": true,
  "layouts": [
    { "layout": "layout_name", "nums": ["3","5","7"] }
  ]
}
```

---

### POST `/api-legi/lineup` — Render lineup (image)
**Auth:** header `x-bot-key` (bắt buộc)  
**Method:** POST `multipart/form-data`  
**Files:** `pnglogoteam`, `pngavatar{i}` (i = 1..num) etc.

**Bắt buộc fields**
- `layout` (string) — layout id (folder)
- `num` (int) — số thành viên (ví dụ 5)
- `team` (string) — tên team
- `tengiai` (string)
- `logoteam` (`true`/`false`)
- Cho mỗi player i=1..num:
  - `player{i}_name`
  - `player{i}_pos` (t/s/b/sp/r/c)
  - `avatar{i}` (`true`/`false`)
  - nếu `avatar{i}`=true thì `pngavatar{i}` (file) hoặc `pngavatar{i}="none"` để dùng avatar mặc định

**Ví dụ**
```bash
curl -v -X POST "https://legistudio.site/api-legi/lineup" \
  -H "x-bot-key: API_KEY" \
  -F "layout=layout_example" \
  -F "num=5" \
  -F "team=MY_TEAM" \
  -F "tengiai=GIẢI" \
  -F "logoteam=true" \
  -F "player1_name=PlayerOne" 
  -F "player1_pos=t" 
  -F "avatar1=true" 
  -F "pngavatar1=@/path/a1.png" \
  -F "player2_name=PlayerTwo" 
  -F "player2_pos=s" 
  -F "avatar2=false" \
  -F "player3_name=PlayerThree" 
  -F "player3_pos=b" 
  -F "avatar3=false" \
  -F "pnglogoteam=@team.png" \
  --output lineup.png
```

**Phản hồi**
- Thành công: trả `image/png` trực tiếp
- Lỗi: trả JSON `{ success:false, message: "..." }` kèm status code.

---

# 4) `/api-legi/tinhdiem` — CHI TIẾT

**Method:** GET  
**Auth:** `apikey` query (bắt buộc)

**Bắt buộc tham số**
- `id` — accountId (Garena)
- `batdau` — start time
- `ketthuc` — end time
- `bang` — layout id
- `ct` — custom name 
- `ct2` — custom name 
- `logo` — logo url 
- Option mở rộng:
  - `xoatran` — xóa trận (ví dụ `1,3`)
  - `cpr` — Chế độ CHAMPION RUSH (CPR)
  - `stream=true` — trả `image/png` trực tiếp
- Option Logo Tên Team:
  - `TeamName=true` & `LogoTeam=true` & `data=UID` sender UID

**Ví dụ trả base64 JSON**
```bash
curl -v "https://legistudio.site/api-legi/tinhdiem?apikey=API_KEY&id=ACCOUNT_ID&batdau=2025-01-01T00:00:00Z&ketthuc=2025-01-02T00:00:00Z&bang=layout1&ct=GIẢI&ct2=VÒNG&logo=https://example.com/logo.png"
```

**Example JSON**
```json
{
  "status": true,
  "sotran": 5,
  "cpr": {
    "enabled": true,
    "threshold": 41,
    "status": "found",
    "team": "TEAM CHAMPION"
  },
  "base": "data:image/png;base64,....."
}
```

**Stream (trả image/png trực tiếp)**
```bash
curl -G "https://legistudio.site/api-legi/tinhdiem" \
  --data-urlencode "apikey=API_KEY" \
  --data-urlencode "id=ACCOUNT_ID" \
  --data-urlencode "batdau=2025-01-01T00:00:00Z" \
  --data-urlencode "ketthuc=2025-01-01T23:59:59Z" \
  --data-urlencode "bang=layout1" \
  --data-urlencode "ct=GIẢI" \
  --data-urlencode "ct2=VÒNG" \
  --data-urlencode "logo=https://example.com/logo.png" \
  --data-urlencode "stream=true" \
  -o tinhdiem.png
```

**Header CPR khi stream**
- Nếu `stream=true` và `mode=cpr`, server có thể gửi header:
  - `X-CPR-Status: none|found`
  - `X-CPR-Team: URL-encoded team name` (nếu found)

**Lưu ý**
- Nếu `TeamName` + `LogoTeam` = `true`, bạn **phải** gửi `data=UID` để tìm team overrides (nếu không có data server trả lỗi).

---

## ✅ Các mẫu lỗi & mã trạng thái

Server trả JSON lỗi với `success: false` hoặc `{ status: false }` cho `/api-legi/tinhdiem`.

Ví dụ lỗi chung:
```json
{ "success": false, "message": "Thiếu tham số" }
```

Một số lỗi phổ biến:
- `401 / 403` — KEY không hợp lệ hoặc KEY bị tắt / hết lượt.
- `missing_*` — thiếu tham số bắt buộc (`missing_player_1`, `missing_layout`, ...).
- `layout_not_allowed` — key không có quyền dùng layout.
- `no_match` — không tìm thấy trận trong khoảng thời gian.
- `layout_not_found` — layout id không tồn tại.
- `500` — lỗi server.

---

## 📚 Examples nhanh — tập hợp

### 1. Tạo team
```bash
curl -X POST "https://legistudio.site/api-legi/team/add" \
  -H "x-bot-key: API_KEY" \
  -F "uid=UID123" \
  -F "teamName=ALPHA" \
  -F 'accountIDs=123456789012345,987654321098765' \
  -F "image=@./logo.png"
```

### 2. Lấy layout lineup
```bash
curl "https://legistudio.site/api-legi/lineup/layouts?apikey=API_KEY"
```

### 3. Render lineup (lưu file)
```bash
curl -X POST "https://legistudio.site/api-legi/lineup" \
  -H "x-bot-key: API_KEY" \
  -F "layout=layout_example" \
  -F "num=3" \
  -F "team=TEAM" \
  -F "tengiai=GIẢI" \
  -F "logoteam=true" \
  -F "player1_name=One" -F "player1_pos=t" -F "avatar1=true" -F "pngavatar1=@a1.png" \
  -F "player2_name=Two" -F "player2_pos=s" -F "avatar2=false" \
  -F "player3_name=Three" -F "player3_pos=b" -F "avatar3=false" \
  -F "pnglogoteam=@team.png" \
  --output lineup.png
```

### 4. Tinh diem (stream)
```bash
curl -G "https://legistudio.site/api-legi/tinhdiem" \
  --data-urlencode "apikey=API_KEY" \
  --data-urlencode "id=123456789012345" \
  --data-urlencode "batdau=2025-01-01T00:00:00Z" \
  --data-urlencode "ketthuc=2025-01-01T23:59:59Z" \
  --data-urlencode "bang=layout1" \
  --data-urlencode "ct=GIẢI" \
  --data-urlencode "ct2=VÒNG" \
  --data-urlencode "logo=https://example.com/logo.png" \
  --data-urlencode "stream=true" \
  -o tinhdiem.png
```

---

## ❗ Những điều cần biết (Important)

- Một số endpoint **trả ảnh trực tiếp** (`Content-Type: image/png`) — client cần lưu file bằng `--output` hoặc xử lý binary stream.
- Khi dùng `TeamName=true` + `LogoTeam=true` với `/api-legi/tinhdiem`, phải kèm `data=UID` để ánh xạ team override.
- Tên layout phân biệt **default / vip / dq**; quyền truy cập layout tuỳ key 

---
