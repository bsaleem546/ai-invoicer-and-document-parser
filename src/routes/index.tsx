import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileText, Zap, Layers, Shield, Check, Sun, Moon,
  ArrowRight, Upload, ScanLine, Download,
} from "lucide-react";
import { useAppTheme } from "@/lib/theme-context";

export const Route = createFileRoute("/")(({
  head: () => ({
    meta: [
      { title: "DocFlow — AI invoice & document parser for small businesses" },
      { name: "description", content: "Upload PDFs and images. Get structured invoice data in seconds. No templates, no training. Export to CSV, Excel, QuickBooks, Xero." },
      { property: "og:title", content: "DocFlow — AI invoice parser" },
      { property: "og:description", content: "Template-free invoice and receipt extraction with line-item accuracy." },
    ],
  }),
  component: Landing,
} as any));

const FEATURES = [
  {
    icon: Zap,
    title: "Template-free extraction",
    body: "No vendor-specific setup. Upload invoices from any supplier, in any format, and get structured fields back in seconds.",
  },
  {
    icon: Layers,
    title: "Full line-item detail",
    body: "Every row parsed: quantities, unit prices, descriptions, and totals — not just summary headers.",
  },
  {
    icon: FileText,
    title: "One-click accounting sync",
    body: "Push directly to QuickBooks or Xero. Or download CSV, JSON, or Excel whenever you need it.",
  },
  {
    icon: Shield,
    title: "Duplicate detection",
    body: "Catch duplicate invoices before they hit your books. Flags matched documents automatically.",
  },
];

const STEPS = [
  {
    num: "01",
    icon: Upload,
    title: "Upload the document",
    body: "Drag-and-drop a PDF, photo, or scan. Any format, any vendor, any language.",
  },
  {
    num: "02",
    icon: ScanLine,
    title: "AI reads every field",
    body: "Vendor, invoice number, date, line items, totals, taxes — extracted with per-field confidence scores.",
  },
  {
    num: "03",
    icon: Download,
    title: "Export or sync",
    body: "Push to QuickBooks, Xero, or export as CSV, JSON, or Excel in one click.",
  },
];

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    cta: "Start free",
    featured: false,
    features: [
      "30 documents / month",
      "Full line-item extraction",
      "CSV & JSON export",
      "Confidence indicators",
    ],
  },
  {
    name: "Pro",
    price: "$59",
    period: "/ month",
    cta: "Start Pro trial",
    featured: true,
    features: [
      "500 documents / month",
      "Duplicate detection",
      "QuickBooks & Xero sync",
      "Zapier webhook",
      "Email support",
    ],
  },
  {
    name: "Team",
    price: "$99",
    period: "/ month",
    cta: "Talk to sales",
    featured: false,
    features: [
      "2,000 documents / month",
      "5 user seats",
      "Spend analytics",
      "REST API access",
      "Priority support",
    ],
  },
];

