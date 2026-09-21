"use client";

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { memo, useId, useMemo, useState } from "react";
import type { Product } from "@/lib/api/types";
import { EASE_OUT, fast } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ProductRowContent, type RowActions, type RowPermissions } from "./product-row";

const ROW = "relative rounded-[var(--radius-brand-lg)] border border-line bg-surface p-3 transition-colors";

interface ListProps {
  products: Product[];
  label: string;
  /** show "#n" showroom positions (branch order) */
  showPositions: boolean;
  permissions: RowPermissions;
  actions: RowActions;
}

const positionOf = (product: Product, index: number) => (product.position ?? index) + 1;

/** Where the row at `index` ends up if the active row is dropped at `overIndex` (live "#n" while dragging). */
function projectedIndex(index: number, activeIndex: number, overIndex: number): number {
  if (activeIndex < 0 || overIndex < 0) return index;
  if (index === activeIndex) return overIndex;
  if (activeIndex < overIndex && index > activeIndex && index <= overIndex) return index - 1;
  if (overIndex < activeIndex && index >= overIndex && index < activeIndex) return index + 1;
  return index;
}

/** The product list. With `onReorder`, rows get drag handles (pointer, touch and keyboard). */
export function ProductList({ onReorder, ...props }: ListProps & { onReorder?: (next: Product[], movedId: string) => void }) {
  if (onReorder) return <SortableProductList {...props} onReorder={onReorder} />;
  const { products, label, showPositions, permissions, actions } = props;
  return (
    <ol aria-label={label} className="grid grid-cols-1 gap-2">
      {products.map((p, i) => (
        <li key={p.id} className={ROW}>
          <ProductRowContent
            product={p}
            position={showPositions ? positionOf(p, i) : undefined}
            permissions={permissions}
            actions={actions}
          />
        </li>
      ))}
    </ol>
  );
}

function SortableProductList({
  products,
  label,
  showPositions,
  permissions,
  actions,
  onReorder,
}: ListProps & { onReorder: (next: Product[], movedId: string) => void }) {
  const t = useTranslations("Products");
  const dndId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState(-1);
  const [flash, setFlash] = useState<{ id: string; key: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => products.map((p) => p.id), [products]);
  const total = ids.length;
  const nameOf = (id: UniqueIdentifier) => products.find((p) => p.id === id)?.name ?? "";
  const indexOf = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => t("dnd.pickedUp", { name: nameOf(active.id), position: indexOf(active.id), total }),
    onDragOver: ({ active, over }) =>
      over
        ? t("dnd.movedTo", { name: nameOf(active.id), position: indexOf(over.id), total })
        : t("dnd.notOver", { name: nameOf(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? t("dnd.dropped", { name: nameOf(active.id), position: indexOf(over.id), total })
        : t("dnd.cancelled", { name: nameOf(active.id), position: indexOf(active.id), total }),
    onDragCancel: ({ active }) => t("dnd.cancelled", { name: nameOf(active.id), position: indexOf(active.id), total }),
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setOverIndex(ids.indexOf(String(active.id)));
  };
  const onDragOver = ({ over }: DragOverEvent) => setOverIndex(over ? ids.indexOf(String(over.id)) : -1);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(products, from, to), String(active.id));
    setFlash((f) => ({ id: String(active.id), key: (f?.key ?? 0) + 1 }));
  };

  const activeIndex = activeId ? ids.indexOf(activeId) : -1;
  const active = activeIndex >= 0 ? products[activeIndex] : null;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t("dnd.instructions") } }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol aria-label={label} className="grid grid-cols-1 gap-2">
          {products.map((p) => (
            <SortableRow
              key={p.id}
              product={p}
              showPosition={showPositions}
              permissions={permissions}
              actions={actions}
              flashKey={flash?.id === p.id ? flash.key : undefined}
            />
          ))}
        </ol>
      </SortableContext>
      <DragOverlay>
        {active ? (
          // a picture of the row being dragged: same layout, not interactive
          <motion.div
            inert
            className={cn(ROW, "cursor-grabbing border-accent shadow-lg")}
            initial={{ scale: 1 }}
            animate={{ scale: 1.02 }}
            transition={fast}
          >
            <ProductRowContent
              product={active}
              position={showPositions ? (overIndex >= 0 ? overIndex : activeIndex) + 1 : undefined}
              handle={<DragHandleIcon />}
              permissions={permissions}
              actions={actions}
            />
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DragHandleIcon() {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-brand)] text-accent-ink">
      <GripVertical className="size-5" strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}

const SortableRow = memo(function SortableRow({
  product,
  showPosition,
  permissions,
  actions,
  flashKey,
}: {
  product: Product;
  showPosition: boolean;
  permissions: RowPermissions;
  actions: RowActions;
  flashKey?: number;
}) {
  const t = useTranslations("Products");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, index, activeIndex, overIndex } =
    useSortable({
      id: product.id,
      attributes: { roleDescription: t("dnd.roleDescription") },
    });
  const position = showPosition ? projectedIndex(index, activeIndex, overIndex) + 1 : undefined;
  const handleLabel = t("dragHandle", { name: product.name });
  // stable element so the memoised row content doesn't re-render on every drag frame
  const handle = useMemo(
    () => (
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={handleLabel}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-[var(--radius-brand)] text-muted outline-none hover:bg-sand hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink active:cursor-grabbing"
      >
        <GripVertical className="size-5" strokeWidth={1.8} aria-hidden="true" />
      </button>
    ),
    [attributes, listeners, setActivatorNodeRef, handleLabel],
  );
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-product-id={product.id}
      className={cn(ROW, isDragging && "z-10 border-dashed border-accent/60 opacity-40")}
    >
      {flashKey !== undefined && (
        <motion.span
          key={flashKey}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] border border-accent bg-accent/10"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: EASE_OUT }}
        />
      )}
      <ProductRowContent product={product} position={position} handle={handle} permissions={permissions} actions={actions} />
    </li>
  );
});
