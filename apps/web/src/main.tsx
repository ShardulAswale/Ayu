import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, CalendarDays, CheckCircle2, HeartPulse, Leaf, LockKeyhole, Menu, ShieldCheck, Sparkles, UtensilsCrossed } from 'lucide-react';
import './styles.css';
import { LoginPage } from './LoginPage';
import { DashboardPage } from './DashboardPage';

const features = [
  { icon: UtensilsCrossed, title: 'Personalized nutrition', text: 'Thoughtful meal plans designed around real lives, preferences, and goals.' },
  { icon: HeartPulse, title: 'Progress that makes sense', text: 'A clearer view of meals, habits, and progress over time.' },
  { icon: ShieldCheck, title: 'Privacy by design', text: 'A secure foundation built with sensitive health information in mind.' },
];
function App() {
  const [route, setRoute] = React.useState(window.location.hash);
  React.useEffect(() => { const onHashChange = () => setRoute(window.location.hash); window.addEventListener('hashchange', onHashChange); return () => window.removeEventListener('hashchange', onHashChange); }, []);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  if (route === '#dashboard') return <DashboardPage/>;
  if (pathname === '/admin') return <LoginPage portal="staff"/>;
  if (pathname === '/login' || route === '#login') return <LoginPage portal="customer"/>;
  if (route === '#signup') return <main className="ayu-signup-info" style={{maxWidth:520,margin:'12vh auto',padding:24,fontFamily:'sans-serif'}}><a href="/">← Ayu home</a><h1>Sign up for Ayu</h1><p>Registration is not open yet. Patient accounts will be created through a verified invitation, and dietitian accounts will require approval. No account is created on this page.</p><a className="primary-button" href="/login">Go to customer login <ArrowRight size={18}/></a></main>;
  return <>
    <header className="header"><div className="container header-inner"><a className="brand" href="#home" aria-label="Ayu home"><span className="brand-mark"><Leaf size={19}/></span>ayu<span className="brand-dot">.</span></a><nav className={menuOpen?'nav open':'nav'} aria-label="Main navigation"><a href="#approach" onClick={()=>setMenuOpen(false)}>Our approach</a><a href="#features" onClick={()=>setMenuOpen(false)}>What we're building</a><a href="#about" onClick={()=>setMenuOpen(false)}>About</a></nav><div className="header-auth"><a className="header-status" href="/login">Customer login</a><a className="header-status" href="/admin">Staff login</a></div><button className="menu-button" onClick={()=>setMenuOpen(v=>!v)} aria-label="Toggle navigation" aria-expanded={menuOpen}><Menu size={23}/></button></div></header>
    <main id="home"><section className="hero"><div className="container hero-grid"><div className="hero-copy"><div className="eyebrow"><Sparkles size={15}/> A more considered way to care</div><h1>Better nutrition.<br/><em>Better everyday.</em></h1><p className="hero-lede">A calmer, more personal approach to nutrition care — connecting dietitian guidance, everyday meals, and meaningful progress.</p><a className="primary-button" href="/login">Customer login <ArrowRight size={18}/></a><p className="hero-auth-links"><a href="/admin">Dietitian &amp; admin login</a><span aria-hidden="true">·</span><a href="#signup">Sign up information</a></p><div className="hero-footnote"><LockKeyhole size={15}/> Secure nutrition care for patients and dietitians.</div></div><div className="hero-art" aria-label="Decorative botanical illustration"><div className="art-circle"/><div className="art-leaf leaf-one"/><div className="art-leaf leaf-two"/><div className="art-leaf leaf-three"/><div className="art-stem"/><div className="floating-card"><div className="card-icon"><HeartPulse size={21}/></div><div><strong>Care that feels personal</strong><span>Made for your everyday</span></div><CheckCircle2 size={19} className="card-check"/></div><div className="art-caption">NOURISH • GROW • THRIVE</div></div></div></section>
    <section className="intro" id="approach"><div className="container intro-grid"><span className="section-kicker">01 / OUR PHILOSOPHY</span><div><h2>Health is personal.<br/><em>Nutrition should be too.</em></h2><p>We believe lasting progress comes from understanding the person, not just the numbers. Ayu is being designed to bring compassionate clinical guidance and practical everyday tools together.</p></div></div></section>
    <section className="features" id="features"><div className="container"><div className="section-heading"><div><span className="section-kicker">02 / WHAT'S COMING</span><h2>Support for the<br/><em>whole journey.</em></h2></div><p>Thoughtfully designed tools for patients and dietitians, working together.</p></div><div className="feature-grid">{features.map(({icon:Icon,title,text},i)=><article className="feature-card" key={title}><div className="feature-top"><span>0{i+1}</span><Icon size={25}/></div><h3>{title}</h3><p>{text}</p><span className="feature-arrow"><ArrowRight size={18}/></span></article>)}</div></div></section>
    <section className="about" id="about"><div className="container about-inner"><div className="about-icon"><CalendarDays size={30}/></div><div><span className="section-kicker">BUILT WITH CARE</span><h2>Guided by expertise.<br/><em>Made for real life.</em></h2><p>Ayu is being developed for dietitian-led nutrition care, with practitioner review at the center of clinical decisions.</p></div><div className="about-tag"><CheckCircle2 size={18}/> Dietitian-led</div></div></section></main>
    <footer className="footer"><div className="container footer-inner"><a className="brand" href="#home"><span className="brand-mark"><Leaf size={17}/></span>ayu<span className="brand-dot">.</span></a><p>Thoughtful nutrition, one day at a time.</p><span>© {new Date().getFullYear()} Ayu · Development</span></div></footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
