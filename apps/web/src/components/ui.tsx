"use client";

import Link from "next/link";
import { formatRupeesPlain, tryToPaise } from "@arthmitra/engine";
import { DISCLAIMER } from "@arthmitra/schema";
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Material Symbols icon (decorative; pair with visible text or an aria-label on the control). */
export function Icon({ name, filled, className }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cx("material-symbols-rounded leading-none", filled && "filled", className)}>
      {name}
    </span>
  );
}

type Variant = "filled" | "tonal" | "outlined" | "text" | "danger";

const VARIANTS: Record<Variant, string> = {
  filled: "bg-primary text-on-primary hover:bg-primary/90 disabled:bg-on-surface/12 disabled:text-on-surface/40",
  tonal: "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 disabled:opacity-50",
  outlined: "border border-outline text-primary hover:bg-primary/8 disabled:opacity-50",
  text: "text-primary hover:bg-primary/8 disabled:opacity-50",
  danger: "bg-error text-white hover:bg-error/90 disabled:opacity-50",
};

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed";

export function Button({
  variant = "filled",
  icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string }) {
  return (
    <button type="button" className={cx(buttonBase, VARIANTS[variant], className)} {...props}>
      {icon && <Icon name={icon} className="text-[20px]" />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "filled",
  icon,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  icon?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(buttonBase, VARIANTS[variant], className)}>
      {icon && <Icon name={icon} className="text-[20px]" />}
      {children}
    </Link>
  );
}

