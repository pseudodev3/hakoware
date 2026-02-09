import { useState, useEffect } from 'react';
import './LandingPage.css';
import { SkullIcon, CrownIcon, FlameIcon, TargetIcon } from '../components/icons/Icons';

const LandingPage = ({ onEnter }) => {
  const [currentSection, setCurrentSection] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const sections = [
    {
      id: 'hero',
      title: "HAKOWARE",
      subtitle: "CHAPTER 7: BANKRUPTCY",
      icon: <SkullIcon size={60} color="#ff4444" />,
      content: (
        <>
          <p className="hero-text">
            The world's first <span className="highlight">social accountability</span> platform 
            that turns ghosting your friends into a literal debt crisis.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-number" data-value="+1">+1</span>
              <span className="hero-stat-label">APR Per Day Ghosted</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-number" data-value="7">7</span>
              <span className="hero-stat-label">Days Until Debt</span>
            </div>
            <div className="hero-stat-divider" />
            <div className="hero-stat">
              <span className="hero-stat-number" data-value="∞">∞</span>
              <span className="hero-stat-label">Shame Possible</span>
            </div>
          </div>
        </>
      )
    },
    {
      id: 'rules',
      title: "HOW IT WORKS",
      subtitle: "THE RULES OF ENGAGEMENT",
      icon: <TargetIcon size={50} color="#ff8800" />,
      content: (
        <div className="rules-container">
          <div className="rule-item">
            <div className="rule-number">01</div>
            <div className="rule-content">
              <h3>Add Friends</h3>
              <p>Connect with people you actually want to stay in touch with.</p>
            </div>
            <div className="rule-icon-wrapper">👻</div>
          </div>
          <div className="rule-connector" />
          <div className="rule-item">
            <div className="rule-number">02</div>
            <div className="rule-content">
              <h3>Set Your Limit</h3>
              <p>How many days of silence before they start accumulating debt?</p>
            </div>
            <div className="rule-icon-wrapper">⏰</div>
          </div>
          <div className="rule-connector" />
          <div className="rule-item">
            <div className="rule-number">03</div>
            <div className="rule-content">
              <h3>Interest Accrues</h3>
              <p>Miss the limit? +1 APR (Aura Payable Rate) per day.</p>
            </div>
            <div className="rule-icon-wrapper">📈</div>
          </div>
          <div className="rule-connector" />
          <div className="rule-item danger">
            <div className="rule-number">04</div>
            <div className="rule-content">
              <h3>Face Bankruptcy</h3>
              <p>Hit the threshold? Official bankruptcy. Beg for mercy or pay up.</p>
            </div>
            <div className="rule-icon-wrapper">💀</div>
          </div>
        </div>
      )
    },
    {
      id: 'features',
      title: "FEATURES",
      subtitle: "TOOLS OF THE TRADE",
      icon: <FlameIcon size={50} color="#ffd700" />,
      content: (
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-bg">
              <CrownIcon size={28} color="#00e676" />
            </div>
            <h3>Achievements</h3>
            <p>Unlock plaques for your financial disasters and victories</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-bg">
              <TargetIcon size={28} color="#ff8800" />
            </div>
            <h3>Bounty Board</h3>
            <p>Place bounties on ghosting friends. Hunt them down.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-bg">
              <SkullIcon size={28} color="#ff4444" />
            </div>
            <h3>Wall of Shame</h3>
            <p>Public bankruptcies. Roast your friends. Be roasted.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-bg">
              <FlameIcon size={28} color="#ffd700" />
            </div>
            <h3>Voice Check-ins</h3>
            <p>Send voice notes to prove you're actually checking in</p>
          </div>
        </div>
      )
    },
    {
      id: 'enter',
      title: "ENTER THE VOID",
      subtitle: "NO GHOSTING ALLOWED",
      icon: null,
      content: (
        <>
          <p className="hero-text final">
            Ready to hold yourself and your friends accountable?
            <br />
            <span className="highlight">The debt collectors are waiting.</span>
          </p>
          <button className="enter-button" onClick={onEnter}>
            <span className="enter-button-text">BEGIN YOUR JOURNEY</span>
            <span className="enter-button-glow" />
          </button>
          <p className="disclaimer">
            By entering, you acknowledge that bankruptcy is forever and 
            your friends will absolutely make fun of you.
          </p>
        </>
      )
    }
  ];

  const nextSection = () => {
    if (currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  return (
    <div className="landing-container">
      {/* Animated Background */}
      <div className="bg-grid" />
      <div className="bg-glow" style={{
        background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,215,0,0.06), transparent 40%)`
      }} />
      <div className="bg-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div 
            key={i} 
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${10 + Math.random() * 10}s`
            }}
          />
        ))}
      </div>

      {/* Logo Header */}
      <header className="landing-header">
        <div className="logo">
          <span className="logo-icon">👹</span>
          <span className="logo-text">HAKOWARE</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="landing-main">
        <div className={`content-wrapper section-${sections[currentSection].id}`}>
          {/* Section Icon */}
          {sections[currentSection].icon && (
            <div className="section-icon-wrapper">
              {sections[currentSection].icon}
              <div className="section-icon-glow" />
            </div>
          )}
          
          {/* Section Number */}
          <div className="section-number">
            <span className="section-current">0{currentSection + 1}</span>
            <span className="section-divider" />
            <span className="section-total">0{sections.length}</span>
          </div>
          
          {/* Title */}
          <h1 className="section-title glitch" data-text={sections[currentSection].title}>
            {sections[currentSection].title}
          </h1>
          
          {/* Subtitle */}
          <p className="section-subtitle">
            {sections[currentSection].subtitle}
          </p>
          
          {/* Content */}
          <div className="section-content">
            {sections[currentSection].content}
          </div>
        </div>
      </main>

      {/* Navigation */}
      <div className="landing-nav">
        <button 
          className="nav-btn" 
          onClick={prevSection}
          disabled={currentSection === 0}
        >
          <span className="nav-arrow">←</span>
          <span>PREV</span>
        </button>
        
        <div className="nav-dots">
          {sections.map((section, idx) => (
            <button
              key={section.id}
              className={`nav-dot ${idx === currentSection ? 'active' : ''}`}
              onClick={() => setCurrentSection(idx)}
              title={section.id}
            />
          ))}
        </div>
        
        {currentSection < sections.length - 1 ? (
          <button className="nav-btn primary" onClick={nextSection}>
            <span>NEXT</span>
            <span className="nav-arrow">→</span>
          </button>
        ) : (
          <button className="nav-btn cta" onClick={onEnter}>
            <span>ENTER</span>
            <span className="nav-arrow">→</span>
          </button>
        )}
      </div>

      {/* Footer Ticker */}
      <footer className="landing-footer">
        <div className="ticker">
          <div className="ticker-content">
            <span>FAILURE TO PAY WILL RESULT IN EXCOMMUNICATION</span>
            <span className="ticker-dot">•</span>
            <span>INTEREST COMPOUNDS DAILY</span>
            <span className="ticker-dot">•</span>
            <span>BANKRUPTCY IS FOREVER</span>
            <span className="ticker-dot">•</span>
            <span>CHECK IN OR CHECK OUT</span>
            <span className="ticker-dot">•</span>
            <span>YOUR FRIENDS ARE WATCHING</span>
            <span className="ticker-dot">•</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
