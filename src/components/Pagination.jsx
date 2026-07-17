export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  const pages = []
  const start = Math.max(1, page - 2)
  const end   = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="pagination">
      <button onClick={() => onChange(1)} disabled={page === 1}>«</button>
      <button onClick={() => onChange(page - 1)} disabled={page === 1}>‹</button>
      {start > 1 && <span className="pagination-dots">…</span>}
      {pages.map(p => (
        <button key={p} onClick={() => onChange(p)}
                className={p === page ? 'pagination-active' : ''}>
          {p}
        </button>
      ))}
      {end < totalPages && <span className="pagination-dots">…</span>}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages}>›</button>
      <button onClick={() => onChange(totalPages)} disabled={page === totalPages}>»</button>
    </div>
  )
}
