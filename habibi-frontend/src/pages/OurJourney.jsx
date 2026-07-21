import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star, ArrowRight, Heart, Users, Award } from 'lucide-react';
import SEO from '../components/SEO';
import { VIDEOS, VideoCard } from './videoData';
import './Videos.css';
import './SubVideoPage.css';

const videos = VIDEOS.filter(v => v.category === 'Our Locations');

const MILESTONES = [
  {
    year: '2018',
    title: 'The First Window',
    desc: 'Habibi Halal Express opens its first location on Bedford Park Blvd in the Bronx. It starts small — a single window, a tight team, and a big belief that the Bronx deserved better halal food. Lines form from day one.',
  },
  {
    year: '2020',
    title: 'Through the Hardest Year',
    desc: 'When the pandemic shut the city down, we stayed open. We fed healthcare workers, families, and neighbours who had nowhere else to turn. It wasn\'t just about business — it was about community. This year defined who we are.',
  },
  {
    year: '2022',
    title: 'Second Location Opens',
    desc: 'The demand from the Kingsbridge area had been building for years. We listened. Our second location brought Habibi closer to thousands more Bronx residents — students, families, and everyone in between.',
  },
  {
    year: '2023',
    title: 'Build Your Own Launches',
    desc: 'We introduced the Build Your Own meal — letting customers mix and match proteins, toppings, and sauces. It became an instant hit and changed how people thought about ordering halal food.',
  },
  {
    year: '2024',
    title: 'Three Locations Strong',
    desc: 'The White Plains Road corridor gets its own Habibi. Three locations across the borough, one uncompromising standard. More people than ever can access the food they love without travelling across the Bronx.',
  },
];

const VALUES = [
  {
    icon: <Heart size={24} />,
    title: 'Community First',
    desc: 'Every decision we make starts with one question: is this good for our community? The Bronx gave us everything — we give back by showing up every day.',
  },
  {
    icon: <Award size={24} />,
    title: 'Uncompromising Quality',
    desc: 'We have never and will never compromise on food quality or halal standards. What we served on day one is the same standard we hold today — no exceptions.',
  },
  {
    icon: <Users size={24} />,
    title: 'A Family Operation',
    desc: 'Habibi is built by a tight-knit team that treats each other like family. That warmth is something our customers feel the moment they walk up to the window.',
  },
  {
    icon: <MapPin size={24} />,
    title: 'Rooted in the Bronx',
    desc: 'We\'re not a franchise, not a chain. We\'re a Bronx business, through and through. Every location is locally run and staffed by people who live in this borough.',
  },
];

export default function OurJourney() {
  return (
    <div className="videos-page svp-page">
      <SEO
        title="Our Journey | Habibi Halal Express"
        description="The story of Habibi Halal Express — from a single window in the Bronx to a growing community institution. See how we got here."
        keywords="habibi halal story, bronx halal restaurant history, our journey"
      />

      {/* Hero */}
      <section className="svp-hero svp-hero--journey">
        <div className="svp-hero-overlay" />
        <div className="svp-hero-content">
          <span className="svp-eyebrow"><MapPin size={13} /> OUR STORY</span>
          <h1 className="svp-hero-title">Our <span className="svp-accent">Journey</span></h1>
          <p className="svp-hero-sub">
            From a single window in the Bronx to a growing community institution.
            This is how Habibi Halal Express came to be — and where we're headed.
          </p>
          <div className="svp-hero-tags">
            <span className="svp-tag"><MapPin size={12} /> The Bronx</span>
            <span className="svp-tag">Est. 2018</span>
            <span className="svp-tag"><Star size={12} /> 3 Locations</span>
          </div>
        </div>
      </section>

      {/* Origin story */}
      <section className="section svp-section">
        <div className="container svp-origin-block">
          <div className="svp-origin-text">
            <p className="svp-section-eyebrow">WHERE IT STARTED</p>
            <h2 className="svp-section-title">A Simple Idea, an Unshakeable Standard</h2>
            <p className="svp-body-text">
              Habibi Halal Express was born from a straightforward belief: the Bronx deserved halal food
              that was genuinely good. Not just edible — actually great. The kind of food that tastes
              like it was made with pride, because it was.
            </p>
            <p className="svp-body-text">
              Our founder grew up understanding that food is more than fuel. It's identity, it's comfort,
              it's how communities come together. Habibi was built to be that gathering point — a place
              where quality and culture meet on every plate.
            </p>
            <p className="svp-body-text">
              Six years on, the mission hasn't changed. The locations have grown, the menu has expanded,
              but the standard in the kitchen is exactly the same as the day we first opened that window.
            </p>
          </div>
          <div className="svp-origin-quote">
            <blockquote className="svp-blockquote">
              "We didn't open Habibi to run a restaurant. We opened it to feed our community the way
              they deserve to be fed — with care, with quality, and with heart."
              <cite>— Habibi Halal Express, Founder</cite>
            </blockquote>
          </div>
        </div>
      </section>

      {/* Milestones */}
      <section className="section svp-section svp-section--alt">
        <div className="container">
          <p className="svp-section-eyebrow">TIMELINE</p>
          <h2 className="svp-section-title">How We Got Here</h2>
          <div className="svp-milestones">
            {MILESTONES.map((m, i) => (
              <div key={i} className="svp-milestone">
                <div className="svp-milestone-year">{m.year}</div>
                <div className="svp-milestone-body">
                  <h4 className="svp-milestone-title">{m.title}</h4>
                  <p className="svp-milestone-desc">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section svp-section">
        <div className="container">
          <p className="svp-section-eyebrow">WHAT WE STAND FOR</p>
          <h2 className="svp-section-title">Our Values</h2>
          <div className="svp-process-grid">
            {VALUES.map((v, i) => (
              <div key={i} className="svp-process-card">
                <div className="svp-process-icon">{v.icon}</div>
                <h4 className="svp-process-title">{v.title}</h4>
                <p className="svp-process-desc">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location videos */}
      {videos.length > 0 && (
        <section className="section svp-section svp-section--alt">
          <div className="container">
            <p className="svp-section-eyebrow">OUR LOCATIONS</p>
            <h2 className="svp-section-title">Tour Our Spots</h2>
            <div className="vid-grid">
              {videos.map((v, i) => <VideoCard key={i} video={v} large={i === 0} />)}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="svp-cta-strip">
        <p className="svp-cta-text">Come be a part of the story.</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/locations" className="svp-cta-btn">Find a Location <ArrowRight size={15} /></Link>
          <Link to="/menu" className="svp-cta-btn svp-cta-btn--outline">Order Now</Link>
        </div>
      </section>
    </div>
  );
}
