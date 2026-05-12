<template>
  <div class="landing">
    <!-- Top navigation -->
    <nav class="top-nav">
      <a href="/" class="nav-brand">BEACON</a>
      <div class="nav-links">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#pricing">Pricing</a>
        <a href="https://github.com/AleksandarN-BG/beacon" target="_blank" rel="noopener">GitHub</a>
        <a href="/login" class="nav-cta">Sign in</a>
      </div>
    </nav>

    <!-- Hero with radiating circles -->
    <section class="landing-hero">
      <div
        v-for="emitter in emitters"
        :key="emitter.id"
        class="circle-emitter"
        :style="{ left: emitter.x + '%', top: emitter.y + '%' }"
      >
        <div class="circle"></div>
        <div class="circle"></div>
      </div>

      <div class="hero-content">
        <p class="hero-eyebrow">When downtime isn&rsquo;t an option.</p>
        <h1 class="hero-title">
          Reach the right engineer.<br />
          <span class="accent">Before the customer reaches you.</span>
        </h1>
        <p class="hero-sub">
          Beacon is an open-source incident management platform with severity-based
          escalation, on-call schedules, and SMS &amp; voice alerts &mdash; built for
          Azure-native teams that have outgrown Excel and Slack DMs, but not their budget.
        </p>
        <div class="hero-ctas">
          <a href="/login" class="btn-primary">Start free</a>
          <a href="https://github.com/AleksandarN-BG/beacon" target="_blank" rel="noopener" class="btn-secondary">
            View on GitHub
            <span class="arrow">&rarr;</span>
          </a>
        </div>
        <p class="hero-note">
          MIT licensed &middot; Self-hostable &middot; Microsoft Entra ID sign-in
        </p>
      </div>

      <div class="scroll-hint" aria-hidden="true">
        <span>Scroll</span>
        <div class="scroll-line"></div>
      </div>
    </section>

    <!-- Problem section -->
    <section class="section problem-section">
      <div class="container-narrow">
        <p class="section-eyebrow">The 3 AM problem</p>
        <h2 class="section-title">
          Production is down. Who&rsquo;s on call?
        </h2>
        <p class="section-lead">
          Small and mid-size engineering teams run production systems without a real
          incident process. The result is a Slack ping at 2:14 AM and a coin-toss for who
          notices first.
        </p>
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-figure">$5,600<span class="stat-unit">/min</span></div>
            <p class="stat-label">Average downtime cost for an enterprise outage.</p>
            <p class="stat-source">Gartner</p>
          </div>
          <div class="stat-card">
            <div class="stat-figure">68<span class="stat-unit">%</span></div>
            <p class="stat-label">Of SRE engineers report on-call burnout.</p>
            <p class="stat-source">Catchpoint SRE Report, 2023</p>
          </div>
          <div class="stat-card">
            <div class="stat-figure">$1.5<span class="stat-unit">B</span></div>
            <p class="stat-label">Global incident management market, growing 15% YoY.</p>
            <p class="stat-source">Grand View Research, 2024</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="section features-section">
      <div class="container-narrow">
        <p class="section-eyebrow">Core features</p>
        <h2 class="section-title">Everything you need. Nothing you don&rsquo;t.</h2>
        <p class="section-lead">
          Beacon covers 80% of the on-call workflow with 20% of PagerDuty&rsquo;s surface
          area &mdash; on purpose.
        </p>
        <div class="feature-grid">
          <div class="feature-card">
            <div class="feature-icon" data-variant="alert">
              <div class="pulse-dot"></div>
            </div>
            <h3>Severity-based escalation</h3>
            <p>
              Low logs the incident. Medium texts the on-call. High triggers a phone call
              via Twilio. No rules engine to configure &mdash; sensible defaults that work
              on day one.
            </p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-variant="schedule">
              <div class="schedule-blocks">
                <span></span><span></span><span></span><span></span>
              </div>
            </div>
            <h3>On-call schedules</h3>
            <p>
              Rotations are visible to the whole team. Admins manage shifts; engineers
              know who&rsquo;s up tonight without opening a spreadsheet at 3 AM.
            </p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-variant="azure">
              <div class="azure-mark">A</div>
            </div>
            <h3>Azure-native, Entra ID auth</h3>
            <p>
              Static Web Apps, Functions, Cosmos DB, Microsoft Entra ID. Drop it into your
              existing tenant &mdash; no new vendor to push through security review.
            </p>
          </div>
          <div class="feature-card">
            <div class="feature-icon" data-variant="oss">
              <div class="oss-brackets">&#123; &#125;</div>
            </div>
            <h3>Open source, self-hostable</h3>
            <p>
              MIT licensed. Read the code, fork it, audit it. Required for regulated
              industries; reassuring for everyone else.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how" class="section how-section">
      <div class="container-narrow">
        <p class="section-eyebrow">How it works</p>
        <h2 class="section-title">One form. Three escalation paths.</h2>
        <p class="section-lead">
          Engineers file an incident in under 30 seconds. Beacon routes it based on the
          severity they pick.
        </p>
        <div class="flow">
          <div class="flow-step" data-tier="low">
            <div class="flow-badge">LOW</div>
            <h4>Logged for triage</h4>
            <p>
              Captured in the incident feed for the morning standup. No one&rsquo;s phone
              rings.
            </p>
            <div class="flow-icon">&#9737;</div>
          </div>
          <div class="flow-arrow">&rarr;</div>
          <div class="flow-step" data-tier="medium">
            <div class="flow-badge">MEDIUM</div>
            <h4>SMS to on-call</h4>
            <p>
              The engineer currently on-call gets a text with the title, severity, and a
              link.
            </p>
            <div class="flow-icon">&#9993;</div>
          </div>
          <div class="flow-arrow">&rarr;</div>
          <div class="flow-step" data-tier="high">
            <div class="flow-badge">HIGH</div>
            <h4>Phone call</h4>
            <p>
              Twilio voice call to the on-call engineer. If unacknowledged, escalates up
              the chain.
            </p>
            <div class="flow-icon">&#9742;</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section id="pricing" class="section pricing-section">
      <div class="container-narrow">
        <p class="section-eyebrow">Pricing</p>
        <h2 class="section-title">Honest pricing. No per-seat tax.</h2>
        <p class="section-lead">
          Run Beacon yourself for free, forever. Or let us host it &mdash; with updates,
          backups, and SMS/voice credits included.
        </p>
        <div class="pricing-grid">
          <div class="pricing-card">
            <div class="pricing-tier">Self-hosted</div>
            <div class="pricing-price">Free<span class="pricing-unit">forever</span></div>
            <p class="pricing-tagline">Everything in the box. MIT licensed.</p>
            <ul class="pricing-features">
              <li>Unlimited users &amp; incidents</li>
              <li>Run on your own Azure tenant</li>
              <li>Community support on GitHub</li>
              <li>You bring your own Twilio account</li>
            </ul>
            <a href="https://github.com/AleksandarN-BG/beacon" target="_blank" rel="noopener" class="pricing-cta secondary">Clone the repo</a>
          </div>

          <div class="pricing-card">
            <div class="pricing-tier">Starter</div>
            <div class="pricing-price">&euro;29<span class="pricing-unit">/month</span></div>
            <p class="pricing-tagline">Managed hosting for small teams.</p>
            <ul class="pricing-features">
              <li>Up to 10 users</li>
              <li>Beacon Cloud hosting</li>
              <li>Automatic updates &amp; backups</li>
              <li>Email support</li>
              <li>SMS &amp; voice credits included</li>
            </ul>
            <a href="/login" class="pricing-cta secondary">Start free trial</a>
          </div>

          <div class="pricing-card recommended">
            <div class="pricing-flag">Most popular</div>
            <div class="pricing-tier">Growth</div>
            <div class="pricing-price">&euro;79<span class="pricing-unit">/month</span></div>
            <p class="pricing-tagline">For teams that already broke prod once.</p>
            <ul class="pricing-features">
              <li>Up to 50 users</li>
              <li>Everything in Starter</li>
              <li>Priority support</li>
              <li>SSO via Entra ID</li>
              <li>Audit log &amp; retention controls</li>
            </ul>
            <a href="/login" class="pricing-cta primary">Start free trial</a>
          </div>

          <div class="pricing-card">
            <div class="pricing-tier">Enterprise</div>
            <div class="pricing-price">Custom</div>
            <p class="pricing-tagline">For regulated industries &amp; large orgs.</p>
            <ul class="pricing-features">
              <li>Unlimited users</li>
              <li>SLA &amp; dedicated support</li>
              <li>Compliance documentation</li>
              <li>Custom integrations</li>
              <li>Onboarding &amp; training</li>
            </ul>
            <a href="mailto:hello@beacon.dev?subject=Beacon%20Enterprise" class="pricing-cta secondary">Contact sales</a>
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="section final-cta">
      <div class="container-narrow">
        <h2 class="final-title">Stop firefighting at 3 AM.</h2>
        <p class="final-sub">
          Spin up Beacon in your Azure tenant in under an hour &mdash; or start free on
          Beacon Cloud and have your team alerting in minutes.
        </p>
        <div class="hero-ctas">
          <a href="/login" class="btn-primary">Start free</a>
          <a href="https://github.com/AleksandarN-BG/beacon" target="_blank" rel="noopener" class="btn-secondary">
            View on GitHub
            <span class="arrow">&rarr;</span>
          </a>
        </div>
      </div>
    </section>

    <footer class="landing-footer">
      <div class="footer-row">
        <div class="footer-brand">
          <span class="footer-wordmark">BEACON</span>
          <span class="footer-tag">When downtime isn&rsquo;t an option.</span>
        </div>
        <div class="footer-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="https://github.com/AleksandarN-BG/beacon" target="_blank" rel="noopener">GitHub</a>
          <a href="/login">Sign in</a>
        </div>
      </div>
      <p class="footer-fineprint">
        &copy; {{ year }} Beacon &middot; Open-source under the MIT license.
      </p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

