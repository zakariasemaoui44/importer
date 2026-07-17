export default function Loader({ text = 'جاري التحميل...' }) {
  return (
    <div className="loader-wrap">
      <div className="loader" />
      <p className="loader-text">{text}</p>
    </div>
  )
}
