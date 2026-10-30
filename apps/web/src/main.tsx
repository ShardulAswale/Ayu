import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, CalendarDays, CheckCircle2, HeartPulse, Leaf, LockKeyhole, Menu, ShieldCheck, Sparkles, UtensilsCrossed } from 'lucide-react';
import './styles.css';
import { LoginPage } from './LoginPage';
import { ActivatePage } from './ActivatePage';
import { DashboardPage } from './DashboardPage';
import { isDashboardPath } from './role-routing.mjs';

const features = [
  { icon: UtensilsCrossed, title: 'Personalized nutrition', text: 'Thoughtful meal plans designed around real lives, preferences, and goals.' },
  { icon: HeartPulse, title: 'Progress that makes sense', text: 'A clearer view of meals, habits, and progress over time.' },
  { icon: ShieldCheck, title: 'Privacy by design', text: 'A secure foundation built with sensitive health information in mind.' },
];
function LegacyAdminRedirect() {
  React.useEffect(() => { window.location.replace('/login'); }, []);
  return <main className="ayu-signup-info"><p>Redirecting to <a href="/login">sign in</a>…</p></main>;
}

function App() {
  const [route, setRoute] = React.useState(window.location.hash);
  React.useEffect(() => { const onHashChange = () => setRoute(window.location.hash); window.addEventListener('hashchange', onHashChange); return () => window.removeEventListener('hashchange', onHashChange); }, []);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  if (isDashboardPath(pathname) || route === '#dashboard') return <DashboardPage/>;
  if (pathname === '/admin') return <LegacyAdminRedirect/>;
  if (pathname === '/login' || route === '#login') return <LoginPage/>;
  if (route.startsWith('#activate?')) return <ActivatePage token={new URLSearchParams(route.slice('#activate?'.length)).get('token') || ''}/>;
  if (route === '#signup') return <main className="ayu-signup-info" style={{maxWidth:520,margin:'12vh auto',padding:24,fontFamily:'sans-serif'}}><a href="/">← Ayu home</a><h1>Sign up for Ayu</h1><p>Registration is not open yet. Patient accounts will be created through a verified invitation, and dietitian accounts will require approval. No account is created on this page.</p><a className="primary-button" href="/login">Go to login <ArrowRight size={18}/></a></main>;
  return <>
    <header className="header"><div className="container header-inner"><a className="brand brand-signature" href="#home" aria-label="Ayu by Shruti Kulkarni home"><span className="brand-mark"><Leaf size={19}/></span><span className="brand-lockup"><span className="brand-word">Ayu<span className="brand-dot">.</span></span><span className="brand-byline">By Shruti Kulkarni</span></span></a><nav className={menuOpen?'nav open':'nav'} aria-label="Main navigation"><a href="#approach" onClick={()=>setMenuOpen(false)}>Our approach</a><a href="#features" onClick={()=>setMenuOpen(false)}>What we're building</a><a href="#about" onClick={()=>setMenuOpen(false)}>About</a></nav><div className="header-auth"><a className="header-status" href="/login">Log in</a><a className="header-status" href="/#signup">Sign up</a></div><button className="menu-button" onClick={()=>setMenuOpen(v=>!v)} aria-label="Toggle navigation" aria-expanded={menuOpen}><Menu size={23}/></button></div></header>
    <main id="home"><section className="hero"><div className="container hero-grid">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={15}/> Nutrition <span className="eyebrow-divider">|</span> Wellness</div>
        <h1>Personalised nutrition.<br/><em>Lasting wellness.</em></h1>
        <p className="hero-lede">Ayu is a nutrition and wellness experience by <strong>Shruti Kulkarni</strong>, dietitian, lifestyle coach and certified diabetes educator. Practical, personalised guidance to help you build healthier habits that fit real life.</p>
        <div className="hero-actions"><a className="primary-button" href="#about">Meet Shruti <ArrowRight size={18}/></a><a className="hero-secondary-link" href="/login">Log in to Ayu</a></div>
        <p className="hero-auth-links"><a href="#signup">Patient access is by invitation</a></p>
        <div className="hero-footnote"><LockKeyhole size={15}/> Personal nutrition care, supported by experience.</div>
      </div>
      <figure className="hero-profile">
        <div className="profile-backdrop" aria-hidden="true"><span className="profile-sun"/><span className="profile-arc"/></div>
        <div className="profile-portrait-frame">
          <img src="/shruti-kulkarni.webp" alt="Portrait of Shruti Kulkarni, dietitian and lifestyle coach" width="240" height="240" decoding="async" fetchPriority="high"/>
        </div>
        <figcaption className="profile-identity"><span className="profile-kicker">Meet your dietitian</span><strong>Shruti Kulkarni</strong><span>Dietitian · Lifestyle Coach</span><small>Certified Diabetes Educator</small></figcaption>
        <div className="profile-experience"><strong>12+</strong><span>years of clinical and<br/>coaching experience</span></div>
      </figure>
    </div></section>
    <section className="intro" id="approach"><div className="container intro-grid"><span className="section-kicker">01 / OUR PHILOSOPHY</span><div><h2>Health is personal.<br/><em>Nutrition should be too.</em></h2><p>We believe lasting progress comes from understanding the person, not just the numbers. Ayu is being designed to bring compassionate clinical guidance and practical everyday tools together.</p></div></div></section>
    <section className="features" id="features"><div className="container"><div className="section-heading"><div><span className="section-kicker">02 / WHAT'S COMING</span><h2>Support for the<br/><em>whole journey.</em></h2></div><p>Thoughtfully designed tools for patients and dietitians, working together.</p></div><div className="feature-grid">{features.map(({icon:Icon,title,text},i)=><article className="feature-card" key={title}><div className="feature-top"><span>0{i+1}</span><Icon size={25}/></div><h3>{title}</h3><p>{text}</p><span className="feature-arrow"><ArrowRight size={18}/></span></article>)}</div></div></section>
    <section className="about" id="about"><div className="container about-inner"><div className="about-icon"><CalendarDays size={30}/></div><div><span className="section-kicker">ABOUT SHRUTI KULKARNI</span><h2>Experience with care.<br/><em>Nutrition with purpose.</em></h2><p>Meet <strong>Shruti Kulkarni</strong>, a dietitian, lifestyle coach and Certified Diabetes Educator with 12+ years of clinical and coaching experience. Her approach connects evidence-informed guidance with practical, sustainable daily habits.</p><p>Her work spans diabetes and metabolic health, heart disease, women’s health and PCOS, therapeutic nutrition, CGM-informed coaching, nutrigenomics and corporate wellness. She is a Certified Nutrigenomics Counsellor and a lifetime member of the Indian Dietetic Association.</p></div><div className="about-tag"><CheckCircle2 size={18}/> Dietitian-led</div></div></section></main>
    <footer className="footer"><div className="container footer-inner"><a className="brand" href="#home" aria-label="Ayu home"><span className="brand-mark"><Leaf size={17}/></span>Ayu<span className="brand-dot">.</span></a><p>By Shruti Kulkarni · Nutrition | Wellness</p><span>© {new Date().getFullYear()} Shardul Aswale. All rights reserved. · Developed by Shardul Aswale</span></div></footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