function Landing() {
  const { theme, toggle } = useAppTheme();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── NAV ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/75 backdrop-blur-xl">
        <div className="flex h-14 w-full items-center px-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-primary">
              <FileText className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-display text-base font-bold tracking-tight">DocFlow</span>
          </Link>

          {/* Links */}
          <nav className="ml-8 hidden items-center gap-0.5 md:flex">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How it works</a>
            <a href="#pricing" className="nav-link">Pricing</a>
          </nav>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1.5">
            <button id="theme-toggle-landing" onClick={toggle} aria-label="Toggle theme" className="theme-toggle">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/auth" className="nav-link hidden sm:block">Sign in</Link>
            <Link to="/auth" className="btn-primary px-4 py-1.5 text-sm">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative border-b border-border hero-glow bg-dot-grid">
        {/* Bottom fade */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/0 via-background/5 to-background" />

        <div className="relative z-10 flex flex-col items-center px-6 pt-20 pb-10 text-center md:pt-28">

          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3.5 py-1.5 text-xs backdrop-blur-sm">
            <span className="status-dot processing" />
            <span className="font-mono uppercase tracking-widest text-muted-foreground">
              Public beta — free to try
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-[4.5rem] lg:text-[5.5rem]">
            Invoices in.
            <br />
            <span className="text-gradient">Clean data out.</span>
          </h1>

          {/* Subheading */}
          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-muted-foreground md:text-[1.0625rem]">
            Drop a PDF or photo. DocFlow pulls vendor, totals, and every line item in seconds —
            no templates, no training, no vendor-specific setup.
          </p>

          {/* CTAs */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth" className="btn-primary">
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="btn-outline">
              See how it works
            </a>
          </div>

          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            No credit card · 30 documents / month free
          </p>
        </div>

        {/* Stats strip */}
        <div className="relative z-10 flex flex-wrap items-center justify-center px-6 pb-10">
          {[
            { value: "50k+",  label: "Documents parsed" },
            { value: "$12M+", label: "In invoices processed" },
            { value: "99.2%", label: "Field accuracy" },
            { value: "<3s",   label: "Avg. extraction" },
          ].map(({ value, label }, i, arr) => (
            <div key={label} className="flex items-stretch">
              <div className="px-8 py-3 text-center">
                <div className="font-display text-2xl font-bold">{value}</div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
              </div>
              {i < arr.length - 1 && (
                <div className="my-auto h-8 w-px bg-border" />
              )}
            </div>
          ))}
        </div>

        {/* Product preview */}
        <div className="relative z-10 w-full px-6 pb-24">
          <div className="mx-auto max-w-5xl">
            <DocumentPreview />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="border-b border-border">
        <div className="w-full px-6 py-24">
          <div className="mb-16 text-center">
            <span className="eyebrow">Process</span>
            <h2 className="font-display text-4xl font-bold">
              From upload to export<br />in under a minute.
            </h2>
          </div>
          <div className="mx-auto grid max-w-4xl gap-12 md:grid-cols-3">
            {STEPS.map(({ num, icon: Icon, title, body }) => (
              <div key={num}>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary border border-primary/15">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{num}</div>
                <h3 className="font-display text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="border-b border-border">
        <div className="w-full px-6 py-24">
          <div className="mb-14">
            <span className="eyebrow">Features</span>
            <h2 className="font-display text-4xl font-bold leading-tight max-w-sm">
              Built for accuracy.<br />
              Not templates.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Every feature exists to solve a real problem — not to pad a feature list.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="feature-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mt-5 font-display text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="border-b border-border">
        <div className="w-full px-6 py-24">
          <div className="mb-16 text-center">
            <span className="eyebrow">Pricing</span>
            <h2 className="font-display text-4xl font-bold">Simple, usage-based pricing</h2>
            <p className="mt-3 text-muted-foreground">
              Start free. Upgrade only when you need more volume.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-3 md:items-start">
            {TIERS.map((tier) => (
              <PriceCard key={tier.name} {...tier} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="border-b border-border relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 hero-glow" />
        <div className="relative z-10 flex flex-col items-center px-6 py-24 text-center">
          <h2 className="font-display text-4xl font-bold md:text-5xl">
            Stop fighting invoice<br />templates.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">
            Join hundreds of accountants who process invoices in seconds, not hours.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth" className="btn-primary">
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="flex w-full flex-col items-center justify-between gap-5 px-6 py-8 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-primary">
              <FileText className="h-2.5 w-2.5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">DocFlow</span>
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Document preview widget ── */
function DocumentPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[0_32px_80px_oklch(0_0_0/40%)] md:shadow-[0_32px_80px_oklch(0_0_0/35%)]">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-elevated px-4 py-3">
        <div className="chrome-dot-red" />
        <div className="chrome-dot-amber" />
        <div className="chrome-dot-green" />
        <div className="mx-auto flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          acme-invoice-2024-1042.pdf
        </div>
        <span className="rounded-md bg-success/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-success border border-success/15">
          ✓ extracted
        </span>
      </div>

      <div className="grid md:grid-cols-5">
        {/* Left: document illustration */}
        <div className="flex items-center justify-center border-b border-border bg-background p-10 md:col-span-2 md:border-b-0 md:border-r min-h-[220px]">
          <div className="w-28 space-y-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="h-5 w-16 rounded-sm bg-border" />
              <div className="h-5 w-5 rounded-sm bg-primary/25" />
            </div>
            {[1, 0.75, 1, 0.6, 1, 0.8].map((w, i) => (
              <div key={i} className="h-1.5 rounded-full bg-border" style={{ width: `${w * 100}%` }} />
            ))}
            <div className="my-3 h-px bg-border-strong" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-border" />
                <div className="h-1.5 w-4 rounded-full bg-border" />
                <div className="h-1.5 w-6 rounded-full bg-border" />
                <div className="h-1.5 w-6 rounded-full bg-border" />
              </div>
            ))}
            <div className="pt-3 flex justify-end">
              <div className="h-1.5 w-12 rounded-full bg-primary/40" />
            </div>
          </div>
        </div>

        {/* Right: extracted data */}
        <div className="md:col-span-3 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <Field label="Vendor" value="Acme Supplies Ltd" />
            <Field label="Invoice #" value="INV-1042" mono />
            <Field label="Date" value="2024-11-14" mono />
            <Field label="Total" value="$1,284.50" mono accent />
          </div>
          <div className="h-px bg-border" />
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Steel widget, 12mm</td>
                <td className="text-right font-mono text-muted-foreground">24</td>
                <td className="text-right font-mono text-muted-foreground">$32.00</td>
                <td className="text-right font-mono font-medium">$768.00</td>
              </tr>
              <tr>
                <td>Mounting bracket</td>
                <td className="text-right font-mono text-muted-foreground">12</td>
                <td className="text-right font-mono text-muted-foreground">$18.50</td>
                <td className="text-right font-mono font-medium">$222.00</td>
              </tr>
              <tr>
                <td>Shipping &amp; handling</td>
                <td className="text-right font-mono text-muted-foreground">1</td>
                <td className="text-right font-mono text-muted-foreground">$45.00</td>
                <td className="text-right font-mono font-medium">$45.00</td>
              </tr>
            </tbody>
          </table>
          {/* Confidence bar */}
          <div className="flex items-center justify-between rounded-lg bg-success/5 border border-success/12 px-3.5 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">AI Confidence</span>
            <div className="flex items-center gap-2.5">
              <div className="h-1 w-24 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-success" style={{ width: "97%" }} />
              </div>
              <span className="font-mono text-xs font-semibold text-success">97%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, mono, accent,
}: {
  label: string; value: string; mono?: boolean; accent?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      <div className={`text-sm font-medium ${mono ? "font-mono" : ""} ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function PriceCard({
  name, price, period, features, cta, featured,
}: {
  name: string; price: string; period: string; features: string[];
  cta: string; featured?: boolean;
}) {
  return (
    <div className={`relative flex flex-col rounded-xl p-6 ${featured ? "pro-card" : "bg-surface border border-border"}`}>
      {featured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="rounded-full bg-primary px-3 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
            Most popular
          </span>
        </div>
      )}

      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{name}</div>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold">{price}</span>
        <span className="text-sm text-muted-foreground">{period}</span>
      </div>

      <ul className="mt-7 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-sm">
            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>

      <Link
        to="/auth"
        className={`mt-8 block rounded-md px-4 py-2.5 text-center text-sm font-medium transition-all ${
          featured
            ? "bg-primary text-primary-foreground hover:opacity-88"
            : "border border-border hover:bg-surface-elevated hover:border-border-strong"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
