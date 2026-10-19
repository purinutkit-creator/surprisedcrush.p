import { useState } from 'react';
import { adminApi } from '../../lib/api';
import { Badge, Btn, Empty, Num, Row, SaveBar, Section, Select, StringList, Text, Toggle, Area } from '../components/form';
import { newKey, SortableList } from '../components/Sortable';
import { fmtDateTime } from '../events';
import { useAdmin, useAsync, useList, useLiveBus, useSection } from '../store';

const KINDS: [string, string][] = [
  ['message', 'ทำภารกิจ: ส่งข้อความหาเรา (ตรวจจำนวนตัวอักษร)'],
  ['question', 'ตอบคำถามพิเศษ (ตรวจคำตอบที่ Server)'],
  ['phrase', 'พิมพ์ข้อความตามที่กำหนด (ต้องตรงทุกตัว)'],
  ['free', 'ส่งคำขอ / บอกสิ่งที่อยากรู้ (ต้องรอแอดมินอนุมัติ)'],
];

function Requests() {
  const { toast, setPending } = useAdmin();
  const reqs = useAsync(() => adminApi.get('/requests'));
  useLiveBus((m) => { if (m.t === 'requests_changed') reqs.reload(); }, [reqs.reload]);
  const decide = async (id: string, approve: boolean) => {
    try {
      await adminApi.post(`/requests/${id}/decide`, { approve });
      toast(approve ? 'อนุมัติแล้ว ✓ ผู้รับจะได้รางวัลทันที' : 'ปฏิเสธแล้ว', 'ok');
      reqs.reload();
      const s = await adminApi.get('/stats');
      setPending(s.pending_requests);
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const list: any[] = reqs.data ?? [];
  return (
    <Section title="คำขอแลกสิทธิ์" desc="คำขอที่ต้องอนุมัติจะขึ้นที่นี่แบบ Real-Time" actions={<Btn onClick={reqs.reload}>↻</Btn>}>
      {list.length === 0 ? <Empty>ยังไม่มีคำขอ</Empty> : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.id} className={`rounded-xl border p-3 ${r.status === 'pending' ? 'border-violet-300 bg-violet-50' : 'border-zinc-200'}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{r.mission_title}</span>
                <Badge color={r.status === 'pending' ? 'violet' : r.status === 'approved' ? 'green' : r.status === 'failed' ? 'zinc' : 'red'}>
                  {({ pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธ', failed: 'ไม่ผ่านเงื่อนไข' } as any)[r.status]}
                </Badge>
                {r.is_preview && <Badge color="amber">preview</Badge>}
                <span className="ml-auto text-xs text-zinc-500">{fmtDateTime(r.created_at)} · {r.device}</span>
              </div>
              {r.submission && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-2 text-sm">{r.submission}</p>}
              {r.status === 'pending' && (
                <div className="mt-2 flex gap-2">
                  <Btn kind="primary" onClick={() => decide(r.id, true)}>✓ อนุมัติ</Btn>
                  <Btn kind="danger" onClick={() => decide(r.id, false)}>✕ ปฏิเสธ</Btn>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function Exchange() {
  const web = useSection<any>('website');
  const e = useSection<any>('exchange');
  const missions = useList<any>('missions');
  const [open, setOpen] = useState<string | null>(null);
  const dirty = web.dirty || e.dirty || missions.dirty;
  const saving = web.saving || e.saving || missions.saving;
  const save = async () => { if (web.dirty) await web.save(); if (e.dirty) await e.save(); if (missions.dirty) await missions.save(); };
  const v = e.value;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Exchange & Missions 🎟️</h1>
      <Requests />
      <Toggle label="เปิดระบบแลกสิทธิ์" hint="เมื่อผู้รับทายผิดครบแล้วจะเห็นภารกิจให้เลือก" checked={web.value.pages.exchange}
        onChange={(on) => web.set({ pages: { ...web.value.pages, exchange: on } })} />
      <Section title="ข้อความหน้าแลกสิทธิ์">
        <Row>
          <Text label="หัวข้อ (หมดโอกาส)" value={v.exhaustedTitle} onChange={(x) => e.set({ exhaustedTitle: x })} />
          <Text label="ข้อความรอง" value={v.exhaustedSubtitle} onChange={(x) => e.set({ exhaustedSubtitle: x })} />
          <Text label="ปุ่มแลกโอกาส" value={v.exchangeButton} onChange={(x) => e.set({ exchangeButton: x })} />
          <Text label="หัวข้อรายการภารกิจ" value={v.listTitle} onChange={(x) => e.set({ listTitle: x })} />
          <Text label="ข้อความรออนุมัติ" value={v.pendingText} onChange={(x) => e.set({ pendingText: x })} />
          <Text label="ข้อความเมื่อถูกปฏิเสธ" value={v.rejectedText} onChange={(x) => e.set({ rejectedText: x })} />
          <Text label="ข้อความเมื่อไม่มีภารกิจ" value={v.noMissionsText} onChange={(x) => e.set({ noMissionsText: x })} />
        </Row>
      </Section>
      <Section title="ภารกิจ" desc="ทุกเงื่อนไขตรวจที่ Server ผู้รับกดผ่านเองไม่ได้ · ลากเพื่อเรียงลำดับ">
        <SortableList items={missions.items} onChange={missions.setItems} render={(m, i, handle) => (
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="flex items-center gap-2 p-2.5">
              {handle}
              <button className="flex-1 text-left font-medium" onClick={() => setOpen(open === m._key ? null : m._key)}>
                {i + 1}. {m.title || '(ไม่มีชื่อ)'} <span className="ml-1 text-xs text-zinc-400">{KINDS.find((k) => k[0] === m.kind)?.[1].split(' (')[0]}</span>
              </button>
              {!m.enabled && <Badge>ปิดอยู่</Badge>}
              <Btn kind="ghost" onClick={() => setOpen(open === m._key ? null : m._key)}>{open === m._key ? 'ย่อ' : 'แก้ไข'}</Btn>
            </div>
            {open === m._key && (
              <div className="space-y-4 border-t border-zinc-100 p-4">
                <Toggle label="เปิดใช้ภารกิจนี้" checked={m.enabled} onChange={(x) => missions.update(m._key, { enabled: x })} />
                <Row>
                  <Text label="ชื่อภารกิจ" value={m.title} onChange={(x) => missions.update(m._key, { title: x })} />
                  <Select label="ประเภท / เงื่อนไขสำเร็จ" value={m.kind} onChange={(x) => missions.update(m._key, { kind: x })} options={KINDS} />
                </Row>
                <Area label="คำอธิบาย" rows={2} value={m.description} onChange={(x) => missions.update(m._key, { description: x })} />
                {m.kind === 'message' && <Num label="ความยาวขั้นต่ำ (ตัวอักษร)" value={m.minLength} min={1} max={2000} onChange={(x) => missions.update(m._key, { minLength: x })} />}
                {m.kind === 'question' && (
                  <>
                    <Text label="คำถาม" value={m.question} onChange={(x) => missions.update(m._key, { question: x })} />
                    <StringList label="คำตอบที่ถูกต้อง (ซ่อนจากผู้รับ)" value={m.answers} onChange={(x) => missions.update(m._key, { answers: x })} />
                  </>
                )}
                {m.kind === 'phrase' && <Text label="ข้อความที่ต้องพิมพ์ให้ตรง" value={m.phrase} onChange={(x) => missions.update(m._key, { phrase: x })} />}
                <Row cols={3}>
                  <Num label="ลองได้กี่ครั้ง" value={m.maxTries} min={1} max={20} onChange={(x) => missions.update(m._key, { maxTries: x })} />
                  <Num label="รางวัล: โอกาสทายเพิ่ม" value={m.rewardExtraChances} min={0} max={20} onChange={(x) => missions.update(m._key, { rewardExtraChances: x })} />
                </Row>
                <Area label="รางวัล: คำใบ้พิเศษ (เว้นว่าง = ไม่ให้)" rows={2} value={m.rewardSpecialHint} onChange={(x) => missions.update(m._key, { rewardSpecialHint: x })} />
                <Toggle label="รางวัล: เปิดเฉลยทันที" hint="สำเร็จแล้วข้ามไปหน้า ใช่เลยยย ได้เลย" checked={m.rewardReveal} onChange={(x) => missions.update(m._key, { rewardReveal: x })} />
                <Toggle label="ต้องรอแอดมินอนุมัติ" hint={m.kind === 'free' ? 'ประเภทนี้ต้องอนุมัติเสมอ' : 'ผ่านเงื่อนไขแล้วยังต้องรอคุณกดอนุมัติ'} checked={m.requiresApproval || m.kind === 'free'} onChange={(x) => missions.update(m._key, { requiresApproval: x })} />
                <Btn kind="danger" onClick={() => missions.remove(m._key)}>ลบภารกิจนี้</Btn>
              </div>
            )}
          </div>
        )} />
        <Btn onClick={() => {
          const key = newKey();
          missions.setItems([...missions.items, { _key: key, title: 'ภารกิจใหม่', description: '', kind: 'message', minLength: 20, question: '', answers: [], phrase: '', maxTries: 3, requiresApproval: false, rewardExtraChances: 1, rewardSpecialHint: '', rewardReveal: false, enabled: true }]);
          setOpen(key);
        }}>＋ เพิ่มภารกิจ</Btn>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => { web.reset(); e.reset(); missions.reset(); }} />
    </div>
  );
}
