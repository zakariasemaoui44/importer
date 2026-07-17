import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Loader from '../components/Loader'

export default function MovieDetail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const url = params.get('url')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!url) return
    setLoading(true)
    fetch(`/api/movies/detail?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [url])

  function goWatch() {
    const wp = new URLSearchParams({ url: data.watchUrl })
    navigate(`/movies/watch?${wp}`)
  }

  if (!url) return <div className="page"><div className="error-box"><p>رابط غير صحيح</p></div></div>

  return (
    <div className="page">
      <button className="watch-back" onClick={() => navigate('/movies')}>
        ← العودة للأفلام
      </button>

      {loading && <Loader text="جاري تحميل تفاصيل الفيلم..." />}
      {error && <div className="error-box"><p>{error}</p></div>}

      {data && !loading && (
        <>
          <div className="detail-hero">
            <div className="detail-poster">
              {data.poster ? (
                <img src={data.poster} alt={data.title} onError={e => e.target.style.display = 'none'} />
              ) : (
                <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:'5rem',background:'var(--bg3)' }}>🎬</div>
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

              {data.genres.length > 0 && (
                <div className="detail-genres">
                  {data.genres.map((g, i) => <span key={i} className="genre-tag">{g}</span>)}
                </div>
              )}

              {data.description && (
                <div className="detail-desc">{data.description}</div>
              )}

              {Object.keys(data.meta).length > 0 && (
                <div className="detail-meta-grid">
                  {Object.entries(data.meta).slice(0, 12).map(([k, v]) => (
                    <div key={k} className="meta-item">
                      <div className="meta-label">{k}</div>
                      <div className="meta-value">{v}</div>
                    </div>
                  ))}
                </div>
              )}

              <button className="watch-btn" onClick={goWatch}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                اضغط للمشاهدة
              </button>
            </div>
          </div>

          {data.cast.length > 0 && (
            <div className="section">
              <div className="section-title">🎭 طاقم الممثلين</div>
              <div className="cast-grid">
                {data.cast.slice(0, 20).map((actor, i) => (
                  <div key={i} className="cast-item">
                    <div className="cast-avatar">
                      {actor.image ? (
                        <img src={actor.image} alt={actor.name} onError={e => e.target.style.display = 'none'} />
                      ) : (
                        <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:'1.5rem' }}>👤</div>
                      )}
                    </div>
                    <div className="cast-name">{actor.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
