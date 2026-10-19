import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;

export function graphemes(s: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
  return Array.from(s);
}

/** Same rule as the server: trimmed, whitespace runs collapsed, emoji count as one. */
export function countChars(text: string): number {
  const cleaned = text.normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
  return graphemes(cleaned).length;
}

export const fill = (t: string, vars: Record<string, string | number>) =>
  String(t ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

interface Seg { text: string; b?: boolean; i?: boolean; u?: boolean; s?: boolean; mark?: boolean; color?: string; size?: string }

/**
 * Tiny, safe formatter for admin-written text (never uses innerHTML):
 * **bold**  *italic*  __underline__  ~~strike~~  ==highlight==  [color=#ff82ab]text[/color]  [big]text[/big]  [small]text[/small]
 */
export function parseRich(input: string): Seg[] {
  const out: Seg[] = [];
  const re = /(\*\*|__|~~|==|\*|\[color=(#[0-9a-fA-F]{3,8})\]|\[\/color\]|\[big\]|\[\/big\]|\[small\]|\[\/small\])/g;
  const st: Omit<Seg, 'text'> = {};
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (t: string) => { if (t) out.push({ text: t, ...st }); };
  while ((m = re.exec(input))) {
    push(input.slice(last, m.index));
    last = m.index + m[0].length;
    const tok = m[1];
    if (tok === '**') st.b = !st.b;
    else if (tok === '*') st.i = !st.i;
    else if (tok === '__') st.u = !st.u;
    else if (tok === '~~') st.s = !st.s;
    else if (tok === '==') st.mark = !st.mark;
    else if (tok.startsWith('[color=')) st.color = m[2];
    else if (tok === '[/color]') st.color = undefined;
    else if (tok === '[big]') st.size = '1.35em';
    else if (tok === '[small]') st.size = '0.85em';
    else if (tok === '[/big]' || tok === '[/small]') st.size = undefined;
  }
  push(input.slice(last));
  return out;
}

function SegView({ seg, text }: { seg: Seg; text: string }) {
  const style: CSSProperties = {};
  if (seg.color) style.color = seg.color;
  if (seg.size) style.fontSize = seg.size;
  let node: JSX.Element = <span style={style}>{text}</span>;
  if (seg.b) node = <strong className="font-bold">{node}</strong>;
  if (seg.i) node = <em>{node}</em>;
  if (seg.u) node = <u className="decoration-primary/60 underline-offset-4">{node}</u>;
  if (seg.s) node = <s>{node}</s>;
  if (seg.mark) node = <mark className="rounded bg-secondary px-1 text-inherit">{node}</mark>;
  return node;
}

/** Renders formatted text; `visible` limits how many characters are shown (for typewriter effects). */
export function RichText({ text, visible, className }: { text: string; visible?: number; className?: string }) {
  const segs = useMemo(() => parseRich(text ?? ''), [text]);
  let remaining = visible ?? Infinity;
  const nodes: JSX.Element[] = [];
  segs.forEach((seg, i) => {
    if (remaining <= 0) return;
    const g = graphemes(seg.text);
    const shown = g.length <= remaining ? seg.text : g.slice(0, remaining).join('');
    remaining -= g.length;
    nodes.push(<SegView key={i} seg={seg} text={shown} />);
  });
  return <span className={className} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{nodes}</span>;
}

export function plainLength(text: string) {
  return parseRich(text ?? '').reduce((n, s) => n + graphemes(s.text).length, 0);
}

/** Types formatted text character by character. speed = ms per character (0 = instant). */
export function Typewriter({ text, speed = 30, className, onDone, start = true, caret = true }: {
  text: string; speed?: number; className?: string; onDone?: () => void; start?: boolean; caret?: boolean;
}) {
  const reduce = useReducedMotion();
  const total = useMemo(() => plainLength(text), [text]);
  const instant = reduce || !speed || speed <= 0;
  const [n, setN] = useState(instant ? total : 0);
  const done = useRef(false);
  const doneCb = useRef(onDone);
  doneCb.current = onDone;

  useEffect(() => {
    done.current = false;
    if (instant) { setN(total); return; }
    setN(0);
  }, [text, instant, total]);

  useEffect(() => {
    if (!start) return;
    if (n >= total) {
      if (!done.current) { done.current = true; doneCb.current?.(); }
      return;
    }
    const ch = graphemes(text.replace(/\*\*|__|~~|==|\*|\[\/?\w+(=[^\]]*)?\]/g, ''))[n] ?? '';
    const pause = /[.!?…\n]/.test(ch) ? speed * 8 : /[,，]/.test(ch) ? speed * 4 : speed;
    const t = setTimeout(() => setN((x) => x + 1), pause);
    return () => clearTimeout(t);
  }, [n, total, start, speed, text]);

  return (
    <span className={`${className ?? ''} ${caret && start && n < total ? 'caret' : ''}`}>
      <RichText text={text} visible={n} />
    </span>
  );
}
