"use client";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { formatINR } from "@arthmitra/engine";
import type { Category, Transaction } from "@arthmitra/schema";
import { useState } from "react";
import { setCategory } from "@/lib/actions";
import { useAppData } from "@/lib/store";
import { useToast } from "@/components/providers";
import { choicesFor } from "@/components/transactions";
import { Badge, Card, EmptyState, Icon, LinkButton, PageHeader, cx } from "@/components/ui";

const POINTS = 10;

/**
 * Gamified sorting (F9). Drag a bubble into a bucket — or, for touch and keyboard,
 * select a bubble then press a bucket. Each sorted item earns points toward the streak.
 */
export function SortGameScreen() {
  const data = useAppData()!;
  const toast = useToast();
  const items = data.transactions.filter((t) => t.status === "uncategorised");
  const [selected, setSelected] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  const [pop, setPop] = useState<{ key: number; bucket: string } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  const bucketMap = new Map<string, Category>();
  for (const t of items) for (const c of choicesFor(data, t)) bucketMap.set(c.id, c);
  if (bucketMap.size === 0) for (const c of data.categories.filter((c) => !c.system)) bucketMap.set(c.id, c);
  const buckets = [...bucketMap.values()].sort((a, b) => a.order - b.order);
  const half = Math.ceil(buckets.length / 2);

  const sort = (txnId: string, categoryId: string) => {
    const t = items.find((x) => x.id === txnId);
    if (!t) return;
    if (!choicesFor(data, t).some((c) => c.id === categoryId)) {
      toast({ message: t.amountPaise > 0 ? "Money coming in goes to Income, Refund or Own transfer." : "That bucket is for money coming in." });
      return;
    }
    setCategory(t.id, categoryId);
    setSession((s) => s + POINTS);
    setPop((p) => ({ key: (p?.key ?? 0) + 1, bucket: categoryId }));
    setSelected(null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (e.over) sort(String(e.active.id), String(e.over.id));
  };

  const profile = data.profile!;
  const stats = (
    <div className="flex flex-wrap gap-2">
      <Badge tone="good" icon="stars">
        {profile.points} points
      </Badge>
      <Badge tone="info" icon="local_fire_department">
        {profile.streak}-day streak
      </Badge>
      {session > 0 && <Badge tone="warn">+{session} this round</Badge>}
    </div>
  );

  const renderBuckets = (list: Category[]) => (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {list.map((c) => (
        <Bucket
          key={c.id}
          category={c}
          armed={selected !== null}
          popping={pop?.bucket === c.id ? pop.key : null}
          onPress={() => selected && sort(selected, c.id)}
        />
      ))}
    </div>
  );

  return (
    <>
      <PageHeader title="Sort game" subtitle="Drag each payment into its bucket." action={stats} />

      {items.length === 0 ? (
        <Card>
          <EmptyState icon="celebration" title={session > 0 ? `Inbox zero! +${session} points` : "Nothing to sort right now"}>
            {profile.badges.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {profile.badges.map((b) => (
                  <Badge key={b} tone="good" icon="military_tech">
                    {b}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-4">
              <LinkButton href="/dashboard" variant="tonal" icon="home">
                Back to dashboard
              </LinkButton>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <p id="sort-help" className="mb-4 text-sm text-on-surface-variant">
            No mouse? Tap or press Enter on a bubble to pick it up, then on a bucket to drop it.
          </p>
          <div className="flex flex-col gap-4">
            {renderBuckets(buckets.slice(0, half))}
            <div className="flex min-h-56 flex-wrap content-center items-center justify-center gap-4 rounded-[2rem] bg-surface-container p-6">
              {items.map((t, i) => (
                <Bubble key={t.id} t={t} index={i} selected={selected === t.id} onSelect={() => setSelected(selected === t.id ? null : t.id)} />
              ))}
            </div>
            {renderBuckets(buckets.slice(half))}
          </div>
        </DndContext>
      )}
    </>
  );
}

function Bubble({ t, index, selected, onSelect }: { t: Transaction; index: number; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : { animationDelay: `${(index % 5) * 0.4}s` };
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-describedby="sort-help"
      aria-pressed={selected}
      aria-label={`${t.merchantKey}, ${formatINR(t.amountPaise, { signed: true })}. ${selected ? "Selected, now choose a bucket." : "Pick up"}`}
      onClick={onSelect}
      style={style}
      className={cx(
        "flex h-28 w-28 touch-none flex-col items-center justify-center rounded-full p-2 text-center shadow-md transition-shadow select-none",
        isDragging ? "z-10 scale-105 cursor-grabbing shadow-xl" : "animate-float cursor-grab",
        selected ? "bg-primary text-on-primary ring-4 ring-primary/30" : "bg-surface-container-lowest text-on-surface",
      )}
    >
      <span className="line-clamp-2 text-xs font-semibold capitalize">{t.merchantKey}</span>
      <span className="mt-1 text-sm font-bold tabular-nums">{formatINR(Math.abs(t.amountPaise))}</span>
      {t.amountPaise > 0 && <span className="text-[10px] opacity-80">money in</span>}
    </button>
  );
}

function Bucket({ category, armed, popping, onPress }: { category: Category; armed: boolean; popping: number | null; onPress: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: category.id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onPress}
      aria-label={`Drop into ${category.name}`}
      className={cx(
        "relative flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-2 py-3 text-xs font-medium transition-colors",
        isOver ? "border-primary bg-primary-container" : armed ? "border-primary/60 bg-primary/5" : "border-outline-variant bg-surface-container-lowest",
      )}
    >
      <Icon name={category.icon} className="text-2xl text-primary" />
      {category.name}
      {popping !== null && (
        <span key={popping} className="absolute -top-2 right-1 animate-bounce rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">
          +{POINTS}
        </span>
      )}
    </button>
  );
}
