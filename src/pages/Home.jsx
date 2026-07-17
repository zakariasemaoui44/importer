import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

const CATEGORIES = [
  {
    to: '/movies',
    label: 'الأفلام',
    sublabel: 'Movies',
    desc: 'أفلام مترجمة ومدبلجة من جميع الأنواع والتصنيفات بجودة عالية',
    icon: '🎬',
    gradient: 'linear-gradient(135deg, #1a0a00 0%, #3d1a00 50%, #1a0a00 100%)',
    accent: '#ff6b35',
    glow: 'rgba(255,107,53,0.3)',
  },
  {
    to: '/series',
    label: 'المسلسلات',
    sublabel: 'Series',
    desc: 'تابع أحدث المسلسلات العربية والأجنبية والتركية مع جميع الحلقات',
    icon: '📺',
    gradient: 'linear-gradient(135deg, #00091a 0%, #001a3d 50%, #00091a 100%)',
    accent: '#3b82f6',
    glow: 'rgba(59,130,246,0.3)',
  },
  {
    to: '/anime',
    label: 'الأنمي',
    sublabel: 'Anime',
    desc: 'اكتشف عالم الأنمي مع مئات العناوين والحلقات المترجمة لجميع المواسم',
    icon: '⛩️',
    gradient: 'linear-gradient(135deg, #0d001a 0%, #2a003d 50%, #0d001a 100%)',
    accent: '#a855f7',
    glow: 'rgba(168,85,247,0.3)',
  },
]

export default function Home() {
  const [hovered, setHovered] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTimeout(() => setMounted(true), 50)
  }, [])

  return (
    <div className="sh-home">
      {/* ── Hero ── */}
      <div className={`sh-hero ${mounted ? 'sh-hero--in' : ''}`}>
        <div className="sh-hero-bg">
          <div className="sh-hero-grain" />
          <div className="sh-hero-orb sh-hero-orb1" />
          <div className="sh-hero-orb sh-hero-orb2" />
          <div className="sh-hero-orb sh-hero-orb3" />
        </div>
        <div className="sh-hero-content">
          <div className="sh-badge">
            <span className="sh-badge-dot" />
            <span>مكتبة ترفيهية متكاملة</span>
          </div>
          <h1 className="sh-hero-title">
            <span className="sh-hero-title-line1">عالمك</span>
            <span className="sh-hero-title-line2">الترفيهي</span>
            <span className="sh-hero-title-accent">بلا حدود</span>
          </h1>
          <p className="sh-hero-sub">
            أفلام · مسلسلات · أنمي — كل شيء في مكان واحد بجودة عالية وبدون انقطاع
          </p>
          <div className="sh-hero-actions">
            <Link to="/movies" className="sh-btn-primary">
              <span>🎬</span>
              <span>ابدأ المشاهدة</span>
            </Link>
            <Link to="/search" className="sh-btn-ghost">
              <span>🔍</span>
              <span>البحث</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Categories ── */}
      <div className="sh-categories-section">
        <div className="sh-section-header">
          <div className="sh-section-line" />
          <h2 className="sh-section-title">تصفح المحتوى</h2>
          <div className="sh-section-line" />
        </div>

        <div className="sh-cat-grid">
          {CATEGORIES.map((cat, idx) => (
            <Link
              key={cat.to}
              to={cat.to}
              className={`sh-cat-card ${hovered === idx ? 'sh-cat-card--hovered' : ''}`}
              style={{ '--cat-accent': cat.accent, '--cat-glow': cat.glow, '--cat-gradient': cat.gradient, animationDelay: `${idx * 0.12}s` }}
              onMouseEnter={() => setHovered(idx)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="sh-cat-bg" style={{ background: cat.gradient }} />
              <div className="sh-cat-glow" />
              <div className="sh-cat-border" />
              <div className="sh-cat-body">
                <div className="sh-cat-icon-wrap">
                  <span className="sh-cat-icon">{cat.icon}</span>
                </div>
                <div className="sh-cat-text">
                  <div className="sh-cat-sublabel">{cat.sublabel}</div>
                  <div className="sh-cat-label">{cat.label}</div>
                  <p className="sh-cat-desc">{cat.desc}</p>
                </div>
                <div className="sh-cat-arrow">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Features strip ── */}
      <div className="sh-features">
        {[
          { icon: '⚡', label: 'مشاهدة فورية', sub: 'بدون تسجيل' },
          { icon: '🌐', label: 'سيرفرات متعددة', sub: 'بديل دائماً متاح' },
          { icon: '📱', label: 'جميع الأجهزة', sub: 'موبايل وكمبيوتر' },
          { icon: '🎭', label: 'محتوى متنوع', sub: 'عربي وأجنبي وتركي' },
        ].map(f => (
          <div key={f.label} className="sh-feature-item">
            <span className="sh-feature-icon">{f.icon}</span>
            <div>
              <div className="sh-feature-label">{f.label}</div>
              <div className="sh-feature-sub">{f.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
