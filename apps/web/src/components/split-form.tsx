"use client";

import { formatDate, formatINR, splitEqually } from "@arthmitra/engine";
import type { Transaction } from "@arthmitra/schema";
import { useState } from "react";
import { createSplit } from "@/lib/actions";
import { merchantLabel } from "@/lib/format";
import { useToast } from "./providers";
import { Avatar, Button, IconButton, fieldClass } from "./ui";

const MAX_FRIENDS = 8;

/** Split a payment equally with friends. Records who owes what; never requests money. */
export function SplitForm({ txn, onDone, onCancel }: { txn: Transaction; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [friends, setFriends] = useState([{ key: 1, name: "" }]);
  const [nextKey, setNextKey] = useState(2);
  const total = -txn.amountPaise;
  const shares = splitEqually(total, friends.length + 1);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const split = createSplit(
          txn.id,
          friends.map((f) => f.name),
        );
        if (split) {
          toast({ message: `Split saved. Friends owe you ${formatINR(total - split.yourSharePaise)}.` });
          onDone();
        }
      }}
    >
      <div className="rounded-2xl bg-surface-container p-4 text-center">
        <p className="text-sm text-on-surface-variant">
          {merchantLabel(txn.merchantKey)} · {formatDate(txn.date)}
        </p>
        <p className="text-3xl font-semibold tabular-nums">{formatINR(total)}</p>
        <p className="text-sm text-on-surface-variant">
          Split equally between {friends.length + 1} people
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        <li className="flex items-center gap-3 text-sm">
          <Avatar name="You" size="sm" />
          <span className="flex-1 font-medium">You</span>
          <span className="w-24 text-right tabular-nums">{formatINR(shares[0]!)}</span>
          <span className="w-10" />
        </li>
        {friends.map((f, i) => (
          <li key={f.key} className="flex items-center gap-3">
            <Avatar name={f.name || `Friend ${i + 1}`} size="sm" />
            <input
              aria-label={`Friend ${i + 1} name`}
              placeholder={`Friend ${i + 1}`}
              maxLength={40}
              value={f.name}
              onChange={(e) => setFriends(friends.map((x) => (x.key === f.key ? { ...x, name: e.target.value } : x)))}
              className={`${fieldClass} min-w-0 flex-1 py-2`}
            />
            <span className="w-24 text-right text-sm tabular-nums">{formatINR(shares[i + 1]!)}</span>
            <span className="w-10">
              {friends.length > 1 && <IconButton icon="close" label={`Remove friend ${i + 1}`} onClick={() => setFriends(friends.filter((x) => x.key !== f.key))} />}
            </span>
          </li>
        ))}
      </ul>

      {friends.length < MAX_FRIENDS && (
        <Button
          variant="text"
          icon="person_add"
          className="self-start"
          onClick={() => {
            setFriends([...friends, { key: nextKey, name: "" }]);
            setNextKey(nextKey + 1);
          }}
        >
          Add a friend
        </Button>
      )}

      <p className="text-xs text-on-surface-variant">ArthMitra only keeps track. Friends pay you back in whatever UPI app you both use.</p>
      <div className="flex justify-end gap-2">
        <Button variant="text" onClick={onCancel}>
          Back
        </Button>
        <Button type="submit" icon="check">
          Save split
        </Button>
      </div>
    </form>
  );
}
