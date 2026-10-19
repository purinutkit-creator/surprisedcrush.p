# 🎁 1st Gift : Happy Birthday

เว็บไซต์เซอร์ไพรส์วันเกิดสำหรับคนที่แอบชอบ — Full-Stack ใช้งานจริง (React + TypeScript + Tailwind + Framer Motion / Node.js + Express + PostgreSQL + WebSocket + rrweb)

| URL | หน้า |
| --- | --- |
| `/` | เส้นทางเปิดของขวัญ: วันเกิด → จดหมาย → เกมทาย → (แลกสิทธิ์) → ใช่เลยยย → เขียนข้อความ → แกลเลอรี |
| `/yourmybestcrushever` | หน้าบอกความรู้สึก (ล็อกที่ Server จนกว่าจะผ่านเงื่อนไข) |
| `/surprisedmycrush` | Admin Dashboard (รหัสผ่านเริ่มต้น `05/05/2011` — เปลี่ยนได้ในเมนู Security) |

## เริ่มใช้งานบนเครื่อง

```bash
# 1) PostgreSQL (หรือใช้ docker run -e POSTGRES_PASSWORD=gift -e POSTGRES_USER=gift -p 5432:5432 postgres:16)
cp .env.example .env            # แก้ DATABASE_URL ถ้าจำเป็น
npm install
npm run dev                     # Server :3000 + Vite :5173  → เปิด http://localhost:5173
# หรือแบบ production
npm run build && npm start      # → http://localhost:3000
```

ตารางในฐานข้อมูลถูกสร้างอัตโนมัติตอนเปิด Server ครั้งแรก พร้อมเนื้อหาตัวอย่างและบัญชีแอดมิน

## ขั้นตอนก่อนส่งลิงก์ให้เขา
1. เข้า `/surprisedmycrush` → **Security** เปลี่ยนรหัสผ่าน
2. **Recipient Settings** ตั้งชื่อเล่น / วันเกิด
3. **Guessing Game** ใส่ชื่อคำตอบที่ถูกต้อง (หลายแบบได้) + คำใบ้ 5 ข้อ
4. อัปโหลดรูป (**Photo Gallery**) เพลง (**Music Manager**) แก้จดหมาย / หน้าบอกความรู้สึก / FYI
5. **ทดลองเล่น (Simulator)** เล่นตั้งแต่ต้นจนจบด้วยข้อมูล Draft — ข้อความทดสอบแยกจากของจริง
6. กด **🚀 Publish Changes** แล้วส่งลิงก์ (หรือสร้าง **ลิงก์คำเชิญ** ใน Website Settings)

## สถาปัตยกรรมโดยสรุป
- **Draft / Publish**: ทุกการตั้งค่าเก็บ 2 ชุด (`draft`, `published`) ในตาราง `website_settings`, `recipient_settings`, `birthday_letters`, `game_settings`, `exchange_settings`, `message_settings`, `gallery_settings`, `confession_settings`, `music_settings`, `theme_settings`, `fyi_settings` และรายการ `accepted_answers`, `hints`, `exchange_missions`, `gallery_images`, `music_tracks`, `fyi_items` — Publish คัดลอกแบบ transaction เดียว
- **ความคืบหน้า** อยู่ใน `visitor_sessions`, `guessing_sessions`, `guessing_attempts`, `exchange_requests`, `recipient_messages`, `activity_logs` ฝั่ง Server เท่านั้น (Cookie httpOnly) ลบ Local Storage ก็เพิ่มโอกาสเองไม่ได้ ตั้งให้ผูกกับอุปกรณ์หรือลิงก์คำเชิญได้
- **ความปลอดภัย**: วันเกิด ชื่อเฉลย คำตอบภารกิจ ไม่ถูกส่งไป Frontend; ทุกขั้นตอนตรวจที่ Server; รหัสผ่าน bcrypt; session token เก็บเป็น SHA-256; ล็อกเมื่อใส่รหัสผิด; rate limit; CSRF header; CSP ผ่าน Helmet
- **ไฟล์**: ตรวจชนิดไฟล์จาก magic bytes; เก็บใน S3-compatible storage (R2 / Supabase Storage / AWS S3) ถ้าตั้ง `S3_*` ไม่งั้นเก็บถาวรใน PostgreSQL; รองรับ HTTP Range (เพลงบน iOS)
- **Realtime** (`/ws`): Presence (Online/Idle/Offline/Live), Activity Timeline, แจ้งเตือนแอดมิน, Send Surprise, อัปเดตหน้าผู้รับทันทีเมื่อแอดมินปรับ
- **Live Screen View**: rrweb DOM stream เฉพาะหน้าเว็บนี้ **หลังผู้รับกดยินยอมเท่านั้น** (หยุดแชร์ได้ตลอด), ทุกช่องกรอกถูก mask, ไม่บันทึกถาวร, ไม่เข้าถึงหน้าจอ/กล้อง/ไมค์

## Deploy
- **Render**: push repo แล้วใช้ `render.yaml` (Blueprint) → ได้ Web Service + PostgreSQL
- **Docker**: `docker build -t first-gift . && docker run -e DATABASE_URL=... -p 3000:3000 first-gift`
- ต้องใช้ HTTPS ใน production (cookie ตั้ง `Secure` อัตโนมัติเมื่อ `NODE_ENV=production`)

## ทดสอบ
```bash
npm run typecheck
TEST_URL=http://localhost:3000 npm test   # E2E API test ของทั้ง flow (ใช้กับฐานข้อมูลใหม่)
```
