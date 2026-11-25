import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState, type ReactNode } from "react";
import { positionInOrder } from "@/features/para/ordering";
import { cn } from "@/lib/utils";

export interface KanbanColumn {
  id: string;
  title: string;
  accent?: string;
}

interface KanbanBoardProps<T> {
  columns: KanbanColumn[];
  items: T[];
  getId: (item: T) => string;
  getColumn: (item: T) => string;
  getPosition: (item: T) => number;
  getLabel: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove: (item: T, columnId: string, position: number) => void;
  renderColumnFooter?: (columnId: string) => ReactNode;
}

type Layout = Record<string, string[]>;

function SortableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-manipulation rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function Column({ column, count, children, footer }: { column: KanbanColumn; count: number; children: ReactNode; footer?: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${column.id}` });
  return (
    <section aria-label={column.title} className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/50 sm:w-auto sm:min-w-0 sm:flex-1">
      <header className="flex items-center gap-2 px-3 pt-3 pb-2 text-sm font-medium">
        <span className={cn("size-2 rounded-full bg-muted-foreground/40", column.accent)} aria-hidden />
        {column.title}
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </header>
      <div ref={setNodeRef} className={cn("flex min-h-24 flex-1 flex-col gap-2 rounded-b-xl px-2 pb-2 transition-colors", isOver && "bg-brand-soft/40")}>
        {children}
        {footer}
      </div>
    </section>
  );
}

/**
 * Generic, accessible kanban board (pointer, touch and keyboard).
 * Keyboard: focus a card, Space to pick up, arrows to move, Space to drop, Esc to cancel.
 */
export function KanbanBoard<T>(props: KanbanBoardProps<T>) {
  const { columns, items, getId, getColumn, getPosition, getLabel, renderCard, onMove, renderColumnFooter } = props;
  const byId = useMemo(() => new Map(items.map((i) => [getId(i), i])), [items, getId]);

  const baseLayout = useMemo<Layout>(() => {
    const layout: Layout = Object.fromEntries(columns.map((c) => [c.id, []]));
    [...items]
      .sort((a, b) => getPosition(a) - getPosition(b))
      .forEach((i) => layout[getColumn(i)]?.push(getId(i)));
    return layout;
  }, [columns, items, getColumn, getId, getPosition]);

  const [dragLayout, setDragLayout] = useState<Layout | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const layout = dragLayout ?? baseLayout;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnOf = (id: string, l: Layout) =>
    id.startsWith("column:") ? id.slice(7) : Object.keys(l).find((col) => l[col]?.includes(id));

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDragLayout(baseLayout);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    setDragLayout((prev) => {
      const l = prev ?? baseLayout;
      const from = columnOf(String(active.id), l);
      const to = columnOf(String(over.id), l);
      if (!from || !to || from === to) return l;
      const target = [...(l[to] ?? [])];
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, String(active.id));
      return { ...l, [from]: (l[from] ?? []).filter((x) => x !== String(active.id)), [to]: target };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    const l = dragLayout ?? baseLayout;
    setActiveId(null);
    setDragLayout(null);
    const item = byId.get(id);
    const col = columnOf(id, l);
    if (!over || !item || !col) return;

    // Final order of the target column (cross-column moves were already applied in onDragOver).
    const ids = l[col] ?? [];
    const overId = String(over.id);
    const newIndex = overId.startsWith("column:") ? ids.length - 1 : ids.indexOf(overId);
    const order = newIndex >= 0 ? arrayMove(ids, ids.indexOf(id), newIndex) : ids;

    const position = positionInOrder(order, id, (x) => getPosition(byId.get(x) as T));
    const neighborsUnchanged = col === getColumn(item) && order.join() === (baseLayout[col] ?? []).join();
    if (!neighborsUnchanged) onMove(item, col, position);
  };

  const titleOf = (colId: string | undefined) => columns.find((c) => c.id === colId)?.title ?? "";
  const label = (id: string | number) => getLabel(byId.get(String(id)) as T);
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Pegou "${label(active.id)}".`,
    onDragOver: ({ active, over }) => (over ? `"${label(active.id)}" sobre ${titleOf(columnOf(String(over.id), layout))}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `"${label(active.id)}" solto em ${titleOf(columnOf(String(over.id), layout))}.` : `"${label(active.id)}" solto.`),
    onDragCancel: ({ active }) => `Movimento de "${label(active.id)}" cancelado.`,
  };

  const active = activeId ? byId.get(activeId) : undefined;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDragLayout(null);
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: "Pressione espaço para pegar. Use as setas para mover e espaço para soltar. Esc cancela." },
      }}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {columns.map((column) => {
          const ids = layout[column.id] ?? [];
          return (
            <Column key={column.id} column={column} count={ids.length} footer={renderColumnFooter?.(column.id)}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {ids.map((id) => {
                  const item = byId.get(id);
                  return item ? <SortableCard key={id} id={id}>{renderCard(item)}</SortableCard> : null;
                })}
              </SortableContext>
            </Column>
          );
        })}
      </div>
      <DragOverlay>{active ? <div className="rotate-1 shadow-xl">{renderCard(active)}</div> : null}</DragOverlay>
    </DndContext>
  );
}
