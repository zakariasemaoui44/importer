import { useState, useEffect, useRef } from 'react'
import MediaCard from '../components/MediaCard'
import Loader from '../components/Loader'

export default function Movies() {
  const [data, setData]         = useState(null)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [filters, setFilters]   = useState({ categories: [], genres: [] })
  const [selCat, setSelCat]     = useState('')
  const [selGenre, setSelGenre] = useState('')
  const [openDrop, setOpenDrop] = useState(null) // 'cat' | 'genre' | null
  const dropRef = useRef(null)

  // Load filter options once
  useEffect(() => {
    fetch('/api/movies/filters')
      .then(r => r.json())
      .then(d => setFilters(d))
      .catch(() => {})
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpenDrop(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function loadPage(p, cat, genre) {
    setLoading(true)
    setError(null)
    setData(null)
    const params = new URLSearchParams({ page: p })
    if (cat)   params.set('category', cat)
    if (genre) params.set('genre', genre)
    fetch(`/api/movies?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { loadPage(page, selCat, selGenre) }, [page, selCat, selGenre])

  function goPage(p) {
    if (p === page) return
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function applyFilter(type, term, name) {
    setOpenDrop(null)
    setPage(1)
    if (type === 'cat')   { setSelCat(term);   }
    if (type === 'genre') { setSelGenre(term);  }
  }

  const catLabel   = filters.categories.find(c => c.term === selCat)?.name   || 'تصنيفات'
  const genreLabel = filters.genres.find(g => g.term === selGenre)?.name      || 'الانواع'
  const hasFilters = selCat || selGenre

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">الأفلام</h1>
      </div>

      {/* ── Filter Bar ── */}
      <div className="filter-bar" ref={dropRef}>
        <div className="filter-group">
          {/* Category dropdown */}
          <div className={`filter-dropdown ${openDrop === 'cat' ? 'open' : ''}`}>
            <button className="filter-btn" onClick={() => setOpenDrop(openDrop === 'cat' ? null : 'cat')}>
              <span>{catLabel}</span>
              <i className="chevron">▾</i>
            </button>
            {openDrop === 'cat' && (
              <ul className="filter-menu">
                <li className={!selCat ? 'active' : ''} onClick={() => applyFilter('cat', '', 'الكل')}>الكل</li>
                {filters.categories.map(c => (
                  <li key={c.term} className={selCat === c.term ? 'active' : ''} onClick={() => applyFilter('cat', c.term, c.name)}>{c.name}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Genre dropdown */}
          <div className={`filter-dropdown ${openDrop === 'genre' ? 'open' : ''}`}>
            <button className="filter-btn" onClick={() => setOpenDrop(openDrop === 'genre' ? null : 'genre')}>
              <span>{genreLabel}</span>
              <i className="chevron">▾</i>
            </button>
            {openDrop === 'genre' && (
              <ul className="filter-menu">
                <li className={!selGenre ? 'active' : ''} onClick={() => applyFilter('genre', '', 'الكل')}>الكل</li>
                {filters.genres.map(g => (
                  <li key={g.term} className={selGenre === g.term ? 'active' : ''} onClick={() => applyFilter('genre', g.term, g.name)}>{g.name}</li>
                ))}
              </ul>
            )}
          </div>

          {hasFilters && (
            <button className="filter-clear" onClick={() => { setSelCat(''); setSelGenre(''); setPage(1) }}>
              ✕ مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {loading && <Loader text="جاري تحميل الأفلام..." />}

      {error && (
        <div className="error-box">
          <p>حدث خطأ: {error}</p>
          <button className="btn btn-primary" onClick={() => loadPage(page, selCat, selGenre)}>إعادة المحاولة</button>
        </div>
      )}

      {data && !loading && (
        <>
          {data.movies?.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🎬</div>
              <h3>لا توجد نتائج</h3>
              <p>جرّب تصنيفاً أو نوعاً مختلفاً</p>
            </div>
          ) : (
            <div className="media-grid">
              {(data.movies || []).map((m, i) => (
                <MediaCard key={i} item={m} type="movies" />
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
