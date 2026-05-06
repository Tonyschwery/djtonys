import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaInstagram, FaYoutube, FaEnvelope, FaMusic, FaPlayCircle, FaGlobe, FaSpotify, FaSoundcloud } from 'react-icons/fa';
import './App.css';

const textContent = {
  en: {
    heroTagline: 'DJ | VJ | Producer | Sound Engineer',
    aboutTitle: 'About Me',
    aboutText: "Born in Beirut, I am a Lebanese DJ, VJ, and record producer with over 20 years of experience crafting unforgettable sonic and visual journeys. I have released tracks on prestigious labels like Inkognito Records, Sensual Ibiza, and Blackhole Records. Known for my deep expertise across all genres—especially the 70s, 80s, and 90s—I have played at premier clubs and festivals across the Middle East and Europe, always driven by a passion to move crowds and push the boundaries of electronic music.",
    musicTitle: 'Latest Mixes',
    videoTitle: 'Visuals & Live Sets',
    upcomingTitle: 'Upcoming Release',
    spotifyTitle: 'Original Releases',
    contactTitle: 'Get In Touch',
    contactText: "Available for bookings, studio sessions, and collaborations worldwide.",
  },
  ar: {
    heroTagline: 'دي جي | في جي | منتج | مهندس صوت',
    aboutTitle: 'نبذة عني',
    aboutText: "ولدت في بيروت، وأنا دي جي وفي جي ومنتج موسيقي لبناني أمتلك أكثر من 20 عاماً من الخبرة في صياغة رحلات صوتية وبصرية لا تُنسى. أصدرت العديد من المقاطع الموسيقية مع شركات إنتاج مرموقة مثل Inkognito Records و Sensual Ibiza و Blackhole Records. أُعرف بخبرتي العميقة في جميع أنواع الموسيقى، خاصة موسيقى السبعينيات والثمانينيات والتسعينيات، وقد قدمت عروضاً في أرقى النوادي والمهرجانات في جميع أنحاء الشرق الأوسط وأوروبا، مدفوعاً دائماً بشغف تحريك الجماهير ودفع حدود الموسيقى الإلكترونية.",
    musicTitle: 'أحدث المقاطع الصوتية',
    videoTitle: 'مرئيات وعروض حية',
    upcomingTitle: 'الإصدار القادم',
    spotifyTitle: 'الإصدارات الأصلية',
    contactTitle: 'تواصل معي',
    contactText: "متاح للحجوزات وجلسات الاستوديو والتعاون في جميع أنحاء العالم.",
  }
};

