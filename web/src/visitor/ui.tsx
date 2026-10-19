import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { useVisitorMaybe } from './context';

export function GiftButton({ children, className = '', ...rest }: HTMLMotionProps<'button'> & { children: ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} className={`gift-btn ${className}`} {...rest}>
      {children}
    </motion.button>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  const style = useVisitorMaybe()?.state.theme?.cardStyle ?? 'glass';
  return <div data-style={style} className={`gift-card ${className}`}>{children}</div>;
}

const variants: Record<string, any> = {
  fadeSlide: { initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -24 } },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  zoom: { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.04 } },
  slideUp: { initial: { opacity: 0, y: 80 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -80 } },
};

/** Every visitor page is wrapped in this: smooth fade + slide in/out (theme configurable). */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const kind = useVisitorMaybe()?.state.theme?.transition ?? 'fadeSlide';
  const v = reduce ? variants.fade : variants[kind] ?? variants.fadeSlide;
  return (
    <motion.main
      initial={v.initial} animate={v.animate} exit={v.exit}
      transition={{ duration: reduce ? 0.01 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col items-center px-5 pt-safe pb-28 ${className}`}
    >
      {children}
    </motion.main>
  );
}

export function PopIn({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22, delay }} className={className}
    >
      {children}
    </motion.div>
  );
}
