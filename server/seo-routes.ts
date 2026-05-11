import type { Express, Request, Response } from "express";
import { COMPETITORS, TUNINGS, type Competitor, type Tuning } from "./seo-data";

const BRAND = "GuitarTune";
const BRAND_COLOR = "#4AEDC4";
const BASE_URL = "https://guitartune.app";

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHead(title: string, description: string, canonical: string, schemaJson: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${htmlEscape(title)}</title>
<meta name="description" content="${htmlEscape(description)}">
<link rel="canonical" href="${htmlEscape(canonical)}">
<meta property="og:title" content="${htmlEscape(title)}">
<meta property="og:description" content="${htmlEscape(description)}">
<meta property="og:url" content="${htmlEscape(canonical)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">
${schemaJson}
</script>
${buildCss()}
</head>`;
}

function buildCss(): string {
  return `<style>
  *{margin:0;padding:0;box-sizing:border-box}
  :root{--cyan:#4AEDC4;--bg:#0A0A0A;--surface:#111;--border:#1a1a1a}
  body{background:var(--bg);color:#fff;font-family:Arial,sans-serif;line-height:1.6}
  a{color:var(--cyan);text-decoration:none}
  a:hover{text-decoration:underline}
  nav{display:flex;align-items:center;justify-content:space-between;padding:20px 40px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:100}
  .logo{font-size:20px;font-weight:900;color:var(--cyan);letter-spacing:2px;font-family:'Arial Black',Arial,sans-serif}
  .nav-links{display:flex;gap:24px;font-size:14px;color:#555}
  .nav-links a{color:#555}
  .nav-links a:hover{color:var(--cyan)}
  .nav-cta{background:var(--cyan);color:#0A0A0A;font-size:14px;font-weight:900;padding:9px 22px;border-radius:50px;text-decoration:none;text-transform:uppercase;letter-spacing:1px}
  .wrap{max-width:960px;margin:0 auto;padding:0 24px}
  h1{font-size:clamp(32px,5vw,56px);font-weight:900;font-family:'Arial Black',Arial,sans-serif;line-height:1.05;letter-spacing:-1px}
  h2{font-size:28px;font-weight:900;font-family:'Arial Black',Arial,sans-serif;margin:48px 0 16px}
  h2::before{content:'';display:block;width:32px;height:3px;background:var(--cyan);margin-bottom:12px}
  h3{font-size:18px;font-weight:700;margin:24px 0 10px;color:#ccc}
  p{color:#888;font-size:15px;line-height:1.75;margin-bottom:14px}
  .hero{padding:72px 0 56px;text-align:center}
  .hero h1 span{color:var(--cyan)}
  .hero .sub{font-size:18px;color:#777;max-width:600px;margin:20px auto 40px}
  .hero-cta{display:inline-block;background:var(--cyan);color:#0A0A0A;font-size:16px;font-weight:900;padding:16px 40px;border-radius:50px;text-transform:uppercase;letter-spacing:1px;margin-right:12px}
  .hero-sec{display:inline-block;color:#555;font-size:15px;font-weight:700;padding:16px 24px}
  .section{padding:60px 0}
  .section.alt{background:var(--surface)}
  .tag{display:inline-block;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--cyan);border:1px solid #1a3a2e;background:#0D1A17;padding:6px 16px;border-radius:4px;margin-bottom:24px}
  .compare-table{width:100%;border-collapse:collapse;margin:24px 0;font-size:14px}
  .compare-table th{background:var(--surface);padding:12px 16px;text-align:left;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:11px;color:#555;border-bottom:2px solid var(--border)}
  .compare-table th.us{color:var(--cyan);background:#0D1A17}
  .compare-table td{padding:12px 16px;border-bottom:1px solid var(--border);color:#888;vertical-align:middle}
  .compare-table td.us-val{background:#0D1A17;color:#fff}
  .good{color:var(--cyan)}
  .bad{color:#ff4444}
  .mid{color:#FFD700}
  .faq-list{display:flex;flex-direction:column;gap:0}
  .faq-item{border-bottom:1px solid var(--border);padding:24px 0}
  .faq-q{font-size:16px;font-weight:700;color:#fff;margin-bottom:10px}
  .faq-a{font-size:15px;color:#888;line-height:1.7}
  .pill-grid{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}
  .pill{background:var(--surface);border:1px solid var(--border);border-radius:50px;padding:10px 20px;font-size:14px;color:#888;font-weight:700}
  .pill.active{border-color:var(--cyan);color:var(--cyan)}
  .steps{display:flex;flex-direction:column;gap:0;margin:24px 0}
  .step{display:flex;gap:20px;padding:20px 0;border-bottom:1px solid var(--border)}
  .step-num{font-size:36px;font-weight:900;color:#1a1a1a;min-width:48px;font-family:'Arial Black',Arial,sans-serif}
  .step-body h4{font-size:16px;font-weight:700;margin-bottom:6px;color:#fff}
  .step-body p{margin:0;font-size:14px}
  .internal-links{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}
  .internal-links a{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 18px;font-size:13px;color:#888;font-weight:700;transition:border-color .2s}
  .internal-links a:hover{border-color:var(--cyan);color:var(--cyan);text-decoration:none}
  .cta-block{background:#0D1A17;border:1px solid #1a3a2e;border-radius:16px;padding:48px;text-align:center;margin:60px 0}
  .cta-block h2{margin:0 0 12px;font-size:32px}
  .cta-block h2::before{display:none}
  .cta-block p{max-width:500px;margin:0 auto 28px;color:#777}
  .breadcrumb{padding:16px 0;font-size:13px;color:#444}
  .breadcrumb a{color:#555}
  .breadcrumb span{margin:0 8px;color:#333}
  footer{padding:40px;border-top:1px solid var(--border);text-align:center;color:#333;font-size:13px}
  footer a{color:#444;margin:0 12px}
  .songs-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin:16px 0}
  .song-item{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:13px;color:#888}
  @media(max-width:600px){nav{padding:16px 20px}.wrap{padding:0 16px}h1{font-size:28px}.hero{padding:48px 0 36px}.cta-block{padding:32px 20px}}
</style>`;
}

function buildNav(activePath: string): string {
  return `<nav>
  <a href="/" class="logo">${BRAND}</a>
  <div class="nav-links">
    <a href="/compare">Compare</a>
    <a href="/tunings">Tunings</a>
  </div>
  <a href="/#download" class="nav-cta">Download Free</a>
</nav>`;
}

function buildFooter(relatedLinks: { href: string; label: string }[]): string {
  const links = relatedLinks.map(l => `<a href="${l.href}">${htmlEscape(l.label)}</a>`).join("");
  return `<footer>
  <div>${links}</div>
  <p style="margin-top:16px">© 2026 ${BRAND} · <a href="/">guitartune.app</a> · <a href="/compare">Compare</a> · <a href="/tunings">Tunings</a></p>
</footer>`;
}

function competitorPage(c: Competitor): string {
  const title = `GuitarTune vs ${c.name}: Side-by-Side Comparison (2026)`;
  const desc = `Compare GuitarTune vs ${c.name}. Ad-free, $9.99/year, 20+ instrument tunings. See feature matrix, pricing, and why guitarists are switching.`;
  const canonical = `${BASE_URL}/vs/${c.slug}`;

  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": BRAND,
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "iOS, Android",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free tier available. Pro from $9.99/year."
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "124"
    },
    "description": `GuitarTune is a free, ad-free guitar tuner app with 15 tunings, bilingual support, and Pro from $9.99/year.`
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": c.faqs.map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  };

  const combinedSchema = JSON.stringify([softwareAppSchema, faqSchema], null, 2);

  const relatedCompetitors = COMPETITORS.filter(x => x.slug !== c.slug).slice(0, 4);
  const relatedTunings = TUNINGS.slice(0, 4);

  const adsFreeStr = c.freeAds ? '<span class="bad">✗ Ads in free tier</span>' : '<span class="good">✓ Ad-free</span>';
  const bilingualStr = c.bilingual ? '<span class="good">✓</span>' : '<span class="bad">✗ English only</span>';

  return `${buildHead(title, desc, canonical, combinedSchema)}
<body>
${buildNav(`/vs/${c.slug}`)}
<div class="wrap">
  <div class="breadcrumb"><a href="/">Home</a><span>›</span><a href="/compare">Compare</a><span>›</span>vs ${htmlEscape(c.shortName)}</div>
  <section class="hero" style="text-align:left;padding-top:48px">
    <div class="tag">Head-to-Head Comparison</div>
    <h1>GuitarTune vs <span>${htmlEscape(c.name)}</span></h1>
    <p class="sub" style="margin-left:0;text-align:left">${desc}</p>
    <a href="/#download" class="hero-cta">Try GuitarTune Free</a>
    <a href="#comparison" class="hero-sec">See comparison ↓</a>
  </section>
</div>

<div class="section alt">
  <div class="wrap">
    <h2 id="comparison">Feature Comparison</h2>
    <table class="compare-table">
      <thead>
        <tr>
          <th>Feature</th>
          <th class="us">GuitarTune</th>
          <th>${htmlEscape(c.shortName)}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Ad-free experience</td>
          <td class="us-val"><span class="good">✓ Always ad-free</span></td>
          <td>${adsFreeStr}</td>
        </tr>
        <tr>
          <td>Annual Pro price</td>
          <td class="us-val"><span class="good">$9.99/year</span></td>
          <td><span class="${c.annualPrice.startsWith("$9") ? "mid" : "bad"}">${htmlEscape(c.annualPrice)}</span></td>
        </tr>
        <tr>
          <td>Lifetime purchase</td>
          <td class="us-val"><span class="good">✓ $14.99</span></td>
          <td>${c.slug === "boss-tuner" || c.slug === "pano-tuner" ? '<span class="mid">✓ (one-time)</span>' : '<span class="bad">✗ Not available</span>'}</td>
        </tr>
        <tr>
          <td>Guitar tunings</td>
          <td class="us-val"><span class="good">15 tunings (4 free)</span></td>
          <td>${htmlEscape(c.tuningCount)}</td>
        </tr>
        <tr>
          <td>Bilingual (EN/ES)</td>
          <td class="us-val"><span class="good">✓ Auto-detected</span></td>
          <td>${bilingualStr}</td>
        </tr>
        <tr>
          <td>Tuning history</td>
          <td class="us-val"><span class="good">✓ Pro feature</span></td>
          <td><span class="bad">✗ Not available</span></td>
        </tr>
        <tr>
          <td>Cents accuracy display</td>
          <td class="us-val"><span class="good">✓ Real-time</span></td>
          <td><span class="good">✓</span></td>
        </tr>
        <tr>
          <td>Crypto payment</td>
          <td class="us-val"><span class="good">✓ Solana/USDC</span></td>
          <td><span class="bad">✗</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<div class="section">
  <div class="wrap">
    <h2>About ${htmlEscape(c.name)}</h2>
    <p>${htmlEscape(c.description)}</p>
    <h3>Main user complaint with ${htmlEscape(c.shortName)}</h3>
    <p>${htmlEscape(c.mainComplaint)}</p>
    <h3>Why players switch to GuitarTune</h3>
    <p>${htmlEscape(c.gtAdvantage)}</p>
  </div>
</div>

<div class="section alt">
  <div class="wrap">
    <h2>Frequently Asked Questions</h2>
    <div class="faq-list">
      ${c.faqs.map(faq => `<div class="faq-item"><div class="faq-q">${htmlEscape(faq.q)}</div><div class="faq-a">${htmlEscape(faq.a)}</div></div>`).join("")}
    </div>
  </div>
</div>

<div class="section">
  <div class="wrap">
    <div class="cta-block">
      <h2>Try GuitarTune Free</h2>
      <p>No ads. No sign-up. Download and tune your first string in under 10 seconds.</p>
      <a href="/#download" class="hero-cta">Download Free</a>
    </div>

    <h2>Compare More Apps</h2>
    <div class="internal-links">
      ${relatedCompetitors.map(r => `<a href="/vs/${r.slug}">GuitarTune vs ${htmlEscape(r.shortName)}</a>`).join("")}
      <a href="/compare">All comparisons →</a>
    </div>

    <h2>Guitar Tuning Guides</h2>
    <div class="internal-links">
      ${relatedTunings.map(t => `<a href="/tunings/${t.slug}">How to tune to ${htmlEscape(t.name)}</a>`).join("")}
      <a href="/tunings">All tunings →</a>
    </div>
  </div>
</div>

${buildFooter([
    { href: "/compare", label: "All Comparisons" },
    { href: "/tunings", label: "All Tunings" },
    { href: "/", label: "Home" },
  ])}
</body>
</html>`;
}

function tuningPage(t: Tuning): string {
  const title = `How to Tune Guitar to ${t.name} (${t.shorthand}) — Step-by-Step Guide`;
  const desc = `Learn how to tune your guitar to ${t.name} (${t.shorthand}). Step-by-step guide with string notes, common songs, and a free guitar tuner app.`;
  const canonical = `${BASE_URL}/tunings/${t.slug}`;

  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": BRAND,
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "iOS, Android",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": `Use GuitarTune to automatically tune your guitar to ${t.name}. ${t.isPremium ? "Available in GuitarTune Pro." : "Free in GuitarTune."}`
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": t.faqs.map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  };

  const combinedSchema = JSON.stringify([softwareAppSchema, faqSchema], null, 2);

  const relatedTunings = TUNINGS.filter(x => x.slug !== t.slug).slice(0, 5);
  const relatedCompetitors = COMPETITORS.slice(0, 3);

  return `${buildHead(title, desc, canonical, combinedSchema)}
<body>
${buildNav(`/tunings/${t.slug}`)}
<div class="wrap">
  <div class="breadcrumb"><a href="/">Home</a><span>›</span><a href="/tunings">Tunings</a><span>›</span>${htmlEscape(t.name)}</div>

  <section class="hero" style="text-align:left;padding-top:48px">
    <div class="tag">${htmlEscape(t.genre)} · ${t.difficulty}</div>
    <h1>How to Tune to <span style="color:var(--cyan)">${htmlEscape(t.name)}</span></h1>
    <p class="sub" style="margin-left:0;text-align:left">Tuning: <strong style="color:#fff;font-family:'Arial Black',Arial,sans-serif;letter-spacing:2px">${htmlEscape(t.shorthand)}</strong> — from low to high: ${t.notes.join(" · ")}</p>
    <div class="pill-grid">
      ${t.strings.map((s, i) => `<div class="pill active">String ${6 - i}: ${htmlEscape(s)}</div>`).join("")}
    </div>
    <a href="/#download" class="hero-cta">${t.isPremium ? "Get GuitarTune Pro" : "Tune Free in GuitarTune"}</a>
    <a href="#how-to" class="hero-sec">Step-by-step guide ↓</a>
  </section>
</div>

<div class="section alt">
  <div class="wrap">
    <h2>About ${htmlEscape(t.name)}</h2>
    <p>${htmlEscape(t.description)}</p>
    ${t.isPremium
      ? `<p><strong style="color:var(--cyan)">${htmlEscape(t.name)}</strong> is available in <strong style="color:#fff">GuitarTune Pro</strong> ($9.99/year or $14.99 lifetime). The free tier includes Standard, Double Drop D, Open C, and All Fourths.</p>`
      : `<p><strong style="color:var(--cyan)">${htmlEscape(t.name)}</strong> is included in the <strong style="color:#fff">GuitarTune free tier</strong> — no payment required.</p>`
    }
  </div>
</div>

<div class="section">
  <div class="wrap">
    <h2 id="how-to">Step-by-Step: How to Tune to ${htmlEscape(t.name)}</h2>
    <div class="steps">
      ${t.howTo.map((step, i) => `
      <div class="step">
        <div class="step-num">0${i + 1}</div>
        <div class="step-body"><p>${htmlEscape(step)}</p></div>
      </div>`).join("")}
    </div>
  </div>
</div>

<div class="section alt">
  <div class="wrap">
    <h2>Songs in ${htmlEscape(t.name)}</h2>
    <p>These well-known songs use ${htmlEscape(t.name)} tuning:</p>
    <div class="songs-list">
      ${t.commonSongs.map(s => `<div class="song-item">🎵 ${htmlEscape(s)}</div>`).join("")}
    </div>
  </div>
</div>

<div class="section">
  <div class="wrap">
    <h2>Frequently Asked Questions</h2>
    <div class="faq-list">
      ${t.faqs.map(faq => `<div class="faq-item"><div class="faq-q">${htmlEscape(faq.q)}</div><div class="faq-a">${htmlEscape(faq.a)}</div></div>`).join("")}
    </div>
  </div>
</div>

<div class="section alt">
  <div class="wrap">
    <div class="cta-block" style="margin-top:0">
      <h2>Tune to ${htmlEscape(t.name)} with GuitarTune</h2>
      <p>${t.isPremium ? `Available in GuitarTune Pro — $9.99/year or $14.99 lifetime. Includes all 15 tunings, tuning history, and custom themes.` : `Free in GuitarTune — no payment required. Open the app, select ${htmlEscape(t.name)}, and follow the dial.`}</p>
      <a href="/#download" class="hero-cta">${t.isPremium ? "Get GuitarTune Pro" : "Download Free"}</a>
    </div>

    <h2>More Guitar Tunings</h2>
    <div class="internal-links">
      ${relatedTunings.map(r => `<a href="/tunings/${r.slug}">${htmlEscape(r.name)} (${htmlEscape(r.shorthand)})</a>`).join("")}
      <a href="/tunings">All tunings →</a>
    </div>

    <h2>Compare GuitarTune vs Other Apps</h2>
    <div class="internal-links">
      ${relatedCompetitors.map(c => `<a href="/vs/${c.slug}">GuitarTune vs ${htmlEscape(c.shortName)}</a>`).join("")}
      <a href="/compare">All comparisons →</a>
    </div>
  </div>
</div>

${buildFooter([
    { href: "/tunings", label: "All Tunings" },
    { href: "/compare", label: "Compare Apps" },
    { href: "/", label: "Home" },
  ])}
</body>
</html>`;
}

function hubPage(type: "compare" | "tunings"): string {
  if (type === "compare") {
    const title = "GuitarTune vs Guitar Tuner Apps — Full Comparison Guide (2026)";
    const desc = "Compare GuitarTune against GuitarTuna, Fender Tune, Boss Tuner, and more. Feature matrix, pricing, and honest reviews.";
    const canonical = `${BASE_URL}/compare`;

    const schema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "GuitarTune Competitor Comparisons",
      "itemListElement": COMPETITORS.map((c, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": `${BASE_URL}/vs/${c.slug}`,
        "name": `GuitarTune vs ${c.name}`
      }))
    }, null, 2);

    return `${buildHead(title, desc, canonical, schema)}
<body>
${buildNav("/compare")}
<div class="wrap">
  <section class="hero">
    <div class="tag">Comparison Hub</div>
    <h1>GuitarTune vs <span style="color:var(--cyan)">Every Major Guitar Tuner App</span></h1>
    <p class="sub">Head-to-head comparisons with pricing, features, and honest analysis. See why guitarists are switching.</p>
    <a href="/#download" class="hero-cta">Download GuitarTune Free</a>
  </section>

  <section class="section">
    <h2>All Comparisons</h2>
    <div class="internal-links" style="flex-direction:column;gap:0">
      ${COMPETITORS.map(c => `
      <a href="/vs/${c.slug}" style="border-radius:8px;margin-bottom:8px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between">
        <span>GuitarTune vs <strong>${htmlEscape(c.name)}</strong></span>
        <span style="color:#333;font-size:12px">App Store ${htmlEscape(c.appStoreRating)}★ · ${c.freeAds ? '<span class="bad">Ads in free</span>' : '<span class="good">No ads</span>'} · ${htmlEscape(c.annualPrice)}</span>
      </a>`).join("")}
    </div>
  </section>

  <section class="section alt" style="padding:60px 0;margin:0 -24px">
    <div class="wrap">
      <h2>Quick Price Comparison</h2>
      <table class="compare-table">
        <thead>
          <tr>
            <th>App</th>
            <th class="us">GuitarTune</th>
            ${COMPETITORS.slice(0, 4).map(c => `<th>${htmlEscape(c.shortName)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Annual Pro</td>
            <td class="us-val"><span class="good">$9.99</span></td>
            ${COMPETITORS.slice(0, 4).map(c => `<td>${htmlEscape(c.annualPrice)}</td>`).join("")}
          </tr>
          <tr>
            <td>Free ads</td>
            <td class="us-val"><span class="good">Never</span></td>
            ${COMPETITORS.slice(0, 4).map(c => `<td>${c.freeAds ? '<span class="bad">Yes</span>' : '<span class="good">No</span>'}</td>`).join("")}
          </tr>
          <tr>
            <td>Bilingual</td>
            <td class="us-val"><span class="good">EN + ES</span></td>
            ${COMPETITORS.slice(0, 4).map(c => `<td>${c.bilingual ? '<span class="good">✓</span>' : '<span class="bad">✗</span>'}</td>`).join("")}
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="section">
    <div class="cta-block">
      <h2>The ad-free guitar tuner that costs 78% less</h2>
      <p>Download GuitarTune free — no ads, no sign-up. Pro from $9.99/year.</p>
      <a href="/#download" class="hero-cta">Download Free</a>
    </div>
  </section>
</div>
${buildFooter([{ href: "/tunings", label: "All Tunings" }, { href: "/", label: "Home" }])}
</body>
</html>`;
  }

  // tunings hub
  const title = "Guitar Tunings Guide — Drop D, Open G, DADGAD & More | GuitarTune";
  const desc = "Complete guide to alternate guitar tunings: Drop D, Open G, DADGAD, Open D, Open E, Drop C, and more. Step-by-step instructions with a free guitar tuner app.";
  const canonical = `${BASE_URL}/tunings`;

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Guitar Tuning Guides",
    "itemListElement": TUNINGS.map((t, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `${BASE_URL}/tunings/${t.slug}`,
      "name": `How to tune to ${t.name}`
    }))
  }, null, 2);

  return `${buildHead(title, desc, canonical, schema)}
<body>
${buildNav("/tunings")}
<div class="wrap">
  <section class="hero">
    <div class="tag">Tuning Guides</div>
    <h1>Guitar Tunings:<br><span style="color:var(--cyan)">Complete Guide</span></h1>
    <p class="sub">Drop D, Open G, DADGAD, Open D, and more — step-by-step guides for every alternate tuning, plus a free guitar tuner app to follow along.</p>
    <a href="/#download" class="hero-cta">Tune Free with GuitarTune</a>
  </section>

  <section class="section">
    <h2>Free Tunings (GuitarTune Free Tier)</h2>
    <div class="internal-links">
      ${TUNINGS.filter(t => !t.isPremium).map(t => `
      <a href="/tunings/${t.slug}">
        <strong>${htmlEscape(t.name)}</strong> (${htmlEscape(t.shorthand)})
        <span style="display:block;font-size:11px;color:#444;margin-top:2px">${htmlEscape(t.genre)}</span>
      </a>`).join("")}
    </div>

    <h2>Pro Tunings (GuitarTune Pro — $9.99/yr)</h2>
    <div class="internal-links">
      ${TUNINGS.filter(t => t.isPremium).map(t => `
      <a href="/tunings/${t.slug}">
        <strong>${htmlEscape(t.name)}</strong> (${htmlEscape(t.shorthand)})
        <span style="display:block;font-size:11px;color:#444;margin-top:2px">${htmlEscape(t.genre)}</span>
      </a>`).join("")}
    </div>
  </section>

  <section class="section alt" style="margin:0 -24px;padding:60px 0">
    <div class="wrap">
      <h2>All Tuning Guides</h2>
      <table class="compare-table">
        <thead>
          <tr><th>Tuning</th><th>Notes</th><th>Genre</th><th>Difficulty</th><th>In GuitarTune</th></tr>
        </thead>
        <tbody>
          ${TUNINGS.map(t => `
          <tr>
            <td><a href="/tunings/${t.slug}">${htmlEscape(t.name)}</a></td>
            <td style="font-family:'Arial Black',Arial,sans-serif;font-size:13px;color:#fff;letter-spacing:1px">${htmlEscape(t.shorthand)}</td>
            <td>${htmlEscape(t.genre)}</td>
            <td>${htmlEscape(t.difficulty)}</td>
            <td>${t.isPremium ? '<span class="mid">Pro ($9.99/yr)</span>' : '<span class="good">Free</span>'}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </section>

  <section class="section">
    <div class="cta-block">
      <h2>Tune with GuitarTune</h2>
      <p>Open the app, select your tuning, pluck each string. In tune in under 10 seconds. No ads, ever.</p>
      <a href="/#download" class="hero-cta">Download Free</a>
    </div>
  </section>
</div>
${buildFooter([{ href: "/compare", label: "Compare Apps" }, { href: "/", label: "Home" }])}
</body>
</html>`;
}

export function registerSeoRoutes(app: Express): void {
  app.get("/compare", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(hubPage("compare"));
  });

  app.get("/tunings", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(hubPage("tunings"));
  });

  app.get("/vs/:slug", (req: Request, res: Response) => {
    const { slug } = req.params;
    const competitor = COMPETITORS.find(c => c.slug === slug);
    if (!competitor) {
      return res.status(404).send("<h1>Not found</h1>");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(competitorPage(competitor));
  });

  app.get("/tunings/:slug", (req: Request, res: Response) => {
    const { slug } = req.params;
    const tuning = TUNINGS.find(t => t.slug === slug);
    if (!tuning) {
      return res.status(404).send("<h1>Not found</h1>");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(tuningPage(tuning));
  });

  app.get("/sitemap.xml", (_req: Request, res: Response) => {
    const urls = [
      { loc: `${BASE_URL}/`, priority: "1.0", changefreq: "weekly" },
      { loc: `${BASE_URL}/compare`, priority: "0.9", changefreq: "monthly" },
      { loc: `${BASE_URL}/tunings`, priority: "0.9", changefreq: "monthly" },
      ...COMPETITORS.map(c => ({ loc: `${BASE_URL}/vs/${c.slug}`, priority: "0.8", changefreq: "monthly" })),
      ...TUNINGS.map(t => ({ loc: `${BASE_URL}/tunings/${t.slug}`, priority: "0.8", changefreq: "monthly" })),
      { loc: `${BASE_URL}/competitive-analysis`, priority: "0.5", changefreq: "yearly" },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
  </url>`).join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.send(xml);
  });

  app.get("/competitive-analysis", (_req: Request, res: Response) => {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.resolve(process.cwd(), "server", "templates", "competitive-analysis.html");
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(fs.readFileSync(filePath, "utf-8"));
    } else {
      res.status(404).send("Not found");
    }
  });

  app.get("/ad-copy", (_req: Request, res: Response) => {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.resolve(process.cwd(), "server", "templates", "ad-copy.html");
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(fs.readFileSync(filePath, "utf-8"));
    } else {
      res.status(404).send("Not found");
    }
  });

  app.get("/launch-playbook", (_req: Request, res: Response) => {
    const fs = require("fs");
    const path = require("path");
    const filePath = path.resolve(process.cwd(), "server", "templates", "launch-playbook.html");
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(fs.readFileSync(filePath, "utf-8"));
    } else {
      res.status(404).send("Not found");
    }
  });

  app.get("/ads/:filename", (req: Request, res: Response) => {
    const fs = require("fs");
    const path = require("path");
    const filename = String(req.params.filename);
    if (!/^[a-z0-9-]+\.html$/.test(filename)) return res.status(400).send("Bad request");
    const filePath = path.resolve(process.cwd(), "server", "templates", "ads", filename);
    if (fs.existsSync(filePath)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(fs.readFileSync(filePath, "utf-8"));
    } else {
      res.status(404).send("Not found");
    }
  });
}