export function Card({ className, children, as: As = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <As className={cx("rounded-3xl bg-surface-container-lowest p-5 ring-1 ring-outline-variant/40", className)}>{children}</As>;
}

/**
 * Segmented tabs that split a long page into a few views. Arrow keys move between tabs;
 * each panel should carry id `panel-<value>` and aria-labelledby `tab-<value>`.
 */
export function Tabs<T extends string>({
  label,
  value,
  onChange,
  tabs,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  tabs: Array<{ value: T; label: string; count?: number }>;
}) {
  const move = (from: number, step: number) => {
    const next = tabs[(from + step + tabs.length) % tabs.length]!;
    onChange(next.value);
    document.getElementById(`tab-${next.value}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="mb-6 flex gap-1 rounded-full bg-surface-container-high p-1">
      {tabs.map((t, i) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            id={`tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${t.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(i, 1);
              if (e.key === "ArrowLeft") move(i, -1);
            }}
            className={cx(
              "flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors",
              selected ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <span className="truncate">{t.label}</span>
            {t.count ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold text-on-primary">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Section heading in the payment-app style: bold title, optional "See all" style link on the right. */
export function SectionTitle({ children, href, linkLabel }: { children: ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-on-surface">{children}</h2>
      {href && (
        <Link href={href} className="text-sm font-semibold text-primary hover:underline">
          {linkLabel ?? "See all"}
        </Link>
      )}
    </div>
  );
}

// White initials on these all pass 4.5:1 contrast.
const AVATAR_COLORS = ["#0b57d0", "#b3261e", "#146c2e", "#6f42c1", "#00695c", "#9a4d00", "#c2185b", "#3c4043"];
const AVATAR_SIZES = {
  sm: "h-8 w-8 text-sm",
  md: "h-11 w-11 text-base",
  // 48px on phones narrower than 360px, so four still fit in a row.
  lg: "h-12 w-12 text-lg min-[360px]:h-14 min-[360px]:w-14 min-[360px]:text-xl",
  xl: "h-20 w-20 text-3xl",
};

/** Letter avatar with a stable colour per name, and an optional small icon badge (e.g. the category). */
export function Avatar({ name, size = "md", badge, badgeTone = "neutral" }: { name: string; size?: keyof typeof AVATAR_SIZES; badge?: string; badgeTone?: "neutral" | "warn" }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const initial = name.match(/[a-z0-9]/i)?.[0]?.toUpperCase() ?? "₹";
  return (
    <span aria-hidden className={cx("relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", AVATAR_SIZES[size])} style={{ background: AVATAR_COLORS[hash % AVATAR_COLORS.length] }}>
      {initial}
      {badge && (
        <span
          className={cx(
            "absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-surface-container-lowest",
            badgeTone === "warn" ? "bg-warning-container text-on-warning-container" : "bg-surface-container-high text-on-surface-variant",
          )}
        >
          <Icon name={badge} className="text-[13px]" />
        </span>
      )}
    </span>
  );
}

/** Round icon shortcut with a label under it, like the action grid on a payment app's home. */
export function ActionTile({ href, icon, label, count }: { href: string; icon: string; label: string; count?: number }) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-2 rounded-2xl px-1 py-2 text-center hover:bg-primary/5">
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/70 min-[360px]:h-14 min-[360px]:w-14 text-primary transition-colors group-hover:bg-primary-container">
        <Icon name={icon} className="text-[26px]" />
        {count ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-[11px] font-bold text-white">{count}</span>
        ) : null}
      </span>
      <span className="text-xs leading-tight font-medium text-on-surface">
        {label}
        {count ? <span className="sr-only">, {count} waiting</span> : null}
      </span>
    </Link>
  );
}

/** Tappable list row with a leading icon and a chevron ("Manage your money" style). */
export function ListRow({ href, icon, label, sub }: { href: string; icon: string; label: string; sub?: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-2xl px-2 py-3 hover:bg-on-surface/5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-on-surface">{label}</span>
        {sub && <span className="block text-xs text-on-surface-variant">{sub}</span>}
      </span>
      <Icon name="chevron_right" className="text-on-surface-variant" />
    </Link>
  );
}

export function CardTitle({ children, action, icon }: { children: ReactNode; action?: ReactNode; icon?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-3 text-base font-semibold text-on-surface">
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
            <Icon name={icon} className="text-[20px]" />
          </span>
        )}
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Round icon-only button for app bars; the label is for screen readers and the tooltip. */
export function IconButton({ icon, label, onClick, href, disabled }: { icon: string; label: string; onClick?: () => void; href?: string; disabled?: boolean }) {
  const className = "inline-flex rounded-full p-2 text-on-surface-variant hover:bg-on-surface/8 disabled:opacity-30 disabled:hover:bg-transparent";
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        <Icon name={icon} />
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={className}>
      <Icon name={icon} />
    </button>
  );
}

/** A titled group of ListRows, like a settings screen section. */
export function ListSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface-container-lowest p-2 ring-1 ring-outline-variant/40 sm:p-3">
      <h2 className="px-2 pt-2 pb-1 text-sm font-semibold text-on-surface-variant">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Page title. On phones it is a sticky app bar with a back arrow, like the inner pages of a
 * payment app; on wider screens the sidebar handles navigation, so it is a plain heading.
 * `tools` are icon buttons kept in the bar; `action` is a bigger button shown under the subtitle on phones.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  tools,
  back = "/dashboard",
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  tools?: ReactNode;
  back?: string;
}) {
  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 mb-1 flex items-center gap-1 bg-surface/95 px-2 py-2 backdrop-blur md:static md:mx-0 md:mb-2 md:gap-4 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Link href={back} aria-label="Back" className="rounded-full p-2 hover:bg-on-surface/8 md:hidden">
          <Icon name="arrow_back" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight text-on-surface md:text-3xl">{title}</h1>
        {tools}
        {action && <div className="hidden md:block">{action}</div>}
      </div>
      <div className="mb-6 flex flex-col gap-3">
        {subtitle && <p className="text-sm text-on-surface-variant">{subtitle}</p>}
        {action && <div className="md:hidden">{action}</div>}
      </div>
    </>
  );
}

export function Chip({
  selected,
  icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; icon?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
        selected
          ? "border-transparent bg-secondary-container text-on-secondary-container"
          : "border-outline-variant text-on-surface-variant hover:bg-on-surface/5",
        className,
      )}
      {...props}
    >
      {icon && <Icon name={selected ? "check" : icon} className="text-[18px]" />}
      {children}
    </button>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  good: "bg-success-container text-on-success-container",
  warn: "bg-warning-container text-on-warning-container",
  bad: "bg-error-container text-on-error-container",
  info: "bg-secondary-container text-on-secondary-container",
};

