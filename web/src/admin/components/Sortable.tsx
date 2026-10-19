import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

export interface Keyed { _key: string }

/** Drag & drop reordering (mouse, touch and keyboard). Children get a drag handle to place. */
export function SortableList<T extends Keyed>({ items, onChange, render, grid }: {
  items: T[]; onChange: (items: T[]) => void; render: (item: T, index: number, handle: ReactNode) => ReactNode; grid?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const end = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i._key === e.active.id);
    const to = items.findIndex((i) => i._key === e.over!.id);
    if (from >= 0 && to >= 0) onChange(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
      <SortableContext items={items.map((i) => i._key)} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={grid ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' : 'space-y-2.5'}>
          {items.map((item, i) => <Item key={item._key} id={item._key}>{(handle) => render(item, i, handle)}</Item>)}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function Item({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button type="button" {...attributes} {...listeners} aria-label="ลากเพื่อเรียงลำดับ"
      className="cursor-grab touch-none rounded-lg px-1.5 py-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing">⋮⋮</button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 30 : undefined, opacity: isDragging ? 0.85 : 1 }}>
      {children(handle)}
    </div>
  );
}

let seq = 0;
export const withKeys = <T extends object>(arr: T[]): (T & Keyed)[] => arr.map((x: any) => ({ ...x, _key: x._key ?? x.id ?? `k${++seq}` }));
export const stripKeys = <T extends Keyed>(arr: T[]) => arr.map(({ _key, ...rest }) => rest);
export const newKey = () => `n${++seq}`;
