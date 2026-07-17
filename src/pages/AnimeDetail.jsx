import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Loader from '../components/Loader'

export default function AnimeDetail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const url = params.get('url')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeSeason, setActiveSeason] = useState(0)

  useEffect(() => {
    if (!url) return
    setLoading(true)
    setActiveSeason(0)
    fetch(`/api/anime/detail?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [url])

  function goWatch(epHref) {
    const wp = new URLSearchParams({ url: epHref })
    navigate(`/anime/watch?${wp}`)
  }

  if (!url) return <div className="page"><div className="error-box"><p>رابط غير صحيح</p></div></div>

  const season = data?.seasons?.[activeSeason]

  return (
    <div className="page">
      <button className="watch-back" onClick={() => navigate('/anime')}>
        ← العودة للأنمي
      </button>

      {loading && <Loader text="جاري تحميل تفاصيل الأنمي والحلقات..." />}
      {error && <div className="error-box"><p>{error}</p></div>}

      {data && !loading && (
        <>
          {/* ── Hero ── */}
          <div className="detail-hero">
            <div className="detail-poster">
              {data.poster ? (
                <img src={data.poster} alt={data.title} onError={e => e.target.style.display = 'none'} />
              ) : (
                <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:'5rem',background:'var(--bg3)' }}>⛩️</div>
              )}
            </div>

            <div className="detail-info">
              {data.imdb && (
                <div className="imdb-badge">
                  <span className="imdb-star">★</span>
                  <span className="imdb-score">{data.imdb}</span>
                  <span className="imdb-slash">/10</span>
                  <span className="imdb-label">IMDb</span>
                </div>
              )}

              <h1 className="detail-title">{data.title}</h1>

              {data.genres && data.genres.length > 0 && (
                <div className="detail-genres">
                  {data.genres.map((g, i) => <span key={i} className="genre-tag">{g}</span>)}
                </div>
              )}

              {data.description && (
                <div className="detail-desc">{data.description}</div>
              )}

              {data.meta && Object.keys(data.meta).length > 0 && (
                <div className="detail-meta-grid">
                  {Object.entries(data.meta).slice(0, 12).map(([k, v]) => (
                    <div key={k} className="meta-item">
                      <div className="meta-label">{k}</div>
                      <div className="meta-value">{v}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display:'flex',alignItems:'center',gap:8,color:'var(--text2)',fontSize:'0.9rem',marginTop:8 }}>
                <span>⛩️</span>
                <span>
                  {data.seasons.length} موسم — {data.seasons.reduce((acc, s) => acc + s.episodes.length, 0)} حلقة
                </span>
              </div>
            </div>
          </div>

          {/* ── Season poster cards ── */}
          {data.seasons.length > 0 && (
            <div className="section">
              <div className="section-title">📋 المواسم</div>
              <div className="seasons-cards-row">
                {data.seasons.map((s, i) => (
                  <div
                    key={i}
                    className={`season-card${activeSeason === i ? ' active' : ''}`}
                    onClick={() => setActiveSeason(i)}
                  >
                    <div className="season-card-img">
                      {s.poster
                        ? <img src={s.poster} alt={s.title} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
                        : null
                      }
                      <div className="season-card-placeholder" style={{ display: s.poster ? 'none' : 'flex' }}>⛩️</div>
                      {activeSeason === i && <div className="season-card-active-bar" />}
                    </div>
                    <div className="season-card-body">
                      <div className="season-card-name">الموسم {s.seasonNum || (i + 1)}</div>
                      <div className="season-card-count">{s.episodes.length} حلقة</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Episodes of active season ── */}
          {season && (
            <div className="section">
              <div className="section-title">🎬 حلقات الموسم {season.seasonNum || (activeSeason + 1)}</div>
              <div className="episodes-grid">
                {season.episodes.map((ep, i) => {
                  const epNum = ep.epNum || i + 1
                  const seasonNum = season.seasonNum || activeSeason + 1
                  return (
                    <div key={i} className="ep-card" onClick={() => goWatch(ep.href)}>
                      <div className="ep-card-num">S{String(seasonNum).padStart(2,'0')}E{String(epNum).padStart(2,'0')}</div>
                      <div className="ep-card-info">
                        <div className="ep-card-title">{ep.title || `الحلقة ${epNum}`}</div>
                      </div>
                      <span className="ep-card-play">▶</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
