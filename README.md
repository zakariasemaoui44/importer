# Stream Hub

مشغّل أفلام ومسلسلات وأنمي — يسحب المحتوى من topcinemaa.com و ristoanime.co

## التثبيت والتشغيل

```bash
# 1. تثبيت الحزم
npm install

# 2. تشغيل الخادم والواجهة معاً (وضع التطوير)
npm run dev
```

- الواجهة الأمامية: http://localhost:5173
- خادم API:       http://localhost:3001

## أوامر مفيدة

| الأمر | الوصف |
|-------|-------|
| `npm run dev` | تشغيل الواجهة والخادم معاً |
| `npm run server` | تشغيل خادم API فقط |
| `npm run client` | تشغيل Vite فقط |
| `npm run build` | بناء الواجهة للإنتاج |
| `npm start` | تشغيل الإنتاج (يخدم dist/) |

## البنية

```
stream-hub/
├── index.html              # نقطة دخول Vite
├── vite.config.js          # إعداد Vite + Proxy → port 3001
├── package.json
├── server/
│   ├── index.js            # خادم Express (port 3001)
│   └── scrapers/
│       ├── browser.js      # axios helpers (fetchPage, fetchPost, fetchJson)
│       ├── movies.js       # سكرابر الأفلام — topcinemaa.com
│       ├── series.js       # سكرابر المسلسلات — topcinemaa.com
│       └── anime.js        # سكرابر الأنمي — ristoanime.co
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── components/
    │   ├── Navbar.jsx
    │   ├── MediaCard.jsx
    │   └── Loader.jsx
    └── pages/
        ├── Home.jsx
        ├── Movies.jsx / MovieDetail.jsx
        ├── Series.jsx / SeriesDetail.jsx
        ├── Anime.jsx  / AnimeDetail.jsx
        ├── Watch.jsx
        └── Search.jsx
```

## المصادر

| المصدر | المحتوى |
|--------|---------|
| topcinemaa.com | أفلام ومسلسلات عربية وأجنبية |
| ristoanime.co | أنمي مترجم |
