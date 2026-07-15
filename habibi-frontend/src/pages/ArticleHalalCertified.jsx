import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Shield, CheckCircle } from 'lucide-react';
import SEO from '../components/SEO';
import './ArticleDetail.css';

const WHAT_IT_MEANS = [
  'Every animal is slaughtered by a Muslim following Islamic guidelines',
  'The animal must be healthy and alive at the time of slaughter',
  'The name of Allah is invoked before each slaughter',
  'Blood is fully drained from the carcass',
  'No cross-contamination with non-halal products throughout the supply chain',
  'Regular audits by a certified halal authority',
];

export default function ArticleHalalCertified() {
  return (
    <div className="article-page">
      <SEO
        title="Halal Certified: What It Means and Why It Matters | Habibi Halal Express"
        description="Habibi Halal Express explains what halal certification really means, how we maintain it, and why it matters for every customer."
        keywords="halal certified bronx, what is halal, halal food standards, habibi halal"
      />

      <div className="article-hero" style={{ backgroundImage: "url('/images/logos/halal-certified-premium.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="article-hero-overlay" />
        <div className="container article-hero-content">
          <Link to="/articles" className="article-back"><ArrowLeft size={15} /> Back to Articles</Link>
          <span className="article-category">Our Values</span>
          <h1 className="article-title">Halal Certified: What It Means and Why It Matters to Us</h1>
          <p className="article-subtitle">Our Commitment to Standards You Can Trust</p>
          <div className="article-meta">
            <span><Clock size={13} /> 6 min read</span>
            <span>March 2026</span>
          </div>
        </div>
      </div>

      <div className="container article-body">

        <p className="article-lead">
          We use the word "halal" every day. It's in our name. But we think it's worth taking a moment
          to explain exactly what that means — not just as a label, but as a practice that shapes
          everything we do at Habibi Halal Express.
        </p>

        <h2>What Halal Actually Means</h2>
        <p>
          "Halal" is an Arabic word meaning "permissible" or "lawful." In the context of food, it refers
          to products that comply with Islamic dietary law. For meat, this involves specific requirements
          around the sourcing, slaughter, and handling of animals.
        </p>
        <p>
          But halal isn't just about the slaughter process. It's about the entire supply chain — from the
          farm to your plate. An animal can be slaughtered correctly but still not be halal if it was
          raised on prohibited feed, or if the meat was contaminated during processing.
        </p>

        <div className="article-highlight-box">
          <Shield size={22} className="article-highlight-icon" />
          <div>
            <h4>Our Certification</h4>
            <p>All proteins at Habibi Halal Express are sourced from halal-certified suppliers and verified
            through regular third-party audits. We maintain documentation for every supplier and batch.</p>
          </div>
        </div>

        <h2>What Our Certification Covers</h2>
        <ul className="article-checklist">
          {WHAT_IT_MEANS.map((item, i) => (
            <li key={i}><CheckCircle size={15} className="article-check" /> {item}</li>
          ))}
        </ul>

        <h2>Why It Matters — Even If You're Not Muslim</h2>
        <p>
          A significant portion of our customers aren't Muslim. They choose Habibi because the food is
          good — and because they know our standards are high. Halal certification is a quality standard
          as much as it is a religious one.
        </p>
        <p>
          Halal meat requires careful handling, cleanliness, and traceability. Those same standards
          produce better food for everyone. It's one of the reasons our ingredients taste as fresh as
          they do.
        </p>

        <h2>Our Commitment Going Forward</h2>
        <p>
          As we grow, our halal standards are non-negotiable. Every new supplier goes through the same
          vetting process. Every location maintains the same certification. There are no shortcuts
          and there never will be.
        </p>
        <p>
          If you ever have a question about our sourcing or certification, walk up to the counter and ask.
          We're an open kitchen and we have nothing to hide.
        </p>

        <div className="article-cta-block">
          <p>Have questions about our standards? We're happy to talk.</p>
          <Link to="/contact" className="article-cta-btn">Contact Us <ArrowLeft size={15} style={{ transform: 'rotate(180deg)' }} /></Link>
        </div>

      </div>

      <div className="article-more-section">
        <div className="container">
          <p className="article-more-eyebrow">READ MORE</p>
          <div className="article-more-links">
            <Link to="/articles/lamb-kofta-secret" className="article-more-card">The Secret Behind Our Kofta →</Link>
            <Link to="/kitchen-behind-the-scenes" className="article-more-card">Kitchen Behind the Scenes →</Link>
            <Link to="/our-journey" className="article-more-card">Our Journey →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
