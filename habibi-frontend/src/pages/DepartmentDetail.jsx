import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { departments } from '../data/departments';
import './DepartmentDetail.css';

function useRevealOnScroll() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

export default function DepartmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const index = departments.findIndex(d => d.id === id);
  const dept = departments[index];
  const next = departments[(index + 1 + departments.length) % departments.length];

  const [pillarsRef, pillarsInView] = useRevealOnScroll();
  const [introRef, introInView] = useRevealOnScroll();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!dept) {
    return (
      <div className="dd-page" style={{ padding: '6rem 1rem', textAlign: 'center' }}>
        <SEO title="Department Not Found" noindex />
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>This department couldn't be found.</p>
        <Link to="/careers" className="dd-cta-btn">Back to Careers</Link>
      </div>
    );
  }

  return (
    <div className="dd-page">
      <SEO
        title={`${dept.title} | Careers at Habibi Halal Express`}
        description={dept.description}
      />

      {/* Hero */}
      <section className="dd-hero">
        <img
          src={dept.img}
          alt={dept.title}
          className="dd-hero-img"
          style={dept.heroFocus ? { objectPosition: dept.heroFocus } : undefined}
        />
        <div className="dd-hero-overlay" aria-hidden="true" />
        <div className="container dd-hero-content">
          <button className="dd-back" onClick={() => navigate('/careers')}>
            <ArrowLeft size={15} /> All Departments
          </button>
          <span className="dd-eyebrow">✦ {dept.label}</span>
          <h1 className="dd-title">{dept.title}</h1>
          <p className="dd-tagline">{dept.tagline}</p>
        </div>
      </section>

      {/* Intro */}
      <section className="section dd-intro-section">
        <div className={`container dd-intro${introInView ? ' in-view' : ''}`} ref={introRef}>
          <p className="dd-intro-text">{dept.intro}</p>
        </div>
      </section>

      {/* Pillars */}
      <section className="section dd-pillars-section">
        <div className="container">
          <div className="dd-pillars-grid" ref={pillarsRef}>
            {dept.pillars.map((p, i) => (
              <div
                key={p.title}
                className={`dd-pillar-card${pillarsInView ? ' in-view' : ''}`}
                style={{ transitionDelay: `${i * 0.1}s` }}
              >
                <span className="dd-pillar-icon">{p.icon}</span>
                <h3 className="dd-pillar-title">{p.title}</h3>
                <p className="dd-pillar-text">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Secondary photo break */}
      {dept.img2 && (
        <section className="dd-photo-break">
          <img
            src={dept.img2}
            alt=""
            className="dd-photo-break-img"
            style={dept.photoBreakFocus ? { objectPosition: dept.photoBreakFocus } : undefined}
          />
          <div className="dd-photo-break-overlay" aria-hidden="true" />
        </section>
      )}

      {/* CTA */}
      <section className="section dd-cta-section">
        <div className="container dd-cta-block">
          <h2 className="dd-cta-heading">Think This Is Where You Belong?</h2>
          <p className="dd-cta-sub">
            We're always looking for people who care about the craft as much as we do.
          </p>
          <div className="dd-cta-btns">
            <Link to="/careers#open-roles" className="dd-cta-btn">View Open Roles <ArrowRight size={15} /></Link>
            <Link to="/careers" className="dd-cta-btn dd-cta-btn--outline">Meet the Whole Team</Link>
          </div>
        </div>
      </section>

      {/* Next department */}
      <Link to={`/careers/departments/${next.id}`} className="dd-next-section">
        <img src={next.img} alt="" className="dd-next-img" />
        <div className="dd-next-overlay" aria-hidden="true" />
        <div className="container dd-next-content">
          <span className="dd-next-label">Next Department</span>
          <span className="dd-next-title">{next.title} <ArrowRight size={20} /></span>
        </div>
      </Link>
    </div>
  );
}
