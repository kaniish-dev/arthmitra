"use client";

import Link from "next/link";
import { useState } from "react";
import articles from "@/config/articles.json";
import { FEATURES } from "@/lib/constants";
import { Card, Chip, Disclaimer, EmptyState, Icon, PageHeader } from "@/components/ui";

export interface Article {
  id: string;
  title: string;
  tag: string;
  kind: "explainer" | "story";
  readTime: number;
  body: string;
}

export const ARTICLES = articles as Article[];

/** Finance First Class: a card feed of short explainers and motivating stories, filterable by topic. */
export function LearnScreen() {
  const tags = ["All", ...new Set(ARTICLES.map((a) => a.tag))];
  const [tag, setTag] = useState("All");
  const shown = ARTICLES.filter((a) => tag === "All" || a.tag === tag);
  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <PageHeader title={FEATURES.financeFirstClass.name} subtitle="Money lessons in 3 minutes — no jargon, no lectures." back="/more" />
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0" role="group" aria-label="Topic">
        {tags.map((t) => (
          <Chip key={t} selected={tag === t} onClick={() => setTag(t)} className="shrink-0">
            {t}
          </Chip>
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.map((a) => (
          <li key={a.id}>
            <Link href={`/learn/read?id=${a.id}`} className="flex h-full flex-col gap-2 rounded-3xl surface-card p-5 transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md">
              <span className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                <Icon name={a.kind === "story" ? "auto_stories" : "lightbulb"} className="text-[18px] text-tertiary" />
                {a.tag} · {a.readTime} min read
              </span>
              <span className="text-lg leading-snug font-semibold">{a.title}</span>
              <span className="line-clamp-2 text-sm text-on-surface-variant">{a.body.split("\n")[0]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ArticleScreen({ id }: { id: string | null }) {
  const a = ARTICLES.find((x) => x.id === id);
  if (!a)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={FEATURES.financeFirstClass.name} back="/learn" />
        <Card>
          <EmptyState icon="search_off" title="Article not found" />
        </Card>
      </div>
    );
  return <ArticleBody a={a} />;
}

function ArticleBody({ a }: { a: Article }) {
  const next = ARTICLES[(ARTICLES.indexOf(a) + 1) % ARTICLES.length]!;
  return (
    <article className="mx-auto flex max-w-2xl flex-col">
      <PageHeader title={a.title} subtitle={`${a.tag} · ${a.kind === "story" ? "Story" : "Explainer"} · ${a.readTime} min read`} back="/learn" />
      <Card>
        {a.body.split("\n\n").map((p, i) => (
          <p key={i} className="mb-4 leading-relaxed whitespace-pre-line last:mb-0">
            {p}
          </p>
        ))}
        <Disclaimer className="mt-6 border-t border-outline-variant/50 pt-4" />
      </Card>
      <Link href={`/learn/read?id=${next.id}`} className="mt-4 flex items-center gap-3 rounded-3xl border border-outline-variant p-4 hover:bg-on-surface/4">
        <span className="flex-1">
          <span className="block text-xs text-on-surface-variant">Up next</span>
          <span className="font-semibold">{next.title}</span>
        </span>
        <Icon name="arrow_forward" />
      </Link>
    </article>
  );
}
