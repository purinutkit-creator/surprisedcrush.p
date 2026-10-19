export interface VisitorEvent { id: string | number; type: string; data: any; at?: string; created_at?: string }

const PAGES: Record<string, string> = {
  welcome: 'หน้าแรก (วันเกิด)', letter: 'จดหมาย', game: 'เกมทายตัวตน', exchange: 'แลกสิทธิ์', correct: 'ทายถูก!', message: 'เขียนข้อความ',
  gallery: 'แกลเลอรี', end: 'หน้าจบ', confession: 'หน้าบอกความรู้สึก',
};
export const pageLabel = (p: string) => PAGES[p] ?? p;

export function eventLabel(e: VisitorEvent): string {
  const d = e.data ?? {};
  switch (e.type) {
    case 'enter': return `เข้าสู่เว็บไซต์${d.device ? ` (${d.device})` : ''}`;
    case 'play_start': return 'เริ่มเล่น';
    case 'birthday_typing': return 'เริ่มกรอกวันเกิด';
    case 'birthday_ok': return 'ตรวจสอบวันเกิดสำเร็จ 🎂';
    case 'birthday_fail': return `กรอกวันเกิดผิด (ครั้งที่ ${d.tries ?? '?'})`;
    case 'letter_opened': return 'เปิดจดหมายอวยพร 💌';
    case 'letter_read': return 'อ่านจดหมายเสร็จ';
    case 'reread_letter': return 'เปิดอ่านจดหมายอีกครั้ง';
    case 'game_start': return 'เริ่มเกมทายตัวตน 🕵️';
    case 'guess': return `ทายชื่อครั้งที่ ${d.attempt ?? '?'}: “${d.guess ?? ''}” — ${d.correct ? 'ถูก ✅' : 'ผิด ❌'}`;
    case 'hint_unlocked': return `เปิดคำใบ้ที่ ${d.hint}`;
    case 'exhausted': return 'ใช้โอกาสทายครบแล้ว 🥺';
    case 'exchange_request': return `ขอแลกสิทธิ์: ${d.mission ?? ''} (${({ pending: 'รออนุมัติ', approved: 'สำเร็จ', failed: 'ไม่ผ่านเงื่อนไข' } as any)[d.status] ?? d.status})`;
    case 'exchange_approved': return `อนุมัติภารกิจ: ${d.mission ?? ''}`;
    case 'exchange_rejected': return `ปฏิเสธภารกิจ: ${d.mission ?? ''}`;
    case 'solved': return d.via === 'guess' ? 'ทายถูก 🎉' : d.via === 'mission' ? 'ปลดล็อกเฉลยจากภารกิจ 🎉' : 'แอดมินเปิดเฉลยให้ 🎉';
    case 'message_typing': return 'เริ่มเขียนข้อความ ✍️';
    case 'message_sent': return `ส่งข้อความสำเร็จ 💌 (${d.chars ?? '?'} ตัวอักษร)`;
    case 'gallery_opened': return 'เปิดแกลเลอรี 📸';
    case 'photo_open': return `เปิดดูรูปที่ ${d.n}`;
    case 'confession_opened': return 'เข้าสู่หน้าบอกความรู้สึก 💖';
    case 'confession_replay': return 'กดอ่านข้อความบอกความรู้สึกอีกครั้ง';
    case 'fyi_open': return `เปิด TIPS 💡 (${pageLabel(d.page)})`;
    case 'fyi_item': return `ดู FYI ข้อที่ ${d.n}`;
    case 'page_view': return `อยู่หน้า ${pageLabel(d.page)}`;
    case 'music_on': return 'เปิดเพลง 🎵';
    case 'music_off': return 'ปิดเพลง';
    case 'live_consent_on': return 'อนุญาต Live View 🔴';
    case 'live_consent_off': return 'หยุดแชร์ Live View';
    case 'leave': return 'ออกจากเว็บไซต์';
    case 'admin_reset_attempts': return '(แอดมิน) รีเซ็ตจำนวนครั้ง';
    case 'admin_extra_chance': return `(แอดมิน) เพิ่มโอกาสทาย +${d.amount ?? 1}`;
    case 'admin_unlock_hint': return '(แอดมิน) ปลดล็อกคำใบ้';
    case 'admin_special_hint': return '(แอดมิน) ส่งคำใบ้พิเศษ';
    case 'admin_surprise': return `(แอดมิน) ส่งเซอร์ไพรส์ ${d.kind ?? ''}`;
    case 'admin_reset_session': return '(แอดมิน) รีเซ็ตความคืบหน้า';
    default: return e.type;
  }
}

/** Which notification preference an event belongs to. */
export function notifyKey(e: VisitorEvent): string | null {
  switch (e.type) {
    case 'enter': return 'enter';
    case 'birthday_ok': return 'birthday_ok';
    case 'letter_opened': return 'letter_opened';
    case 'game_start': return 'game_start';
    case 'guess': return e.data?.correct ? 'guess_correct' : 'guess_wrong';
    case 'exhausted': return 'exhausted';
    case 'exchange_request': return e.data?.status === 'failed' ? null : 'exchange_request';
    case 'message_sent': return 'message_sent';
    case 'gallery_opened': return 'gallery_opened';
    case 'confession_opened': return 'confession_opened';
    case 'leave': return 'leave';
    default: return null;
  }
}

export const NOTIFY_LABELS: Record<string, string> = {
  enter: 'ผู้รับเข้าเว็บไซต์', birthday_ok: 'กรอกวันเกิดถูกต้อง', letter_opened: 'เปิดจดหมาย', game_start: 'เริ่มทายตัวตน',
  guess_wrong: 'ทายผิด', guess_correct: 'ทายถูก', exhausted: 'ใช้โอกาสครบ', exchange_request: 'ขอแลกสิทธิ์', message_sent: 'ส่งข้อความ',
  gallery_opened: 'เปิดหน้า Gallery', confession_opened: 'เข้าหน้า /yourmybestcrushever', leave: 'ออกจากเว็บไซต์',
};

export const fmtTime = (t: string | number | Date | undefined | null) =>
  t ? new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
export const fmtDateTime = (t: string | number | Date | undefined | null) =>
  t ? new Date(t).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export function fmtDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}ชม. ${m}น.` : m ? `${m}น. ${sec}วิ` : `${sec}วิ`;
}
