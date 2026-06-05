import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Zap, Layers, Shield, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DocFlow — AI invoice & document parser for small businesses" },
      { name: "description", content: "Upload PDFs and images. Get structured invoice data in seconds. No templates, no training. Export to CSV, Excel, QuickBooks, Xero." },
      { property: "og:title", content: "DocFlow — AI invoice parser" },
      { property: "og:description", content: "Template-free invoice and receipt extraction with line-item accuracy." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-sm bg-primary" />
            <span className="font-display text-lg font-bold">DocFlow</span>
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <a href="#features" className="hidden px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline">Features</a>
            <a href="#pricing" className="hidden px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground sm:inline">Pricing</a>
            <Link to="/auth" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link to="/auth" className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs">
              <span className="status-dot processing" />
              <span className="font-mono uppercase text-muted-foreground">Now in public beta</span>
            </div>
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              Invoices in. <span className="text-primary">Structured data out.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Drop a PDF or photo. DocFlow extracts vendor, totals, line items — every field — in seconds. No templates. No training. No vendor-specific setup.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                Start for free — no credit card
              </Link>
              <a href="#features" className="rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-surface">
                See how it works
              </a>
            </div>
            <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              30 documents / month on free tier
            </p>
          </div>

          {/* Mockup */}
          <div className="mx-auto mt-16 max-w-4xl rounded-lg border border-border-strong bg-surface p-1 shadow-2xl">
            <div className="rounded border border-border bg-background p-6">
              <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2 font-mono text-xs uppercase text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  acme-invoice-2024-1042.pdf
                </div>
                <span className="rounded-sm bg-success/10 px-2 py-0.5 font-mono text-xs uppercase text-success">extracted</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:grid-cols-4">
                <Field label="Vendor" value="Acme Supplies Ltd" />
                <Field label="Invoice #" value="1042" mono />
                <Field label="Date" value="2024-11-14" mono />
                <Field label="Total" value="$1,284.50" mono accent />
              </div>
              <table className="data-table mt-6">
                <thead>
                  <tr><th>Description</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Total</th></tr>
                </thead>
                <tbody>
                  <tr><td>Steel widget, 12mm</td><td className="text-right font-mono">24</td><td className="text-right font-mono">$32.00</td><td className="text-right font-mono">$768.00</td></tr>
                  <tr><td>Mounting bracket</td><td className="text-right font-mono">12</td><td className="text-right font-mono">$18.50</td><td className="text-right font-mono">$222.00</td></tr>
                  <tr><td>Shipping &amp; handling</td><td className="text-right font-mono">1</td><td className="text-right font-mono">$45.00</td><td className="text-right font-mono">$45.00</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <h2 className="font-display text-4xl font-bold">Built for accountants who hate templates.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
            <Feature icon={<Zap />} title="Template-free" body="No vendor setup. Upload any invoice format and get fields back instantly." />
            <Feature icon={<Layers />} title="Line-item accuracy" body="Every row extracted with quantities, unit prices, and totals — not just headers." />
            <Feature icon={<FileText />} title="Accounting sync" body="Push to QuickBooks, Xero, or export CSV / JSON / Excel in one click." />
            <Feature icon={<Shield />} title="Duplicate detection" body="Catch the same invoice billed twice before it hits your ledger." />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <div className="text-center">
            <h2 className="font-display text-4xl font-bold">Simple, document-based pricing.</h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade only when you need more volume.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <PriceCard
              name="Free" price="$0" period="forever" cta="Start free"
              features={["30 documents / month", "Line-item extraction", "CSV / JSON export", "Confidence indicators"]}
            />
            <PriceCard
              name="Pro" price="$59" period="/ month" featured cta="Start Pro trial"
              features={["500 documents / month", "Duplicate detection", "QuickBooks / Xero sync", "Zapier webhook", "Email support"]}
            />
            <PriceCard
              name="Team" price="$99" period="/ month" cta="Talk to sales"
              features={["2,000 documents / month", "5 user seats", "Spend analytics", "API access", "Priority support"]}
            />
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Trusted by independent accountants and finance teams
          </p>
          <div className="mt-8 grid grid-cols-2 gap-8 opacity-60 md:grid-cols-5">
            {["Northwind Co", "Globex Ltd", "Initech", "Hooli", "Wayne Ent."].map((n) => (
              <div key={n} className="text-center font-display text-lg font-bold tracking-tight">{n}</div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-sm bg-primary" />
            <span className="font-display font-bold text-foreground">DocFlow</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono" : ""} ${accent ? "text-primary font-semibold" : ""}`}>{value}</div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-background p-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent text-primary">{icon}</div>
      <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function PriceCard({ name, price, period, features, cta, featured }: {
  name: string; price: string; period: string; features: string[]; cta: string; featured?: boolean;
}) {
  return (
    <div className={`flex flex-col rounded-lg border p-6 ${featured ? "border-primary bg-accent" : "border-border bg-surface"}`}>
      <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{name}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold">{price}</span>
        <span className="text-sm text-muted-foreground">{period}</span>
      </div>
      <ul className="mt-6 space-y-3 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
          </li>
        ))}
      </ul>
      <Link
        to="/auth"
        className={`mt-8 rounded-md px-4 py-2 text-center text-sm font-medium ${featured ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-border hover:bg-surface-elevated"}`}
      >
        {cta}
      </Link>
    </div>
  );
}