export function Badge({ tone = "neutral", icon, children }: { tone?: Tone; icon?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone])}>
      {icon && <Icon name={icon} className="text-[14px]" />}
      {children}
    </span>
  );
}

export const fieldClass =
  "w-full rounded-xl border border-outline bg-surface-container-lowest px-3.5 py-2.5 text-base text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none";

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-on-surface">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}

export function TextInput({ label, hint, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input id={id} className={cx(fieldClass, className)} {...props} />
    </Field>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/**
 * Rupee input that accepts Indian grouping (1,23,456) and reports paise.
 * Shows the grouped figure when not focused.
 */
export function AmountInput({
  label,
  valuePaise,
  onChange,
  hint,
  placeholder = "0",
  autoFocus,
}: {
  label: string;
  valuePaise: number | null;
  onChange: (paise: number | null) => void;
  hint?: ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(valuePaise ? formatRupeesPlain(valuePaise) : "");
  const [focused, setFocused] = useState(false);
  const shown = focused ? text : valuePaise ? formatRupeesPlain(valuePaise) : "";
  const invalid = text.trim() !== "" && tryToPaise(text) === null;
  return (
    <Field label={label} hint={invalid ? <span className="text-error">Enter an amount like 1,23,456</span> : hint} htmlFor={id}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-on-surface-variant">₹</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-invalid={invalid}
          className={cx(fieldClass, "pl-8 tabular-nums", invalid && "border-error")}
          value={shown}
          onFocus={() => {
            setFocused(true);
            setText(valuePaise ? formatRupeesPlain(valuePaise) : "");
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setText(e.target.value);
            const p = e.target.value.trim() === "" ? null : tryToPaise(e.target.value);
            if (e.target.value.trim() === "" || p !== null) onChange(p !== null ? Math.abs(p) : null);
          }}
        />
      </div>
    </Field>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-on-surface">
          {label}
        </label>
        {description && <p className="text-xs text-on-surface-variant">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-8 w-13 shrink-0 rounded-full border-2 transition-colors",
          checked ? "border-primary bg-primary" : "border-outline bg-surface-container-highest",
        )}
      >
        <span
          className={cx(
            "absolute top-1/2 block -translate-y-1/2 rounded-full transition-all",
            checked ? "left-[22px] h-6 w-6 bg-on-primary" : "left-1 h-4 w-4 bg-outline",
          )}
        />
      </button>
    </div>
  );
}

export function ProgressBar({ value, tone = "good", label }: { value: number; tone?: "good" | "warn" | "bad"; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color = tone === "good" ? "bg-primary" : tone === "warn" ? "bg-warning" : "bg-error";
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
      <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-on-surface-variant uppercase">{label}</p>
      <p className={cx("mt-1 text-2xl font-semibold tabular-nums", tone === "good" && "text-success", tone === "bad" && "text-error")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-on-surface-variant">{sub}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Icon name={icon} className="text-5xl text-primary" />
      <p className="text-base font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-on-surface-variant">{children}</div>}
    </div>
  );
}

export function Disclaimer({ text = DISCLAIMER }: { text?: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
      <Icon name="info" className="text-[16px]" />
      {text}
    </p>
  );
}

/** Accessible modal: Escape closes, focus moves into the dialog and returns afterwards. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // An effect event, so a new onClose on each render doesn't re-run the effect and steal focus mid-typing.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key !== "Tab" || !ref.current) return;
    // Keep Tab inside the dialog.
    const items = [...ref.current.querySelectorAll<HTMLElement>("input, select, textarea, button, [href]")].filter((el) => !el.hasAttribute("disabled"));
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, select, button, [href]")?.focus();
    const onKey = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface-container-lowest p-6 pt-3 shadow-xl sm:rounded-3xl sm:pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-outline-variant sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 hover:bg-on-surface/8">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-on-surface-variant" role="status">
      <Icon name="progress_activity" className="animate-spin text-3xl" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
