import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import MediaCard from '../components/MediaCard'
import Loader from '../components/Loader'

export default function Search() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q') || ''
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState(q)

  useEffect(() => {
    setQuery(q)
    if (!q) { setData(null); return }
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [q])

  function handleSubmit(e) {
    e.preventDefault()
    if (!query.trim()) return
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">البحث</h1>
        <form className="search-page-form" onSubmit={handleSubmit}>
          <input
            className="search-page-input"
            type="text"
            placeholder="ابحث عن فيلم أو مسلسل أو أنمي..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1rem' }}>
            بحث
          </button>
        </form>
      </div>

      {loading && <Loader text="جاري البحث..." />}
      {error && <div className="error-box"><p>حدث خطأ: {error}</p></div>}

      {!q && !loading && (
        <div className="empty-state">
          <div className="icon">🔍</div>
          <h3>ابحث عن أي شيء</h3>
          <p>اكتب اسم الفيلم أو المسلسل في مربع البحث</p>
        </div>
      )}

      {data && !loading && (
        <>
          {data.results.length === 0 ? (
            <div className="empty-state">
              <div className="icon">😕</div>
              <h3>لا توجد نتائج لـ "{q}"</h3>
              <p>جرّب كلمة بحث مختلفة</p>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--text2)', marginBottom: 24, fontSize: '0.9rem' }}>
                {data.results.length} نتيجة لـ "<strong style={{ color: 'var(--text)' }}>{q}</strong>"
              </p>
              <div className="media-grid">
                {data.results.map((item, i) => (
                  <MediaCard key={i} item={item} type={item.type} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
