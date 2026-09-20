import { Clapperboard, Compass, Home as HomeIcon, Search as SearchIcon } from 'lucide-react';
import { NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Search from './pages/Search';
import Details from './pages/Details';
import Watch from './pages/Watch';
import Archive from './pages/Archive';

function Navigation() {
  const links = [
    { to: '/', label: 'Home', icon: HomeIcon },
    { to: '/search', label: 'Search', icon: SearchIcon },
    { to: '/archive', label: 'Free', icon: Compass },
  ];

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <Clapperboard size={26} />
          <span>StreamBox</span>
        </NavLink>

        <nav className="desktop-nav">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>

        <span className="legal-pill">
          Licensed / public-domain playback
        </span>
      </header>

      <nav className="bottom-nav">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Navigation />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/title/:type/:id" element={<Details />} />
          <Route path="/watch/:source/:id" element={<Watch />} />
        </Routes>
      </main>
    </div>
  );
}