const emitters = ref([])
const emitterIdCounter = ref(0)
const timeouts = ref([])

const NUM_EMITTERS = 3
const ANIMATION_DURATION = 6000

const year = computed(() => new Date().getFullYear())

function createEmitter() {
  const id = emitterIdCounter.value++
  const emitter = {
    id,
    x: Math.random() * 100,
    y: Math.random() * 100
  }
  emitters.value.push(emitter)

  const timeout = setTimeout(() => {
    emitters.value = emitters.value.filter(e => e.id !== id)
    createEmitter()
  }, ANIMATION_DURATION)

  timeouts.value.push(timeout)
}

onMounted(() => {
  for (let i = 0; i < NUM_EMITTERS; i++) {
    const timeout = setTimeout(() => createEmitter(), i * 2000)
    timeouts.value.push(timeout)
  }
})

onUnmounted(() => {
  timeouts.value.forEach(t => clearTimeout(t))
})
</script>

<style scoped>
.landing {
  background: #1a1a2e;
  color: white;
  min-height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* ============================================
   TOP NAV
   ============================================ */
.top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2.5rem;
  background: rgba(26, 26, 46, 0.6);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.nav-brand {
  color: white;
  font-weight: 300;
  letter-spacing: 0.25em;
  font-size: 1.1rem;
  text-decoration: none;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.nav-links a {
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: white;
}

.nav-cta {
  background: #8B0000;
  color: white !important;
  padding: 0.5rem 1.1rem;
  border-radius: 6px;
  transition: background 0.2s, transform 0.2s;
}

.nav-cta:hover {
  background: #a00000;
  transform: translateY(-1px);
}

/* ============================================
   HERO
   ============================================ */
.landing-hero {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: #8B0000;
  display: flex;
  align-items: center;
  padding: 8rem 2.5rem 4rem;
}

.hero-content {
  position: relative;
  z-index: 10;
  max-width: 880px;
  margin: 0 auto;
  width: 100%;
  text-align: center;
}

.hero-eyebrow {
  font-size: 0.85rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  opacity: 0.75;
  margin-bottom: 1.5rem;
  font-weight: 300;
}

.hero-title {
  font-size: clamp(2.2rem, 5.5vw, 4rem);
  font-weight: 300;
  line-height: 1.15;
  letter-spacing: -0.01em;
  margin-bottom: 1.75rem;
}

.hero-title .accent {
  font-weight: 500;
  opacity: 0.9;
}

.hero-sub {
  font-size: 1.1rem;
  line-height: 1.6;
  opacity: 0.85;
  max-width: 640px;
  margin: 0 auto 2.5rem;
}

.hero-ctas {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.btn-primary {
  background: white;
  color: #8B0000;
  padding: 0.9rem 2rem;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
  display: inline-block;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}

.btn-secondary {
  background: transparent;
  color: white;
  padding: 0.9rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.35);
  transition: background 0.2s, border-color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.6);
}

.btn-secondary .arrow {
  transition: transform 0.2s;
}

.btn-secondary:hover .arrow {
  transform: translateX(3px);
}

.hero-note {
  font-size: 0.85rem;
  opacity: 0.6;
  letter-spacing: 0.02em;
}

.scroll-hint {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  opacity: 0.6;
}

.scroll-line {
  width: 1px;
  height: 30px;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.8), transparent);
  animation: scrollPulse 2s ease-out infinite;
}

