import Link from "next/link";

/* ─── Data ───────────────────────────────────────────────── */

const STATS = [
  {
    num: "73%",
    label: "des recherches B2B",
    desc: "commencent maintenant sur une IA générative",
  },
  {
    num: "1/3",
    label: "des marques",
    desc: "sont mal représentées ou absentes des réponses IA",
  },
  {
    num: "8x",
    label: "plus de visibilité",
    desc: "pour les marques optimisées pour les IA",
  },
];

const HOW_STEPS = [
  {
    n: "01",
    title: "On interroge les IA",
    desc: "Nous posons vos questions à ChatGPT, Claude et Perplexity en conditions réelles — comme le ferait un vrai utilisateur.",
  },
  {
    n: "02",
    title: "On analyse les réponses",
    desc: "Qui est cité ? À quel rang ? Avec quel ton ? On détecte aussi les erreurs factuelles sur votre marque.",
  },
  {
    n: "03",
    title: "On vous guide",
    desc: "Alertes en temps réel, recommandations concrètes et tableaux de bord pour améliorer votre visibilité IA.",
  },
];

const FEATURES = [
  {
    icon: "👁",
    title: "Visibilité IA",
    desc: "Mesurez la part de réponses où votre marque apparaît, par provider et par type de question.",
  },
  {
    icon: "📊",
    title: "Share of Voice",
    desc: "Comparez votre place face à vos concurrents dans les réponses qui comptent.",
  },
  {
    icon: "🗺",
    title: "Géolocalisation",
    desc: "Questions ancrées sur votre ville ou région pour un monitoring ultra-précis.",
  },
  {
    icon: "📄",
    title: "Rapports PDF",
    desc: "Exportez vos résultats en un clic pour les partager avec votre direction ou vos clients.",
  },
  {
    icon: "🔔",
    title: "Alertes email",
    desc: "Soyez notifié dès qu'un score change, qu'une erreur factuelle apparaît ou qu'un concurrent progresse.",
  },
  {
    icon: "🤖",
    title: "Multi-IA",
    desc: "Couverture complète : ChatGPT, Claude ET Perplexity — toutes les IA que vos clients utilisent.",
  },
];

const PLANS = [
  {
    name: "Gratuit",
    price: "0",
    period: "/mois",
    highlight: false,
    badge: null,
    features: [
      "1 marque",
      "5 questions de monitoring",
      "Runs manuels",
      "2 IA (ChatGPT + Claude)",
      "Tableau de bord basique",
    ],
    cta: "Commencer gratuitement",
    href: "/signup",
  },
  {
    name: "Starter",
    price: "49",
    period: "/mois",
    highlight: true,
    badge: "Le plus populaire",
    features: [
      "2 marques",
      "15 questions de monitoring",
      "Runs hebdomadaires automatiques",
      "Alertes email",
      "3 IA (ChatGPT, Claude, Perplexity)",
      "Support prioritaire",
    ],
    cta: "Démarrer l'essai gratuit",
    href: "/signup",
  },
  {
    name: "Pro",
    price: "149",
    period: "/mois",
    highlight: false,
    badge: null,
    features: [
      "5 marques",
      "Questions illimitées",
      "Runs quotidiens automatiques",
      "Rapports PDF",
      "Accès API",
      "Support dédié",
    ],
    cta: "Contacter l'équipe",
    href: "/signup",
  },
];

