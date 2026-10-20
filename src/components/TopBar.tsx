import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div className="logo">
        <span className="logo__mark">П</span>
        <span>Печать героя</span>
      </div>

      <nav className="topbar__nav">
        <NavLink to="/train" className={({ isActive }) => `topbar__link${isActive ? ' topbar__link--active' : ''}`}>
          Тренировка
        </NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => `topbar__link${isActive ? ' topbar__link--active' : ''}`}>
          Таблица лидеров
        </NavLink>
        <NavLink
          to="/achievements"
          className={({ isActive }) => `topbar__link${isActive ? ' topbar__link--active' : ''}`}
        >
          Достижения
        </NavLink>
        {user && (
          <NavLink
            to="/profile"
            className={({ isActive }) => `topbar__link${isActive ? ' topbar__link--active' : ''}`}
          >
            Профиль
          </NavLink>
        )}
      </nav>

      <div className="topbar__spacer" />

      {user ? (
        <>
          <div className="userchip" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
            <span className="userchip__avatar">{user.nickname.slice(0, 1).toUpperCase()}</span>
            <span className="userchip__name">{user.nickname}</span>
            <span className="userchip__level">LVL {user.level}</span>
          </div>
          <button className="btn btn--ghost" onClick={logout}>
            Выйти
          </button>
        </>
      ) : (
        <button className="btn btn--primary" onClick={() => navigate('/login')}>
          Войти
        </button>
      )}
    </header>
  );
}
