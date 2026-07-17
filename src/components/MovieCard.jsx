import { useNavigate } from 'react-router-dom'

export default function MovieCard({ item, type = 'movie' }) {
  const navigate = useNavigate()

  function handleClick() {
    const base = type === 'series' ? '/series' : type === 'anime' ? '/anime' : '/movies'
    navigate(`${base}/detail?url=${encodeURIComponent(item.href)}`)
  }

  return (
    <div className="card" onClick={handleClick} role="button" tabIndex={0}
         onKeyDown={e => e.key === 'Enter' && handleClick()}>
      <div className="card-poster">
        {item.poster
          ? <img src={item.poster} alt={item.title} loading="lazy" />
          : <div className="card-poster-placeholder">🎬</div>}
        {item.quality && <span className="card-quality">{item.quality}</span>}
        {item.year    && <span className="card-year">{item.year}</span>}
      </div>
      <div className="card-info">
        <p className="card-title">{item.title}</p>
      </div>
    </div>
  )
}
