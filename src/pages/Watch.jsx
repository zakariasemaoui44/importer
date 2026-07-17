import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Loader from '../components/Loader'

// ─── تحميل مكتبة من CDN (مرة واحدة فقط) ────────────────────────────────────
function loadScript(src, globalKey) {
  return new Promise(resolve => {
    if (window[globalKey]) { resolve(window[globalKey]); return }
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window[globalKey]))
      existing.addEventListener('error', () => resolve(null))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.onload  = () => resolve(window[globalKey] || true)
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
}

function loadHlsJs()  { return loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js', 'Hls') }
function loadPlyr()   { return loadScript('https://cdn.plyr.io/3.7.8/plyr.js', 'Plyr') }

// إضافة CSS لـ Plyr مرة واحدة
function ensurePlyrCss() {
  if (document.querySelector('link[data-plyr-css]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://cdn.plyr.io/3.7.8/plyr.css'
  link.setAttribute('data-plyr-css', '1')
  document.head.appendChild(link)
}

// بناء رابط بروكسي HLS — يُمرَّر من خلال سيرفرنا مع Referer صحيح
function buildHlsProxyUrl(src, referer) {
  const params = new URLSearchParams({ url: src })
  if (referer) params.set('ref', referer)
  return `/api/hls-proxy?${params}`
}

export default function Watch({ type }) {
  const [params] = useSearchParams()
  const navigate  = useNavigate()
  const url = params.get('url')

  const [data,          setData]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [activeIdx,     setActiveIdx]     = useState(0)
  const [playerLoading, setPlayerLoading] = useState(false)

  const videoRef = useRef(null)
  const hlsRef   = useRef(null)

  const endpoint = type === 'movie'  ? '/api/movies/watch'
    : type === 'series' ? '/api/series/watch'
    : '/api/anime/watch'

  const backPath = type === 'movie'  ? '/movies'
    : type === 'series' ? '/series'
    : '/anime'

  const backLabel = type === 'movie'  ? 'الأفلام'
    : type === 'series' ? 'المسلسلات'
    : 'الأنمي'

  // ── جلب بيانات السيرفرات ──────────────────────────────────────────────────
  useEffect(() => {
    if (!url) return
    setLoading(true); setError(null); setActiveIdx(0); setData(null)
    fetch(`${endpoint}?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [url])

  const plyrRef = useRef(null)

  // ── تهيئة Plyr + HLS عند تغيير السيرفر النشط ─────────────────────────────
  useEffect(() => {
    const server = allServers[activeIdx]
    if (!server?.src || (!isHls(server.src) && !isMp4(server.src))) return

    setPlayerLoading(true)
    const video = videoRef.current
    if (!video) return

    // دمّر المشغلات السابقة
    if (hlsRef.current)  { hlsRef.current.destroy();  hlsRef.current  = null }
    if (plyrRef.current) { try { plyrRef.current.destroy() } catch {} plyrRef.current = null }

    ensurePlyrCss()

    const init = async () => {
      const [Hls, Plyr] = await Promise.all([loadHlsJs(), loadPlyr()])

      if (isHls(server.src)) {
        const proxiedSrc = buildHlsProxyUrl(server.src, server.referer || '')

        if (Hls && Hls.isSupported()) {
          const hls = new Hls({ enableWorker: false, maxBufferLength: 30 })
          hlsRef.current = hls
          hls.loadSource(proxiedSrc)
          hls.attachMedia(video)
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (Plyr) {
              plyrRef.current = new Plyr(video, {
                controls: ['play-large','play','progress','current-time','mute','volume','captions','settings','fullscreen'],
                settings: ['quality','speed'],
                ratio: '16:9',
              })
            }
            setPlayerLoading(false)
            video.play().catch(() => {})
          })
          hls.on(Hls.Events.ERROR, (_, d) => {
            if (d.fatal) { hls.destroy(); hlsRef.current = null; setPlayerLoading(false) }
          })
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = proxiedSrc
          video.load()
          if (Plyr) plyrRef.current = new Plyr(video, { ratio: '16:9' })
          setPlayerLoading(false)
          video.play().catch(() => {})
        }
      } else {
        // MP4 / WebM — مشغّل Plyr مباشر
        if (Plyr) {
          plyrRef.current = new Plyr(video, {
            controls: ['play-large','play','progress','current-time','mute','volume','captions','settings','fullscreen'],
            settings: ['speed'],
            ratio: '16:9',
          })
        }
        setPlayerLoading(false)
      }
    }

    init()

    return () => {
      if (hlsRef.current)  { hlsRef.current.destroy();  hlsRef.current  = null }
      if (plyrRef.current) { try { plyrRef.current.destroy() } catch {} plyrRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, data])

  // ─────────────────────────────────────────────────────────────────────────
  function getServerColor(label) {
    const l = (label || '').toLowerCase()
    if (l.includes('updown') || l.includes('متعدد')) return '#387c44'
    if (l.includes('dood') || l.includes('ds2play')) return '#e53935'
    if (l.includes('streamtape')) return '#f57c00'
    if (l.includes('voe')) return '#7b1fa2'
    if (l.includes('upstream')) return '#0288d1'
    if (l.includes('uqload')) return '#00838f'
    if (l.includes('mixdrop')) return '#5d4037'
    if (l.includes('streamwish') || l.includes('filelions')) return '#2e7d32'
    if (l.includes('vidhide')) return '#283593'
    if (l.includes('vidguard') || l.includes('vgfplay')) return '#ad1457'
    if (l.includes('ok.ru')) return '#1565c0'
    if (l.includes('hls') || l.includes('m3u8')) return '#00695c'
    if (l.includes('mp4')) return '#37474f'
    return '#555e7a'
  }

  function inferLabel(src, i) {
    if (!src) return `خادم ${i + 1}`
    if (src.includes('dood') || src.includes('ds2play')) return 'Dood'
    if (src.includes('streamtape') || src.includes('streamtp')) return 'StreamTape'
    if (src.includes('voe.sx')) return 'Voe'
    if (src.includes('upstream')) return 'UpStream'
    if (src.includes('uqload')) return 'UQLoad'
    if (src.includes('mixdrop')) return 'MixDrop'
    if (src.includes('streamwish') || src.includes('filelions')) return 'StreamWish'
    if (src.includes('vidhide')) return 'VidHide'
    if (src.includes('vidguard') || src.includes('vgfplay')) return 'VidGuard'
    if (src.includes('ok.ru')) return 'OK.ru'
    if (src.includes('.m3u8')) return 'HLS'
    if (src.includes('.mp4')) return 'MP4'
    if (src.includes('updown')) return 'UpDown'
    return `خادم ${i + 1}`
  }

  function isHls(src)         { return /\.m3u8(\?|$)/i.test(src || '') }
  function isMp4(src)         { return /\.(mp4|webm)(\?|$)/i.test(src || '') }
  function isDirectVideo(src) { return isHls(src) || isMp4(src) }

  // ── بناء قائمة السيرفرات الموحدة ─────────────────────────────────────────
  const allServers = data ? (() => {
    const seen = new Set()
    const list = []
    const add = (label, src, color, extra = {}) => {
      const key = src || label
      if (!key || seen.has(key)) return
      seen.add(key)
      list.push({
        label: label || inferLabel(src, list.length),
        color: color || getServerColor(label || src),
        src:   src || '',
        ...extra,
      })
    }
    ;(data.servers || []).forEach(s =>
      add(s.label || inferLabel(s.src, list.length), s.src, s.color,
          { isEmbed: s.isEmbed, referer: s.referer })
    )
    ;(data.iframes || []).forEach((src) => add(inferLabel(src, list.length), src, null))
    ;(data.playerLinks || []).forEach(l => add(l.label || 'خادم', l.href, null))
    return list
  })() : []

  const activeServer = allServers[activeIdx]

  // ── عند اختيار سيرفر جديد: ضبط حالة التحميل ────────────────────────────
  function selectServer(i) {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    setActiveIdx(i)
    setPlayerLoading(true)
  }

  // ── رندر المشغل ───────────────────────────────────────────────────────────
  function renderPlayer() {
    if (!activeServer) {
      return (
        <div className="player-placeholder">
          <span style={{ fontSize: '3rem' }}>📡</span>
          <p>لم يتم العثور على روابط مشاهدة</p>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
               className="btn btn-primary" style={{ marginTop: 12 }}>
              فتح صفحة المشاهدة الأصلية ↗
            </a>
          )}
        </div>
      )
    }

    if (!activeServer.src) {
      return (
        <div className="player-placeholder">
          <span style={{ fontSize: '3rem' }}>🔗</span>
          <p>لم يتم استخراج رابط هذا السيرفر تلقائياً</p>
          <a
            href={url?.endsWith('/watch/') ? url : (url?.endsWith('/') ? url + 'watch/' : url + '/watch/')}
            target="_blank" rel="noopener noreferrer"
            className="btn btn-primary" style={{ marginTop: 12 }}>
            فتح صفحة المشاهدة ↗
          </a>
        </div>
      )
    }

    // ── Embed URL (isEmbed: true) ─────────────────────────────────────────
    // نحمّل الـ iframe مباشرة بدون proxy بالضبط كما يفعل topcinemaa.com.
    // معظم المشغلات (streamwish, dood, streamtape, mixdrop) لا تملك
    // X-Frame-Options فتعمل بشكل كامل داخل iframe مباشر.
    // referrerPolicy="origin" يرسل الصفحة الحالية كـ Referer.
    if (activeServer.isEmbed) {
      return (
        <>
          {playerLoading && (
            <div className="player-overlay-loading">
              <div className="watch-spinner" />
              <span>{activeServer.label} — جاري التحميل...</span>
            </div>
          )}
          <iframe
            key={`embed-${activeIdx}-${activeServer.src}`}
            src={activeServer.src}
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            scrolling="no"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            onLoad={() => setPlayerLoading(false)}
            onError={() => setPlayerLoading(false)}
            style={{ opacity: playerLoading ? 0 : 1, transition: 'opacity 0.3s ease' }}
          />
        </>
      )
    }

    // ── HLS (.m3u8) أو MP4 — مشغل Plyr (يُبنى في useEffect) ──────────────
    if (isHls(activeServer.src) || isMp4(activeServer.src)) {
      return (
        <>
          {playerLoading && (
            <div className="player-overlay-loading">
              <div className="watch-spinner" />
              <span>{activeServer.label} — جاري التحميل...</span>
            </div>
          )}
          <video
            ref={videoRef}
            key={`video-${activeIdx}-${activeServer.src}`}
            controls
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', background: '#000',
                     opacity: playerLoading ? 0 : 1, transition: 'opacity 0.3s' }}
            onLoadedData={() => setPlayerLoading(false)}
            onError={()    => setPlayerLoading(false)}
          >
            {isMp4(activeServer.src) && (
              <source
                src={activeServer.src}
                type={activeServer.src.includes('.webm') ? 'video/webm' : 'video/mp4'}
              />
            )}
          </video>
        </>
      )
    }

    // ── Fallback: iframe مباشر (نهاية الخيارات) ───────────────────────────
    return (
      <>
        {playerLoading && (
          <div className="player-overlay-loading">
            <div className="watch-spinner" />
            <span>{activeServer.label} — جاري التحميل...</span>
          </div>
        )}
        <iframe
          key={`fallback-${activeIdx}-${activeServer.src}`}
          src={activeServer.src}
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          scrolling="no"
          referrerPolicy="no-referrer"
          onLoad={() => setPlayerLoading(false)}
          onError={() => setPlayerLoading(false)}
          style={{ opacity: playerLoading ? 0 : 1, transition: 'opacity 0.3s ease' }}
        />
      </>
    )
  }

  if (!url) return <div className="page"><div className="error-box"><p>رابط غير صحيح</p></div></div>

  return (
    <div className="watch-page">
      {/* شريط أعلى الصفحة */}
      <div className="watch-topbar">
        <button className="watch-back-btn" onClick={() => navigate(-1)}>
          ← {backLabel}
        </button>
        {data?.title && <div className="watch-topbar-title">{data.title}</div>}
      </div>

      {loading && <Loader text="جاري تحميل روابط المشاهدة..." />}
      {error   && <div className="error-box" style={{ margin: '20px auto', maxWidth: 600 }}><p>{error}</p></div>}

      {data && !loading && (
        <div className="watch-layout">

          {/* ── المشغل ── */}
          <div className="watch-player-wrap">
            <div className="player-container" style={{ position: 'relative' }}>
              {renderPlayer()}
            </div>
          </div>

          {/* ── قائمة السيرفرات ── */}
          {allServers.length > 0 && (
            <div className="watch-servers-panel">
              <div className="watch-servers-title">
                <span>🖥️</span>
                <span>اختر السيرفر</span>
                <span className="watch-servers-count">{allServers.length}</span>
              </div>
              <div className="watch-servers-grid">
                {allServers.map((s, i) => (
                  <button
                    key={i}
                    className={[
                      'watch-server-btn',
                      activeIdx === i   ? 'watch-server-btn--active' : '',
                      !s.src            ? 'watch-server-btn--empty'  : '',
                      s.isEmbed         ? 'watch-server-btn--embed'  : '',
                    ].filter(Boolean).join(' ')}
                    style={{ '--srv-color': s.color }}
                    onClick={() => selectServer(i)}
                    title={s.src || 'رابط غير متاح'}
                  >
                    <span className="watch-server-dot" style={{ background: s.color }} />
                    <span className="watch-server-label">{s.label}</span>
                    {isHls(s.src)  && <span className="watch-server-badge">HLS</span>}
                    {isMp4(s.src)  && <span className="watch-server-badge">MP4</span>}
                    {!s.src        && <span className="watch-server-na">!</span>}
                  </button>
                ))}
              </div>

              {activeServer?.src && (
                <div className="watch-server-info">
                  <span>السيرفر الحالي: <strong>{activeServer.label}</strong></span>
                  <a href={activeServer.src} target="_blank" rel="noopener noreferrer"
                     className="watch-open-direct">
                    فتح مباشر ↗
                  </a>
                </div>
              )}
            </div>
          )}

          {/* ── لا سيرفرات ── */}
          {allServers.length === 0 && (
            <div className="watch-servers-panel" style={{ textAlign: 'center', padding: 32 }}>
              <p style={{ color: 'var(--text2)', marginBottom: 16 }}>
                لم يتم العثور على سيرفرات تلقائياً
              </p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                فتح صفحة المشاهدة الأصلية ↗
              </a>
            </div>
          )}

          {/* ── التنقل بين الحلقات ── */}
          {(data.prevEp || data.nextEp) && (
            <div className="watch-nav-eps">
              {data.prevEp && (
                <button className="watch-nav-btn watch-nav-btn--prev" onClick={() =>
                  navigate(`${backPath}/watch?${new URLSearchParams({ url: data.prevEp })}`)
                }>‹ الحلقة السابقة</button>
              )}
              {data.nextEp && (
                <button className="watch-nav-btn watch-nav-btn--next" onClick={() =>
                  navigate(`${backPath}/watch?${new URLSearchParams({ url: data.nextEp })}`)
                }>الحلقة التالية ›</button>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