function App() {
  const [lang, setLang] = useState('en');
  const [showEmailMenu, setShowEmailMenu] = useState(false);
  const t = textContent[lang];

  const email = "tonyschwery@proton.me";
  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}`;
  const outlookLink = `https://outlook.live.com/mail/0/deeplink/compose?to=${email}`;
  const yahooLink = `https://compose.mail.yahoo.com/?to=${email}`;
  const defaultLink = `mailto:${email}`;

  const toggleLang = () => {
    setLang(lang === 'en' ? 'ar' : 'en');
  };

  return (
    <div className={`app-container ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-logo">
          {/* Logo will be placed here */}
          <img src="/images/logo.jpg" alt="Tony Schwery - Premier Lebanese DJ in Doha Qatar" className="brand-logo" />
        </div>
        <button className="lang-toggle" onClick={toggleLang}>
          <FaGlobe size={18} />
          {lang === 'en' ? 'عربي' : 'EN'}
        </button>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          {/* Main DJ Photo */}
          <img src="/images/TONY SCHWERY EFFECT 1-MAIN-DESKTOP.jpg" alt="DJ Tony Schwery Performing Live at a Private Yacht Party in Doha, Qatar" className="bg-image" />
          <div className="overlay"></div>
        </div>
        
        <motion.div 
          className="hero-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          <h1 className="hero-title">TONY SCHWERY</h1>
          <p className="tagline">{t.heroTagline}</p>
          <div className="social-icons">
            <a href="https://www.instagram.com/djtonyschwery_music/" target="_blank" rel="noopener noreferrer" className="icon-link"><FaInstagram /></a>
            <a href="https://www.youtube.com/@TONYSCHWERY" target="_blank" rel="noopener noreferrer" className="icon-link"><FaYoutube /></a>
            <a href="https://soundcloud.com/tonyschwerymusic" target="_blank" rel="noopener noreferrer" className="icon-link"><FaSoundcloud /></a>
          </div>
        </motion.div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <div className="container about-grid">
          <motion.div 
            className="about-image"
            initial={{ opacity: 0, x: lang === 'en' ? -50 : 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <img src="/images/Screenshot_20250331_140132_CapCut.jpg" alt="Lebanese DJ Tony Schwery in the studio producing music in Qatar" />
          </motion.div>
          <motion.div 
            className="about-text"
            initial={{ opacity: 0, x: lang === 'en' ? 50 : -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2>{t.aboutTitle}</h2>
            <p>{t.aboutText}</p>
          </motion.div>
        </div>
      </section>

      {/* Music & Video Section */}
      <section className="media-section">
        <div className="container media-grid">
          <motion.div 
            className="media-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="card-header">
              <FaMusic className="card-icon" />
              <h3>{t.musicTitle}</h3>
            </div>
            {/* SoundCloud Embeds */}
            <div className="audio-list glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <iframe 
                width="100%" 
                height="166" 
                scrolling="no" 
                frameBorder="no" 
                allow="autoplay" 
                src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/tonyschwerymusic/afro-house-session-tape-2%3Fin%3Dtonyschwerymusic/sets/afro-house-sessions&color=%23fff200&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false&show_artwork=false"
                style={{ borderRadius: '8px' }}
              ></iframe>
              <iframe 
                width="100%" 
                height="166" 
                scrolling="no" 
                frameBorder="no" 
                allow="autoplay" 
                src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/tonyschwerymusic/organico-1-live-by-tony-schwery-november-2024-palm_jumairah%3Fin%3Dtonyschwerymusic/sets/afro-house-sessions&color=%23fff200&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false&show_artwork=false"
                style={{ borderRadius: '8px' }}
              ></iframe>
            </div>
          </motion.div>

          <motion.div 
            className="media-card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="card-header">
              <FaYoutube className="card-icon" />
              <h3>{t.videoTitle}</h3>
            </div>
            {/* YouTube Embed */}
            <div className="embed-container glass" style={{ display: 'block' }}>
              <iframe 
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/DmSDES7hAMg" 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                referrerPolicy="strict-origin-when-cross-origin" 
                allowFullScreen
              ></iframe>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Upcoming Release Section */}
      <section className="upcoming-section">
        <div className="container">
          <motion.div 
            className="spotify-container glass upcoming-card"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="card-header" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
              <FaSoundcloud className="card-icon" size={28} />
              <h2>{t.upcomingTitle}</h2>
            </div>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <iframe 
                width="100%" 
                height="450" 
                scrolling="no" 
                frameBorder="no" 
                allow="autoplay" 
                src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com/tonyschwerymusic/yalla-lets-dance&color=%23fff200&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=true&visual=true"
                style={{ borderRadius: '12px' }}
              ></iframe>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Spotify Section */}
      <section className="spotify-section">
        <div className="container">
          <motion.div 
            className="spotify-container glass"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="card-header" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
              <FaSpotify className="card-icon" size={28} style={{ color: '#1DB954' }} />
              <h2>{t.spotifyTitle}</h2>
            </div>
            <iframe 
              style={{ borderRadius: '12px' }} 
              src="https://open.spotify.com/embed/artist/4dR9Kt0Evg1vOxH7jERYMa?utm_source=generator&theme=0" 
              width="100%" 
              height="352" 
              frameBorder="0" 
              allowFullScreen="" 
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
              loading="lazy"
            ></iframe>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="contact-section">
        <div className="container">
          <motion.div 
            className="contact-box glass"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2>{t.contactTitle}</h2>
            <p>{t.contactText}</p>
            <div className="email-dropdown-container">
              <button className="btn-primary" onClick={() => setShowEmailMenu(!showEmailMenu)}>
                <FaEnvelope className="btn-icon" /> Email Me
              </button>

              <AnimatePresence>
                {showEmailMenu && (
                  <motion.div 
                    className="email-menu glass"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <a href={gmailLink} target="_blank" rel="noopener noreferrer" className="email-option">
                      Gmail
                    </a>
                    <a href={outlookLink} target="_blank" rel="noopener noreferrer" className="email-option">
                      Outlook Web
                    </a>
                    <a href={yahooLink} target="_blank" rel="noopener noreferrer" className="email-option">
                      Yahoo Mail
                    </a>
                    <a href={defaultLink} className="email-option">
                      Default Email App
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Tony Schwery. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;
