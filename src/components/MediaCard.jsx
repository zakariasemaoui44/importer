import { useNavigate } from 'react-router-dom'

export default function MediaCard({ item, type }) {
  const navigate = useNavigate()

  function handleClick() {
    const params = new URLSearchParams({ url: item.href })
    navigate(`/${type}/detail?${params}`)
  }

  return (
    <div className="media-card" onClick={handleClick}>
      <div className="media-card-poster">
        {item.poster ? (
          <img src={item.poster} alt={item.title} loading="lazy" onError={e => { e.target.style.display = 'none' }} />
        ) : (
          <div className="media-card-poster-placeholder">🎬</div>
        )}
        {item.quality && <span className="media-card-badge">{item.quality}</span>}
      </div>
      <div className="media-card-body">
        <div className="media-card-title">{item.title}</div>
        <div className="media-card-meta">
          {item.year && <span className="media-card-year">{item.year}</span>}
          {item.quality && <span className="media-card-quality">{item.quality}</span>}
          {item.eps && <span className="media-card-year">{item.eps} حلقة</span>}
        </div>
      </div>
    </div>
  )
}
