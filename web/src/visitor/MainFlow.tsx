import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useVisitor } from './context';
import CorrectPage from './pages/Correct';
import EndPage from './pages/End';
import ExchangePage from './pages/Exchange';
import GalleryPage from './pages/Gallery';
import GamePage from './pages/Game';
import LetterPage from './pages/Letter';
import MessagePage from './pages/Message';
import WelcomePage from './pages/Welcome';

const pages = {
  welcome: WelcomePage, letter: LetterPage, game: GamePage, exchange: ExchangePage,
  correct: CorrectPage, message: MessagePage, gallery: GalleryPage, end: EndPage,
} as const;

/** The gift journey on "/". The server decides the step; we only animate between them. */
export default function MainFlow() {
  const { state, setPage } = useVisitor();
  // Visitors may re-read the letter from the gallery without changing their saved progress.
  const [reread, setReread] = useState(false);
  const step = reread ? 'letter' : state.step;
  useEffect(() => { setPage(step === 'end' ? 'gallery' : step); }, [step, setPage]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);
  const Comp = pages[step] ?? WelcomePage;
  return (
    <AnimatePresence mode="wait">
      <Comp key={step} onReread={() => setReread(true)} onRereadDone={() => setReread(false)} reread={reread} />
    </AnimatePresence>
  );
}

export interface PageProps { onReread: () => void; onRereadDone: () => void; reread: boolean }
