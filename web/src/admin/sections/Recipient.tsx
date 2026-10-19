import { Area, Field, inputCls, Num, Row, SaveBar, Section, Text, Toggle } from '../components/form';
import { useSection } from '../store';

export default function Recipient() {
  const { value: r, set, save, saving, dirty, reset } = useSection<any>('recipient');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Recipient Settings 🎂</h1>
      <Section title="ข้อมูลผู้รับ" desc="ใช้ {NAME} = ชื่อเล่น, {CALL} = คำเรียก, {FULLNAME} = ชื่อจริง ในข้อความต่าง ๆ ได้ทั้งเว็บ">
        <Row cols={3}>
          <Text label="ชื่อเล่น {NAME}" value={r.nickname} onChange={(v) => set({ nickname: v })} placeholder="เช่น มายด์" />
          <Text label="คำเรียกแทนตัว {CALL}" value={r.callPrefix} onChange={(v) => set({ callPrefix: v })} placeholder="น้อง" hint="จะต่อหน้าชื่อ เช่น น้องมายด์" />
          <Text label="ชื่อจริง {FULLNAME}" value={r.fullName} onChange={(v) => set({ fullName: v })} hint="ไม่บังคับ" />
        </Row>
      </Section>
      <Section title="การตรวจสอบวันเกิด" desc="วันเกิดเก็บไว้ที่ Server เท่านั้น ไม่ถูกส่งไปหน้าเว็บของผู้รับ">
        <Toggle label="เปิดการตรวจสอบวันเกิด" hint="ถ้าปิด ผู้รับจะเห็นปุ่มเปิดของขวัญแทน" checked={r.birthdayCheckEnabled} onChange={(v) => set({ birthdayCheckEnabled: v })} />
        <Row cols={3}>
          <Field label="วันเกิดที่ถูกต้อง" hint="ผู้รับกรอกเป็น DD / MM / YYYY">
            <input type="date" value={r.birthday} onChange={(e) => set({ birthday: e.target.value })} className={inputCls} />
          </Field>
          <Num label="ลองผิดได้กี่ครั้งก่อนพัก" value={r.birthdayMaxTries} min={1} max={20} onChange={(v) => set({ birthdayMaxTries: v })} />
          <Num label="พักกี่นาที" value={r.birthdayLockMinutes} min={1} max={120} onChange={(v) => set({ birthdayLockMinutes: v })} />
        </Row>
        <Toggle label="ยอมรับปี พ.ศ. ด้วย" hint="เช่น 2554 = 2011" checked={r.acceptBuddhistYear} onChange={(v) => set({ acceptBuddhistYear: v })} />
      </Section>
      <Section title="ข้อความหน้าแรก (Birthday Welcome)">
        <Text label="ข้อความหลัก" value={r.welcomeTitle} onChange={(v) => set({ welcomeTitle: v })} />
        <Area label="ข้อความรอง" value={r.welcomeSubtitle} onChange={(v) => set({ welcomeSubtitle: v })} rows={3} />
        <Row>
          <Text label="ข้อความเหนือช่องกรอก" value={r.birthdayLabel} onChange={(v) => set({ birthdayLabel: v })} />
          <Text label="ปุ่มยืนยัน" value={r.birthdayButton} onChange={(v) => set({ birthdayButton: v })} />
          <Text label="เมื่อกรอกถูก" value={r.birthdaySuccess} onChange={(v) => set({ birthdaySuccess: v })} />
          <Text label="เมื่อกรอกผิด" value={r.birthdayError} onChange={(v) => set({ birthdayError: v })} />
          <Text label="เมื่อถูกพักชั่วคราว" value={r.birthdayLocked} onChange={(v) => set({ birthdayLocked: v })} />
          <Text label="ปุ่มเปิดของขวัญ (เมื่อปิดการตรวจวันเกิด)" value={r.startButton} onChange={(v) => set({ startButton: v })} />
          <Text label="ข้อความชวนเปิดเพลง" value={r.soundPrompt} onChange={(v) => set({ soundPrompt: v })} />
        </Row>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
