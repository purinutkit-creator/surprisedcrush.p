import { useNavigate } from 'react-router-dom';
import { useVisitor } from '../context';
import type { PageProps } from '../MainFlow';
import { GiftButton, Page } from '../ui';

/** Final screen when the gallery is turned off. */
export default function EndPage({ onReread }: PageProps) {
  const { state } = useVisitor();
  const nav = useNavigate();
  const g = state.gallery ?? {};
  return (
    <Page className="justify-center text-center">
      <div className="text-7xl animate-heartbeat">💗</div>
      <p className="mt-6 font-heading text-3xl text-primary">{g.endText1 ?? 'ขอบคุณที่เปิดของขวัญชิ้นนี้นะ 💗'}</p>
      <p className="mt-3 text-lg text-ink/80">{g.endText2 ?? ''}</p>
      <div className="mt-10 flex flex-col items-center gap-3">
        {state.pages?.confession && state.progress.confessionAvailable && (
          <GiftButton onClick={() => nav('/yourmybestcrushever')}>{g.confessionButton ?? 'ยังมีอีกอย่างอยากบอก…'}</GiftButton>
        )}
        {state.pages?.letter && <button className="gift-btn-ghost" onClick={onReread}>อ่านจดหมายอีกครั้ง 💌</button>}
      </div>
    </Page>
  );
}
