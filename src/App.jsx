import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Movies from './pages/Movies'
import MovieDetail from './pages/MovieDetail'
import Series from './pages/Series'
import SeriesDetail from './pages/SeriesDetail'
import Anime from './pages/Anime'
import AnimeDetail from './pages/AnimeDetail'
import Watch from './pages/Watch'
import Search from './pages/Search'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/movies/detail" element={<MovieDetail />} />
          <Route path="/movies/watch" element={<Watch type="movie" />} />
          <Route path="/series" element={<Series />} />
          <Route path="/series/detail" element={<SeriesDetail />} />
          <Route path="/series/watch" element={<Watch type="series" />} />
          <Route path="/anime" element={<Anime />} />
          <Route path="/anime/detail" element={<AnimeDetail />} />
          <Route path="/anime/watch" element={<Watch type="anime" />} />
          <Route path="/search" element={<Search />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
