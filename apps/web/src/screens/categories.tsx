"use client";

import { categoryName, formatINR, monthKey, spendCategories, summariseMonth, todayIso } from "@arthmitra/engine";
import { useState } from "react";
import { addCategory, deleteMerchantRule, mergeCategory, renameCategory, setCategoryLimit } from "@/lib/actions";
import { useAppData } from "@/lib/store";
import { AmountInput, Button, Card, CardTitle, Icon, Modal, PageHeader, ProgressBar, Select, TextInput } from "@/components/ui";

/** Category manager (F11): add, rename, merge, monthly limits, learned merchant rules. */
export function CategoriesScreen() {
  const data = useAppData()!;
  const month = summariseMonth(data.transactions, monthKey(todayIso()));
  const cats = spendCategories(data.categories);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftLimit, setDraftLimit] = useState<number | null>(null);
  const [mergeInto, setMergeInto] = useState("");
  const editingCat = cats.find((c) => c.id === editing) ?? null;

  return (
    <>
      <PageHeader title="Categories" subtitle="Limits, names and sorting rules." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle icon="category">This month by category</CardTitle>
          <ul className="divide-y divide-outline-variant/50">
            {cats.map((c) => {
              const spent = month.byCategory[c.id] ?? 0;
              const limit = c.monthlyLimitPaise;
              return (
                <li key={c.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <Icon name={c.icon} className="text-primary" />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      {formatINR(spent)}
                      {limit !== null && <span className="text-on-surface-variant"> / {formatINR(limit)}</span>}
                    </span>
                    <Button
                      variant="text"
                      className="px-2 py-1"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => {
                        setEditing(c.id);
                        setDraftName(c.name);
                        setDraftLimit(limit);
                        setMergeInto("");
                      }}
                    >
                      <Icon name="edit" className="text-[20px]" />
                    </Button>
                  </div>
                  {limit !== null && (
                    <div className="mt-2 pl-9">
                      <ProgressBar value={spent / limit} tone={spent > limit ? "bad" : spent > limit * 0.8 ? "warn" : "good"} label={`${c.name} against limit`} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <form
            className="mt-4 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) {
                addCategory(newName);
                setNewName("");
              }
            }}
          >
            <div className="flex-1">
              <TextInput label="New category" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Kids activities" maxLength={40} />
            </div>
            <Button type="submit" icon="add" variant="tonal" disabled={!newName.trim()}>
              Add
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle icon="rule">Merchant rules</CardTitle>
          <p className="mb-3 text-sm text-on-surface-variant">Saved when you choose “Always use … for this merchant”. These run before keywords and AI.</p>
          {data.merchantRules.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No rules yet.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/50">
              {data.merchantRules.map((r) => (
                <li key={r.merchantKey} className="flex items-center gap-2 py-2 text-sm">
                  <span className="flex-1 capitalize">{r.merchantKey}</span>
                  <Icon name="arrow_forward" className="text-[16px] text-on-surface-variant" />
                  <span className="font-medium">{categoryName(data.categories, r.category)}</span>
                  <button type="button" aria-label={`Delete rule for ${r.merchantKey}`} onClick={() => deleteMerchantRule(r.merchantKey)} className="rounded-full p-1 hover:bg-on-surface/8">
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={editingCat !== null} onClose={() => setEditing(null)} title={`Edit ${editingCat?.name ?? ""}`}>
        {editingCat && (
          <div className="flex flex-col gap-4">
            <TextInput label="Name" value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={40} />
            <AmountInput label="Monthly limit (optional)" valuePaise={draftLimit} onChange={setDraftLimit} hint="Leave empty for no limit." />
            <Button
              icon="save"
              onClick={() => {
                if (draftName.trim()) renameCategory(editingCat.id, draftName);
                setCategoryLimit(editingCat.id, draftLimit && draftLimit > 0 ? draftLimit : null);
                setEditing(null);
              }}
            >
              Save
            </Button>
            <div className="mt-2 border-t border-outline-variant pt-4">
              <Select
                label={`Merge ${editingCat.name} into`}
                value={mergeInto}
                onChange={setMergeInto}
                options={[{ value: "", label: "Choose a category" }, ...cats.filter((c) => c.id !== editingCat.id).map((c) => ({ value: c.id, label: c.name }))]}
                hint="Moves its transactions, rules and estimate, then removes it."
              />
              <Button
                variant="outlined"
                icon="merge"
                className="mt-3"
                disabled={!mergeInto}
                onClick={() => {
                  mergeCategory(editingCat.id, mergeInto);
                  setEditing(null);
                }}
              >
                Merge
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