@keyframes scrollPulse {
  0%, 100% { opacity: 0.3; transform: scaleY(0.6); }
  50% { opacity: 1; transform: scaleY(1); }
}

/* ============================================
   SHARED SECTION STYLES
   ============================================ */
.section {
  padding: 6rem 2.5rem;
}

.container-narrow {
  max-width: 1100px;
  margin: 0 auto;
}

.section-eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #c2410c;
  margin-bottom: 1rem;
  font-weight: 500;
  text-align: center;
}

.section-title {
  font-size: clamp(1.8rem, 3.5vw, 2.6rem);
  font-weight: 300;
  line-height: 1.2;
  text-align: center;
  margin-bottom: 1.25rem;
}

.section-lead {
  font-size: 1.05rem;
  line-height: 1.6;
  opacity: 0.7;
  max-width: 640px;
  margin: 0 auto 4rem;
  text-align: center;
}

/* ============================================
   PROBLEM / STATS
   ============================================ */
.problem-section {
  background: #1a1a2e;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: #16213e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 2rem 1.75rem;
  transition: border-color 0.3s, transform 0.3s;
}

.stat-card:hover {
  border-color: rgba(139, 0, 0, 0.5);
  transform: translateY(-3px);
}

.stat-figure {
  font-size: 2.75rem;
  font-weight: 300;
  color: white;
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
}

