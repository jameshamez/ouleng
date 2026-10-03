# อูเล้งคาเฟ่ — จองโต๊ะ & สั่งอาหารผ่าน LINE

ระบบจองโต๊ะ สั่งที่โต๊ะ (QR) และสั่งกลับบ้าน ผ่าน LINE (LIFF) + หน้าจอร้าน (ครัว / แคชเชียร์ / การจอง / แอดมิน)
Next.js 16 + Supabase + LINE · ดีไซน์ชิโนโปรตุกีสภูเก็ต

## ลองรันบนเครื่อง (โหมดเดโม — ไม่ต้องมีบัญชีอะไร)

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 → มีทางลัดไปหน้าลูกค้า หน้าร้าน และจำลองสแกน QR ทุกโต๊ะ

- ข้อมูลเก็บใน `.data/demo.json` (ลบไฟล์เพื่อเริ่มใหม่)
- ข้อความ LINE จะพิมพ์ลง terminal แทนการส่งจริง
- PIN เดโม: ครัวส้มตำ `1111` · คาเฟ่ `2222` · แคชเชียร์ `3333` · แอดมิน `9999`
- มุมซ้ายล่างหน้าลูกค้ามีปุ่ม 🧪 สลับผู้ใช้ LINE จำลอง

## ขึ้นใช้งานจริง

### 1. Supabase
1. สร้างโปรเจกต์ที่ supabase.com (region Singapore)
2. SQL Editor → รันไฟล์ `supabase/migrations/20261003000000_init.sql`
3. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. `npm run seed` — ใส่เมนูเริ่มต้นและโต๊ะ 15 ตัว

### 2. LINE (ใช้บัญชี LINE ของร้าน)
1. [LINE Official Account](https://manager.line.biz) ของร้าน → เปิด Messaging API
2. [LINE Developers](https://developers.line.biz):
   - **Messaging API channel** (ผูกกับ OA) → ออก Channel access token → `LINE_CHANNEL_ACCESS_TOKEN`
   - **LINE Login channel** → `LINE_LOGIN_CHANNEL_ID` → เพิ่ม LIFF app ขนาด *Full*, scope `openid profile`,
     Endpoint URL = `https://<โดเมน>/liff` → `NEXT_PUBLIC_LIFF_ID`
3. เชิญ OA เข้ากลุ่ม LINE พนักงาน แล้วใส่ group ID ใน `LINE_STAFF_GROUP_ID`
   (ดูได้จาก webhook event ตอนบอทเข้ากลุ่ม)
4. Rich Menu ของ OA: ปุ่ม จองโต๊ะ → `https://liff.line.me/<LIFF_ID>/book`,
   สั่งกลับบ้าน → `.../takeaway`, สั่งที่โต๊ะ → `.../scan`, หน้าแรก → `https://liff.line.me/<LIFF_ID>`

### 3. ตั้งค่าร้าน
`PROMPTPAY_ID`, `STAFF_SESSION_SECRET` (สุ่มยาวๆ), `STAFF_PIN_*` 4 หลักของแต่ละบทบาท
— ถ้าไม่ตั้ง ระบบจะไม่ยอมรันในโหมด production

### 4. Deploy (Vercel)
Import repo → ใส่ env ทั้งหมด → Deploy → แอดมินเข้า `/staff/admin` → แท็บ "QR ประจำโต๊ะ" → พิมพ์วางโต๊ะ

## โครงสร้าง

| ส่วน | ที่อยู่ |
|---|---|
| หน้าลูกค้า (LIFF) | `src/app/liff/*` |
| หน้าร้าน | `src/app/staff/*` |
| API เดียว `POST /api/<action>` + สิทธิ์ต่อ action | `src/app/api/[action]/route.ts` |
| Business logic | `src/lib/service.ts` |
| Logic ล้วน (ราคา, โต๊ะว่าง, พร้อมเพย์) + เทสต์ | `src/lib/logic.ts`, `logic.test.ts` |
| ฐานข้อมูล: Supabase / ไฟล์เดโม | `src/lib/db/*` |
| เมนูเริ่มต้น | `src/lib/seed.ts` |

```bash
npm test        # unit tests
npm run build   # production build
```

## ยังไม่ได้ทำ (ต่อยอดได้)
- แจ้งเตือนลูกค้าล่วงหน้า 2 ชม. ก่อนเวลาจอง (ต้องมี cron)
- อัปโหลดรูปเมนูจริง (ตอนนี้ใช้ภาพอีโมจิ; ใส่ `image_url` ได้)
- ตรวจสลิปอัตโนมัติผ่าน API ธนาคาร/SlipOK
- รายงานยอดขายย้อนหลัง
