import { lazy, Suspense, useEffect, useState } from 'react'
import RegistrationSection from './RegistrationSection'
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  Menu,
  X,
} from 'lucide-react'
import './libya.css'
import HeroArtwork from './HeroArtwork'

const LibyaGlobe = lazy(() => import('./LibyaGlobe'))

const EVENT_START = Date.parse('2026-11-14T15:00:00+02:00')
const countries = ['Egypt', 'Saudi Arabia', 'United Arab Emirates', 'Sudan', 'Libya']



function Countdown() {
  const [remaining, setRemaining] = useState(() => Math.max(0, EVENT_START - Date.now()))
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, EVENT_START - Date.now()))
    const timer = window.setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [])
  if (remaining === 0) return <p className="ly-countdown-ended">The Libyan Chapter Has Begun</p>
  const values = [Math.floor(remaining / 86400000), Math.floor(remaining / 3600000) % 24, Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60]
  return <div className="ly-countdown" role="timer" aria-label="Time until 14 November 2026, 3:00 PM, Africa/Tripoli">
    {values.map((value, i) => <div key={i}><strong>{String(value).padStart(2, '0')}</strong><span>{['Days', 'Hours', 'Minutes', 'Seconds'][i]}</span></div>)}
  </div>
}

export default function LibyaHome() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  return <div className="ly-site" lang="en" dir="ltr">
    <a href="#ly-main" className="ly-skip">Skip to content</a>
    <header className="ly-header">
      <a href="#beginning" aria-label="Limitless Naturals home" onClick={closeMenu}><img className="ly-logo" src="/assets/limitless_white.png" alt="Limitless Naturals" width="176" height="70" /></a>
      <button className="ly-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="ly-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <nav id="ly-navigation" aria-label="Main navigation" className={menuOpen ? 'ly-navigation ly-navigation-open' : 'ly-navigation'}>
        <a href="#who-we-are" onClick={closeMenu}>Who We Are</a><a href="#growing" onClick={closeMenu}>Growing Across Borders</a><a href="#event" onClick={closeMenu}>Event Details</a><a className="ly-nav-cta" href="#rsvp" onClick={closeMenu}>Register Right Now <ArrowUpRight size={16} /></a>
      </nav>
    </header>
    <main id="ly-main">
      <section className="ly-section ly-growing" id="growing">
        <div className="ly-growing-copy"><p className="ly-eyebrow">Growing Across Borders</p><h2>Our Next Chapter Begins in Libya.</h2><p className="ly-market-line">Egypt · Saudi Arabia · United Arab Emirates</p><p className="ly-muted">Every market represents a new opportunity to build partnerships and bring our approach to wellness to more people.</p></div>
        <div className="ly-presence" aria-label="Country presence">
          <Suspense
  fallback={
    <div className="ly-globe-slot" role="status">
      Loading our global presence…
    </div>
  }
>
  <LibyaGlobe />
</Suspense>
          <ul className="ly-country-accessible">{countries.map(country => <li key={country}>{country}{country === 'Libya' ? ' — NEW CHAPTER' : ''}</li>)}</ul>
        </div>
      </section>
      <section className="ly-section ly-about" id="who-we-are">
        <div><p className="ly-eyebrow">Who We Are</p><h2>Limitless Health Since 2020</h2><p className="ly-established">Established by EVA Pharma.</p></div>
        <div className="ly-about-copy"><p>Limitless Naturals is a wellness brand focused on preventive health and nutritional supplements.</p><p className="ly-muted">From daily nutrition to targeted supplementation, we bring science-led products into everyday life.</p></div>
      </section>
      <div className="ly-countdown-band" role="group" aria-label="Event countdown">
        <div className="ly-hero-countdown">
          <p className="ly-countdown-title">The Libyan Chapter Begins</p>
          <div className="ly-countdown-values"><Countdown /></div>
        </div>
      </div>

      <section className="ly-hero ly-section" id="beginning">
  <HeroArtwork />

  <div className="ly-hero-inner">
    <div className="ly-hero-content">
      <p className="ly-eyebrow">TRIPOLI, LIBYA</p>

      <h1>
        Limitless Naturals
        <br />
        Is Here in Libya
      </h1>

      <div className="ly-hero-description">
        <p>
          Expanding our presence across Egypt, Saudi Arabia, the UAE, and Sudan.
        </p>
        <p>
          We’re bringing our science-led approach to everyday wellness to a new market.
        </p>
      </div>

      <a href="#rsvp" className="ly-button">
        Register Right Now
        <ArrowUpRight size={18} />
      </a>

      <p className="ly-hero-date">
        14 November 2026 — The Libyan Chapter Begins
      </p>
    </div>

  </div>
</section>
      <section className="ly-section ly-event" id="event">
        <p className="ly-eyebrow">Limitless Naturals Launch in Libya</p><h2>Let’s Begin This Chapter Together</h2><p className="ly-muted">A new market. A shared vision for everyday wellness.</p>
        <div className="ly-event-grid">
          <div><CalendarDays aria-hidden="true" /><span>Date</span><strong>Saturday, 14 November 2026</strong></div>
          <div><Clock3 aria-hidden="true" /><span>Time</span><strong>3:00 PM – 9:00 PM</strong><small>Africa/Tripoli</small></div>
          <div><MapPin aria-hidden="true" /><span>Venue</span><strong>Lancaster, Burj Al-Hayat Hotel, Tripoli, Libya</strong></div>
        </div><p className="ly-welcome">We look forward to welcoming you.</p>
      </section>
  <RegistrationSection />
    </main>
    <footer className="ly-footer"><a href="#beginning" aria-label="Back to Limitless Naturals home"><img className="ly-logo" src="/assets/limitless_white.png" alt="Limitless Naturals" width="176" height="70" loading="lazy" /></a><p>Limitless Naturals Launch in Libya</p><span>14 November 2026 · Tripoli, Libya</span></footer>
  </div>
}