.stat-unit {
  font-size: 1.25rem;
  opacity: 0.6;
  margin-left: 0.25rem;
}

.stat-label {
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.stat-source {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.05em;
}

/* ============================================
   FEATURES
   ============================================ */
.features-section {
  background: #16213e;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 2rem 1.75rem;
  transition: border-color 0.3s, transform 0.3s;
}

.feature-card:hover {
  border-color: rgba(139, 0, 0, 0.5);
  transform: translateY(-3px);
}

.feature-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: rgba(139, 0, 0, 0.15);
  border: 1px solid rgba(139, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
  position: relative;
  overflow: hidden;
}

.pulse-dot {
  width: 12px;
  height: 12px;
  background: #ef4444;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  animation: pulseRing 2s infinite;
}

@keyframes pulseRing {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  70% { box-shadow: 0 0 0 14px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.schedule-blocks {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 3px;
}

.schedule-blocks span {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.5);
}

.schedule-blocks span:nth-child(2) {
  background: #4ade80;
}

.azure-mark {
  font-size: 1.5rem;
  color: white;
  font-weight: 300;
  font-family: 'Segoe UI', sans-serif;
}

.oss-brackets {
  font-family: 'Courier New', monospace;
  font-size: 1.4rem;
  color: white;
  letter-spacing: 0.05em;
}

.feature-card h3 {
  font-size: 1.2rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
  color: white;
}

.feature-card p {
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.55;
  font-size: 0.95rem;
}

/* ============================================
   HOW IT WORKS
   ============================================ */
.how-section {
  background: #1a1a2e;
}

.flow {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.flow-step {
  flex: 1 1 240px;
  background: #16213e;
  border-radius: 12px;
  padding: 2rem 1.75rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left: 4px solid #3b82f6;
  position: relative;
  text-align: left;
}

.flow-step[data-tier="medium"] {
  border-left-color: #f59e0b;
}

.flow-step[data-tier="high"] {
  border-left-color: #ef4444;
}

.flow-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  background: #1e40af;
  margin-bottom: 1rem;
  color: white;
}

.flow-step[data-tier="medium"] .flow-badge {
  background: #b45309;
}

.flow-step[data-tier="high"] .flow-badge {
  background: #dc2626;
}

.flow-step h4 {
  font-size: 1.15rem;
  font-weight: 500;
  margin-bottom: 0.6rem;
}

.flow-step p {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.95rem;
  line-height: 1.55;
  margin-bottom: 1.5rem;
}

.flow-icon {
  font-size: 2rem;
  opacity: 0.35;
  position: absolute;
  bottom: 1.25rem;
  right: 1.25rem;
}

.flow-arrow {
  display: flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 1.5rem;
}

@media (max-width: 900px) {
  .flow-arrow {
    transform: rotate(90deg);
    margin: 0 auto;
  }
}

/* ============================================
   PRICING
   ============================================ */
.pricing-section {
  background: #16213e;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.pricing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
  align-items: stretch;
}

.pricing-card {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: border-color 0.3s, transform 0.3s;
}

.pricing-card:hover {
  border-color: rgba(139, 0, 0, 0.5);
  transform: translateY(-3px);
}

.pricing-card.recommended {
  border-color: #8B0000;
  background: linear-gradient(155deg, #1a1a2e 0%, rgba(139, 0, 0, 0.15) 100%);
}

.pricing-flag {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #8B0000;
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.3rem 0.8rem;
  border-radius: 20px;
}

.pricing-tier {
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 1rem;
}

.pricing-price {
  font-size: 2.25rem;
  font-weight: 300;
  margin-bottom: 0.5rem;
  color: white;
}

.pricing-unit {
  font-size: 0.95rem;
  opacity: 0.55;
  margin-left: 0.35rem;
  font-weight: 400;
}

.pricing-tagline {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  min-height: 2.5em;
  line-height: 1.4;
}

.pricing-features {
  list-style: none;
  padding: 0;
  margin: 0 0 1.75rem 0;
  flex: 1;
}

.pricing-features li {
  padding: 0.5rem 0;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
  padding-left: 1.4rem;
}

.pricing-features li::before {
  content: "\2713";
  position: absolute;
  left: 0;
  color: #4ade80;
  font-weight: 600;
}

.pricing-features li:last-child {
  border-bottom: none;
}

.pricing-cta {
  display: block;
  text-align: center;
  padding: 0.85rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s, transform 0.2s;
  font-size: 0.95rem;
}

.pricing-cta.primary {
  background: #8B0000;
  color: white;
}

.pricing-cta.primary:hover {
  background: #a00000;
  transform: translateY(-2px);
}

.pricing-cta.secondary {
  background: transparent;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.pricing-cta.secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.6);
}

/* ============================================
   FINAL CTA
   ============================================ */
.final-cta {
  background: #8B0000;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.final-title {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 300;
  margin-bottom: 1rem;
}

.final-sub {
  font-size: 1.1rem;
  opacity: 0.85;
  line-height: 1.5;
  max-width: 580px;
  margin: 0 auto 2.5rem;
}

.final-cta .btn-secondary {
  border-color: rgba(255, 255, 255, 0.5);
}

/* ============================================
   FOOTER
   ============================================ */
.landing-footer {
  background: #0f1424;
  padding: 3rem 2.5rem 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.footer-row {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.footer-wordmark {
  font-size: 1rem;
  letter-spacing: 0.25em;
  font-weight: 300;
  color: white;
}

.footer-tag {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.footer-links {
  display: flex;
  gap: 1.75rem;
  flex-wrap: wrap;
}

.footer-links a {
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.footer-links a:hover {
  color: white;
}

.footer-fineprint {
  max-width: 1100px;
  margin: 1.5rem auto 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
}

/* ============================================
   RESPONSIVE
   ============================================ */
@media (max-width: 700px) {
  .top-nav {
    padding: 0.85rem 1.25rem;
  }
  .nav-links {
    gap: 1rem;
  }
  .nav-links a:not(.nav-cta) {
    display: none;
  }
  .landing-hero {
    padding: 7rem 1.25rem 4rem;
  }
  .section {
    padding: 4.5rem 1.25rem;
  }
  .footer-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
