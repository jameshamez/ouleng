# อูเล้งคาเฟ่ — ระบบจองโต๊ะและสั่งอาหารผ่าน LINE (Design)

## เป้าหมาย
ร้านจริง "อูเล้งคาเฟ่ แก้วอินทร์" (คาเฟ่ภูเก็ต + ส้มตำ/อีสาน, ~15 โต๊ะ, ในร้าน + ริมคลอง)
ให้ลูกค้าจองโต๊ะ สั่งที่โต๊ะ และสั่งกลับบ้านผ่าน LINE ได้ หน้าตาสวยตามบรรยากาศร้าน (ชิโนโปรตุกีสภูเก็ต)

## การตัดสินใจหลัก
| เรื่อง | ตัดสินใจ |
|---|---|
| กินที่ร้าน | สแกน QR ที่โต๊ะ (สั่งหลายรอบ บิลรวมต่อโต๊ะ) + สั่งล่วงหน้าตอนจอง |
| กลับบ้าน | รับเองที่ร้าน ต้องจ่ายก่อน ร้านถึงเริ่มทำ |
| ชำระเงิน | QR พร้อมเพย์ตามยอด + แนบสลิป + พนักงานกดยืนยัน (หรือเงินสดที่ร้าน) |
| ฝั่งร้าน | หน้าเว็บแยกบทบาท (ครัวส้มตำ / เคาน์เตอร์คาเฟ่ / แคชเชียร์ / แอดมิน) + แจ้งเตือน LINE กลุ่ม |
| สองร้าน | เมนูเดียว ตะกร้าเดียว บิลเดียว แต่ order item แยก `station` = `somtam` / `cafe` ไปคนละจอ |
| จอง | ไม่มีมัดจำ, ช่วงละ 2 ชม., เปิด 12:00–24:00 (ครัวปิด 23:30), ร้านต้องกดยืนยัน |
| Stack | Next.js 16 (App Router) + Supabase (Postgres + Storage) + LINE LIFF + Messaging API |

## สถาปัตยกรรม
- แอป Next.js เดียว: `/liff/*` (ลูกค้า, ใน LINE) และ `/staff/*` (พนักงาน, PIN ตามบทบาท)
- Browser ไม่คุยกับ Supabase ตรง — ทุกอย่างผ่าน Route Handler `/api/[action]` ฝั่งเซิร์ฟเวอร์ (service role key ไม่หลุดไปฝั่ง client)
- ชั้นข้อมูล `src/lib/db` มี interface เดียว (`list/get/insert/update`) 2 adapter:
  - **Supabase** — เมื่อมี `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
  - **Demo** — ไฟล์ JSON ใน `.data/` (ไม่ต้องมี Docker/บัญชีใดๆ)
- Realtime: จอครัว/แคชเชียร์/ลูกค้า poll ทุก 3 วินาที (SWR) — พอสำหรับร้าน 15 โต๊ะ, ไม่ผูกกับ adapter
- LINE: ถ้ามี `NEXT_PUBLIC_LIFF_ID` ใช้ LIFF จริง, ไม่มีใช้ผู้ใช้จำลอง; ถ้ามี `LINE_CHANNEL_ACCESS_TOKEN` ส่ง push จริง, ไม่มีพิมพ์ลง log

## ข้อมูล
`menu_categories`, `menu_items(station, options jsonb, is_available)`, `tables(code, zone, seats)`,
`bookings(status: pending|confirmed|rejected|seated|cancelled)`, `dining_sessions(table, status: open|bill_requested|paid)`,
`orders(type: dine_in|takeaway|preorder, status)`, `order_items(station, status: held|queued|cooking|ready|served|cancelled)`,
`payments(target: session|order, method: promptpay|cash, slip_url, status: pending|verified|rejected)`

## Flows
- **Dine-in**: สแกน `/liff/t/{tableCode}` → เปิด/เข้าร่วม session → สั่ง (items `queued`) → ครัว cooking→ready → พนักงาน served → ขอเช็กบิล → พร้อมเพย์+สลิป หรือเงินสด → แคชเชียร์ยืนยัน → session `paid`, โต๊ะว่าง
- **Takeaway**: เลือกเมนู + เวลารับ → order `awaiting_payment` (items `held`) → สลิป → แคชเชียร์ยืนยัน → items `queued` → ทุก item ready → order `ready` + push LINE → `picked_up`
- **Booking**: ฟอร์ม → เช็กว่าง (จำนวนโต๊ะในโซนที่นั่งพอ − การจองที่ทับช่วง 2 ชม.) → `pending` → ร้านยืนยัน (push LINE) → มาถึง ร้านกด "เข้าโต๊ะ" เลือกโต๊ะ → เปิด session, preorder items `held`→`queued`

## ทดสอบ
Vitest สำหรับ logic ล้วน: ราคา/ตัวเลือก, availability การจอง, payload พร้อมเพย์, สถานะ order จาก items
