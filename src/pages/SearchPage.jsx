import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import MovieCard from '../components/MovieCard.jsx'
import Loader    from '../components/Loader.jsx'

export default function SearchPage() {
  const [params]  = useSearchParams()
  const q         = params.get('q') || ''
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!q) return
    setLoading(true); setError(null); setData(null)
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [q])

  return (
    <div className="page">
      <h1 className="page-title">نتائج البحث: <span style={{ color: 'var(--accent)' }}>{q}</span></h1>
      {loading && <Loader text="جاري البحث..." />}
      {error   && <div className="error-box"><p>{error}</p></div>}
      {data && !loading && (
        <>
          <p style={{ color: 'var(--text2)', marginBottom: 20 }}>
            {data.results?.length || 0} نتيجة
          </p>
          <div className="cards-grid">
            {(data.results || []).map((r, i) => (
              <MovieCard key={i} item={r} type={r.type || 'movie'} />
            ))}
          </div>
          {(!data.results || data.results.length === 0) && (
            <div style={{ textAlign: 'center', color: 'var(--text2)', marginTop: 60 }}>
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</p>
              <p>لم يتم العثور على نتائج لـ "{q}"</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
