import { useState, useEffect } from 'react'
import MediaCard from '../components/MediaCard'
import Loader from '../components/Loader'

export default function Anime() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function loadPage(p) {
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/anime?page=${p}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => {
    loadPage(page)
  }, [page])

  function goPage(p) {
    if (p === page) return
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">الأنمي</h1>
      </div>

      {loading && <Loader text="جاري تحميل الأنمي... قد يستغرق هذا لحظة" />}

      {error && (
        <div className="error-box">
          <p>حدث خطأ: {error}</p>
          <button className="btn btn-primary" onClick={() => loadPage(page)}>إعادة المحاولة</button>
        </div>
      )}

      {data && !loading && (
        <>
          {data.anime.length === 0 ? (
            <div className="empty-state">
              <div className="icon">⛩️</div>
              <h3>لا توجد نتائج</h3>
              <p>جاري جلب الأنمي، يرجى المحاولة مرة أخرى</p>
            </div>
          ) : (
            <div className="media-grid">
              {data.anime.map((a, i) => (
                <MediaCard key={i} item={a} type="anime" />
              ))}
            </div>
          )}

          {data.totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={() => goPage(Math.max(1, page - 1))} disabled={page === 1}>‹</button>
              {Array.from({ length: Math.min(data.totalPages, 10) }, (_, i) => i + 1).map(p => (
                <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => goPage(p)}>{p}</button>
              ))}
              {data.totalPages > 10 && <span style={{ color: 'var(--text2)' }}>...</span>}
              <button className="page-btn" onClick={() => goPage(Math.min(data.totalPages, page + 1))} disabled={page === data.totalPages}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
