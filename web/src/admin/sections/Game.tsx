import { adminApi } from '../../lib/api';
import { Badge, Btn, Empty, inputCls, MediaInput, Num, Row, SaveBar, Section, StringList, Text, Toggle } from '../components/form';
import { newKey, SortableList } from '../components/Sortable';
import { fmtDateTime } from '../events';
import { useAdmin, useAsync, useList, useSection } from '../store';

export default function Game() {
  const { toast } = useAdmin();
  const web = useSection<any>('website');
  const g = useSection<any>('game');
  const answers = useList<any>('answers');
  const hints = useList<any>('hints');
  const attempts = useAsync(() => adminApi.get('/attempts'));
  const dirty = web.dirty || g.dirty || answers.dirty || hints.dirty;
  const saving = web.saving || g.saving || answers.saving || hints.saving;
  const saveAll = async () => {
    if (web.dirty) await web.save();
    if (g.dirty) await g.save();
    if (answers.dirty) await answers.save();
    if (hints.dirty) await hints.save();
  };
  const resetAll = () => { web.reset(); g.reset(); answers.reset(); hints.reset(); };
  const v = g.value;

  const resetEveryone = async () => {
    if (!confirm('รีเซ็ตจำนวนครั้งที่ทายของผู้เล่นทุกคน (ไม่รวม Preview)?')) return;
    const sessions = await adminApi.get('/sessions');
    for (const s of sessions) await adminApi.post(`/sessions/${s.id}/action`, { action: 'reset_attempts' });
    toast(`รีเซ็ตแล้ว ${sessions.length} คน`, 'ok');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Guessing Game 🕵️</h1>
      <Toggle label="เปิดเกมทายตัวตน" hint="ถ้าปิด ผู้รับจะข้ามไปหน้าเขียนข้อความเลย" checked={web.value.pages.game}
        onChange={(on) => web.set({ pages: { ...web.value.pages, game: on } })} />

      <Section title="คำตอบที่ถูกต้อง 🔒" desc="ตรวจที่ Server เท่านั้น ไม่ถูกส่งไปหน้าเว็บ · ระบบตัดช่องว่างส่วนเกินและไม่สนตัวพิมพ์เล็ก-ใหญ่ภาษาอังกฤษให้อัตโนมัติ">
        {answers.items.length === 0 && <Empty>ยังไม่มีคำตอบ — เพิ่มชื่อจริง ชื่อเล่น และชื่อที่สะกดต่างกันได้หลายแบบ</Empty>}
        {answers.items.map((a) => (
          <div key={a._key} className="flex gap-2">
            <input value={a.value} onChange={(e) => answers.update(a._key, { value: e.target.value })} placeholder="เช่น ภูมิ / Poom / พี่ภูมิ" className={inputCls} />
            <Btn kind="danger" onClick={() => answers.remove(a._key)}>ลบ</Btn>
          </div>
        ))}
        <Btn onClick={() => answers.setItems([...answers.items, { _key: newKey(), value: '' }])}>＋ เพิ่มคำตอบที่ยอมรับ</Btn>
      </Section>

      <Section title="หน้าเกม">
        <Row>
          <Text label="หัวข้อ" value={v.title} onChange={(x) => g.set({ title: x })} />
          <Text label="ข้อความรอง" value={v.subtitle} onChange={(x) => g.set({ subtitle: x })} />
          <Text label="Placeholder ช่องกรอก" value={v.placeholder} onChange={(x) => g.set({ placeholder: x })} />
          <Text label="ปุ่มทาย" value={v.button} onChange={(x) => g.set({ button: x })} />
          <Num label="จำนวนครั้งที่ทายได้" value={v.maxAttempts} min={1} max={20} onChange={(x) => g.set({ maxAttempts: x })} />
          <Text label="ข้อความโอกาสที่เหลือ" hint="{N} = จำนวนที่เหลือ" value={v.remainingText} onChange={(x) => g.set({ remainingText: x })} />
          <Text label="หัวข้อคำใบ้" value={v.hintsTitle} onChange={(x) => g.set({ hintsTitle: x })} />
        </Row>
        <Toggle label="แสดงโอกาสเป็นหัวใจ" checked={v.showHearts} onChange={(x) => g.set({ showHearts: x })} />
        <Toggle label="เสียงเอฟเฟกต์ (เมื่อผู้รับเปิดเสียง)" checked={v.soundEffects} onChange={(x) => g.set({ soundEffects: x })} />
        <StringList label="ข้อความเมื่อทายผิด (สุ่มแสดง)" value={v.wrongMessages} onChange={(x) => g.set({ wrongMessages: x })} />
      </Section>

      <Section title="คำใบ้ทีละขั้น 💡" desc="ทายผิดครั้งที่ 1 → เปิดคำใบ้ที่ 1, ครั้งที่ 2 → คำใบ้ที่ 2 … ลากเพื่อเรียงลำดับ">
        <SortableList items={hints.items} onChange={hints.setItems} render={(h, i, handle) => (
          <div className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-white p-2.5">
            {handle}
            <span className="mt-2 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pink-100 text-xs font-bold text-pink-700">{i + 1}</span>
            <textarea rows={2} value={h.text} onChange={(e) => hints.update(h._key, { text: e.target.value })} className={`${inputCls} resize-y`} />
            <Btn kind="danger" onClick={() => hints.remove(h._key)}>ลบ</Btn>
          </div>
        )} />
        <Btn onClick={() => hints.setItems([...hints.items, { _key: newKey(), text: '' }])}>＋ เพิ่มคำใบ้</Btn>
      </Section>

      <Section title="เมื่อทายถูก 🎉">
        <Row>
          <Text label="ข้อความใหญ่" value={v.correctTitle} onChange={(x) => g.set({ correctTitle: x })} />
          <Text label="ข้อความรอง 1" value={v.correctSubtitle} onChange={(x) => g.set({ correctSubtitle: x })} />
          <Text label="ข้อความรอง 2" value={v.correctSubtitle2} onChange={(x) => g.set({ correctSubtitle2: x })} />
          <Text label="ปุ่มไปเขียนข้อความ" value={v.correctButton} onChange={(x) => g.set({ correctButton: x })} />
        </Row>
        <Toggle label="แสดงชื่อ/รูปผู้ส่งตอนเฉลย" checked={v.revealSenderName} onChange={(x) => g.set({ revealSenderName: x })} />
        {v.revealSenderName && (
          <Row>
            <Text label="ชื่อผู้ส่งที่จะแสดง" value={v.senderDisplayName} onChange={(x) => g.set({ senderDisplayName: x })} />
            <MediaInput label="รูปผู้ส่ง (ไม่บังคับ)" value={v.senderPhotoId} onChange={(id) => g.set({ senderPhotoId: id })} />
          </Row>
        )}
      </Section>

      <Section title="ประวัติคำตอบ" actions={<div className="flex gap-2"><Btn onClick={attempts.reload}>↻</Btn><Btn kind="danger" onClick={resetEveryone}>รีเซ็ตจำนวนครั้งทุกคน</Btn></div>}>
        {(attempts.data ?? []).length === 0 ? <Empty>ยังไม่มีใครทาย</Empty> : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500"><tr><th className="py-1">เวลา</th><th>ชื่อที่ทาย</th><th>ผล</th><th>อุปกรณ์</th></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {attempts.data!.map((a: any) => (
                  <tr key={a.id}>
                    <td className="py-1.5 text-zinc-500">{fmtDateTime(a.created_at)}</td>
                    <td className="font-medium">{a.guess}</td>
                    <td>{a.correct ? <Badge color="green">ถูก</Badge> : <Badge color="red">ผิด</Badge>}</td>
                    <td className="text-zinc-500">{a.device}{a.is_preview && <Badge color="violet">preview</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={saveAll} onReset={resetAll} />
    </div>
  );
}
