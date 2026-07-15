import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Flame, CheckCircle } from 'lucide-react';
import SEO from '../components/SEO';
import './ArticleDetail.css';

const SPICES = [
  'Ground lamb — fresh-minced daily, never frozen',
  'Onion — grated, not chopped, so it blends into the meat',
  'Fresh parsley — finely chopped for colour and freshness',
  'Cumin — toasted and freshly ground',
  'Coriander — the backbone of the flavour profile',
  'Paprika — sweet, not smoked, for colour and warmth',
  'Black pepper — coarsely ground for texture',
  'Garlic — pressed fresh each morning',
  'Salt — added last, just before the skewers go on the grill',
];

export default function ArticleLambKofta() {
  return (
    <div className="article-page">
      <SEO
        title="The Secret Behind Our Lamb Kofta | Habibi Halal Express"
        description="From spice blend to live flame — the full story of how we make the Bronx's best lamb kofta at Habibi Halal Express."
        keywords="habibi halal kofta, lamb kofta bronx, halal kofta recipe, habibi express"
      />

      <div className="article-hero" style={{ backgroundImage: "url('/images/food/shesh-kebab.jpg')" }}>
        <div className="article-hero-overlay" />
        <div className="container article-hero-content">
          <Link to="/articles" className="article-back"><ArrowLeft size={15} /> Back to Articles</Link>
          <span className="article-category">Food Story</span>
          <h1 className="article-title">The Secret Behind Our Lamb Kofta</h1>
          <p className="article-subtitle">From Spice to Flame — How We Make the Bronx's Best Kofta</p>
          <div className="article-meta">
            <span><Clock size={13} /> 5 min read</span>
            <span>May 2026</span>
          </div>
        </div>
      </div>

      <div className="container article-body">

        <p className="article-lead">
          Every morning at Habibi Halal Express, before the first customer arrives, our pitmaster does one thing:
          he tastes the kofta blend. Just a small pinch, raw, off the mixing bowl. If it's not right, we don't open.
          That's how seriously we take this dish.
        </p>

        <h2>It Starts the Night Before</h2>
        <p>
          Our lamb is never frozen. We source fresh, halal-certified ground lamb daily, and the preparation begins
          the evening before service. The fat ratio matters — too lean and the kofta dries out on the grill; too fatty
          and it loses structure. We've found our balance after years of testing.
        </p>
        <p>
          The spices are measured by hand. Not by weight, not by machine. By hand, every time. Our pitmaster has
          been making this blend long enough that his hands are the scale.
        </p>

        <h2>What Goes Into Every Kofta</h2>
        <p>We can't give you exact quantities — that stays with us. But we can tell you what's in it:</p>
        <ul className="article-checklist">
          {SPICES.map((s, i) => (
            <li key={i}><CheckCircle size={15} className="article-check" /> {s}</li>
          ))}
        </ul>

        <p>
          No fillers. No breadcrumbs. No artificial binders. The kofta holds its shape on the skewer because
          the lamb is fresh and the fat content is right — not because we've added anything to help it along.
        </p>

        <h2>Live Fire Only</h2>
        <p>
          We grill over charcoal. Not gas, not electric — charcoal. It takes longer to set up, it requires more
          skill to control, and it's harder to keep consistent. But the flavour it gives the kofta is impossible
          to replicate any other way.
        </p>
        <p>
          The outside chars slightly — that caramelised crust is where a lot of the flavour lives. The inside
          stays juicy. Getting that balance right on a live fire is a skill that takes years, and we're proud of
          the team that does it every single day.
        </p>

        <h2>Served the Right Way</h2>
        <p>
          Kofta off the grill goes straight onto rice or into a wrap — never held under a heat lamp, never
          reheated. We cook in batches timed to our order flow. If you've ever wondered why your kofta at
          Habibi tastes noticeably fresher than elsewhere, that's why.
        </p>

        <div className="article-cta-block">
          <p>Ready to taste it for yourself?</p>
          <Link to="/menu/platter" className="article-cta-btn">Order the Kofta Platter <Flame size={15} /></Link>
        </div>

      </div>

      <div className="article-more-section">
        <div className="container">
          <p className="article-more-eyebrow">READ MORE</p>
          <div className="article-more-links">
            <Link to="/kitchen-behind-the-scenes" className="article-more-card">Kitchen Behind the Scenes →</Link>
            <Link to="/articles/build-your-own" className="article-more-card">Build Your Own Story →</Link>
            <Link to="/articles/halal-certified" className="article-more-card">Our Halal Certification →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
