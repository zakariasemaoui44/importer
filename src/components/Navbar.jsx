import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [searchOpen, setSearchOpen]       = useState(false)
  const [query, setQuery]                 = useState('')
  const [suggestions, setSuggestions]     = useState([])
  const [sugLoading, setSugLoading]       = useState(false)
  const [sugVisible, setSugVisible]       = useState(false)

  const inputRef    = useRef(null)
  const wrapperRef  = useRef(null)
  const debounceRef = useRef(null)

  // Focus input when search bar opens
  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus()
  }, [searchOpen])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setSugVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced live suggestions
  const fetchSuggestions = useCallback((q) => {
    if (!q || q.trim().length < 2) {
      setSuggestions([])
      setSugVisible(false)
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSugLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        const data = await res.json()
        setSuggestions((data.results || []).slice(0, 12))
        setSugVisible(true)
      } catch {
        setSuggestions([])
      } finally {
        setSugLoading(false)
      }
    }, 320)
  }, [])

  function handleQueryChange(e) {
    const val = e.target.value
    setQuery(val)
    fetchSuggestions(val)
  }

  function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setSugVisible(false)
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    closeSearch()
  }

  function handleSuggestionClick(item) {
    setSugVisible(false)
    closeSearch()
    const params = new URLSearchParams({ url: item.href })
    navigate(`/${item.type}/detail?${params}`)
  }

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
    setSuggestions([])
    setSugVisible(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') closeSearch()
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          ستريم<span>هب</span>
        </Link>

        {searchOpen ? (
          <div className="navbar-search-wrap" ref={wrapperRef}>
            <form className="navbar-search-form" onSubmit={handleSearch}>
              <input
                ref={inputRef}
                className="navbar-search-input"
                type="text"
                placeholder="ابحث عن فيلم أو مسلسل..."
                value={query}
                onChange={handleQueryChange}
                onKeyDown={handleKeyDown}
                autoComplete="off"
              />
              <button type="submit" className="navbar-search-btn">🔍</button>
              <button type="button" className="navbar-search-close" onClick={closeSearch}>✕</button>
            </form>

            {/* ── Suggestions Dropdown ── */}
            {sugVisible && (
              <div className="sug-dropdown">
                {sugLoading && (
                  <div className="sug-loading">جاري البحث...</div>
                )}
                {!sugLoading && suggestions.length === 0 && (
                  <div className="sug-empty">لا توجد نتائج</div>
                )}
                {!sugLoading && suggestions.length > 0 && (
                  <div className="sug-grid">
                    {suggestions.map((item, i) => (
                      <div
                        key={i}
                        className="sug-card"
                        onClick={() => handleSuggestionClick(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && handleSuggestionClick(item)}
                      >
                        <div className="sug-poster">
                          {item.poster ? (
                            <img
                              src={item.poster}
                              alt={item.title}
                              loading="lazy"
                              onError={e => { e.target.style.display = 'none' }}
                            />
                          ) : (
                            <div className="sug-poster-placeholder">
                              {item.type === 'series' ? '📺' : '🎬'}
                            </div>
                          )}
                        </div>
                        <div className="sug-title">{item.title}</div>
                      </div>
                    ))}
                  </div>
                )}
                {!sugLoading && suggestions.length > 0 && (
                  <button
                    className="sug-see-all"
                    onClick={() => {
                      setSugVisible(false)
                      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
                      closeSearch()
                    }}
                  >
                    عرض كل النتائج لـ "{query}"
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <ul className="navbar-nav">
              <li><Link to="/" className={pathname === '/' ? 'active' : ''}>الرئيسية</Link></li>
              <li><Link to="/movies" className={pathname.startsWith('/movies') ? 'active' : ''}>الأفلام</Link></li>
              <li><Link to="/series" className={pathname.startsWith('/series') ? 'active' : ''}>المسلسلات</Link></li>
              <li><Link to="/anime" className={pathname.startsWith('/anime') ? 'active' : ''}>الأنمي</Link></li>
            </ul>
            <button className="navbar-search-toggle" onClick={() => setSearchOpen(true)} title="بحث">
              🔍
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