/* ─── Page ───────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-bg">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-text">AI Reputation Shield</span>
          </div>

          {/* Providers pill — desktop */}
          <div className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-good" />
            ChatGPT · Claude · Perplexity
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted hover:text-text transition-colors">
              Se connecter
            </Link>
            <Link href="/signup" className="btn-primary text-sm">
              Essai gratuit
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-20 pt-24 text-center">
        {/* Badge */}
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-good animate-pulse" />
          Monitoring en temps réel · ChatGPT + Claude + Perplexity
        </div>

        {/* Titre */}
        <h1 className="num text-5xl leading-[1.1] text-text md:text-6xl">
          Votre marque n&apos;est plus<br />
          cherchée.{" "}
          <span style={{ color: "var(--accent)" }}>
            Elle est résumée.
          </span>
        </h1>

        {/* Sous-titre */}
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
          Quand vos clients posent une question à une IA, qui citent-elles ?
          Vous, ou vos concurrents ? Mesurez votre visibilité IA, détectez les
          erreurs factuelles et reprenez le contrôle avant qu&apos;il ne soit trop tard.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/signup" className="btn-primary px-6 py-2.5 text-sm">
            Essai gratuit — sans carte bancaire
          </Link>
          <Link href="#how" className="btn-ghost px-6 py-2.5 text-sm">
            Voir la démo
          </Link>
        </div>
      </section>

      {/* ── Chiffres d'impact ────────────────────────────────── */}
      <section className="border-y border-border bg-card py-16">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.num} className="flex flex-col items-center text-center">
              <span className="num text-5xl text-text">{s.num}</span>
              <span className="mt-2 text-sm font-semibold text-text">{s.label}</span>
              <span className="mt-1 text-sm text-muted">{s.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comment ça marche ────────────────────────────────── */}
      <section id="how" className="mx-auto w-full max-w-5xl px-6 py-24">
        <div className="mb-12 text-center">
          <p className="label mb-2">Comment ça marche</p>
          <h2 className="num text-4xl text-text">Simple, automatique, actionnable.</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {HOW_STEPS.map((s) => (
            <div key={s.n} className="card relative overflow-hidden">
              {/* Numéro décoratif */}
              <span
                className="num absolute -right-2 -top-4 select-none text-7xl font-bold opacity-5"
                aria-hidden
              >
                {s.n}
              </span>
              <div
                className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                {s.n}
              </div>
              <p className="font-semibold text-text">{s.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="border-t border-border bg-card py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <p className="label mb-2">Fonctionnalités</p>
            <h2 className="num text-4xl text-text">Tout ce dont vous avez besoin.</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-bg p-5 transition-shadow hover:shadow-sm">
                <div className="mb-3 text-2xl">{f.icon}</div>
                <p className="font-semibold text-text">{f.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto w-full max-w-5xl px-6 py-24">
        <div className="mb-12 text-center">
          <p className="label mb-2">Tarifs</p>
          <h2 className="num text-4xl text-text">Commencez gratuitement.</h2>
          <p className="mt-3 text-sm text-muted">
            Sans engagement, sans carte bancaire pour le plan gratuit.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="relative flex flex-col rounded-2xl border p-6"
              style={{
                borderColor: plan.highlight ? "var(--accent)" : "var(--border)",
                background: plan.highlight ? "color-mix(in srgb, var(--accent) 6%, var(--card))" : "var(--card)",
              }}
            >
              {/* Badge populaire */}
              {plan.badge && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold"
                  style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                >
                  {plan.badge}
                </div>
              )}

              <p className="text-sm font-semibold text-text">{plan.name}</p>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="num text-4xl text-text">{plan.price}€</span>
                <span className="text-sm text-muted">{plan.period}</span>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-muted">
                    <svg
                      className="mt-0.5 shrink-0"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--good)"
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feat}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-8 w-full text-center ${plan.highlight ? "btn-primary" : "btn-ghost"}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────── */}
      <section className="border-t border-border bg-card py-20">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="num text-4xl text-text">
            Votre marque est-elle bien représentée par les IA ?
          </h2>
          <p className="mt-4 text-sm text-muted">
            Répondez à la question en moins de 2 minutes — gratuitement, sans carte bancaire.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup" className="btn-primary px-8 py-3 text-sm">
              Analyser ma marque maintenant
            </Link>
            <Link href="/login" className="btn-ghost px-8 py-3 text-sm">
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border bg-bg">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {/* Row principale */}
          <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-accent">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fg)" strokeWidth="2.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-medium text-text">AI Reputation Shield</span>
            </div>

            <nav className="flex flex-wrap justify-center gap-5">
              <Link href="/signup" className="hover:text-text transition-colors">Créer un compte</Link>
              <Link href="/login" className="hover:text-text transition-colors">Se connecter</Link>
              <Link href="#pricing" className="hover:text-text transition-colors">Tarifs</Link>
              <Link href="#how" className="hover:text-text transition-colors">Comment ça marche</Link>
            </nav>

            <p>&copy; {new Date().getFullYear()} AI Reputation Shield.</p>
          </div>

          {/* Row légale */}
          <div className="mt-4 flex flex-wrap justify-center gap-4 border-t border-border pt-4 text-[11px] text-muted">
            <Link href="/legal/mentions-legales" className="hover:text-text transition-colors">Mentions légales</Link>
            <Link href="/legal/cgu" className="hover:text-text transition-colors">CGU / CGV</Link>
            <Link href="/legal/confidentialite" className="hover:text-text transition-colors">Politique de confidentialité</Link>
            <Link href="/legal/cookies" className="hover:text-text transition-colors">Cookies</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
