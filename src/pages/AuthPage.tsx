import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

type Tab = 'login' | 'register';

const ERROR_TEXT: Record<string, string> = {
  invalid_email: 'Некорректный email',
  weak_password: 'Пароль должен быть не короче 6 символов',
  email_taken: 'Этот email уже занят',
  bad_credentials: 'Неверный email или пароль',
  unauthorized: 'Требуется авторизация',
  email_required: 'Укажите email',
};

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    return ERROR_TEXT[err.payload?.error] ?? `Ошибка ${err.status}`;
  }
  if (err instanceof TypeError) return 'Сервер недоступен';
  return 'Что-то пошло не так';
}

export default function AuthPage() {
  const { login, register, social } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (tab === 'login') await login(email.trim(), password);
      else await register(email.trim(), password, nickname.trim() || undefined);
      navigate('/train', { replace: true });
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  async function socialLogin(provider: string, label: string) {
    setError('');
    setBusy(true);
    try {
      const mail = email.trim() || `${provider}@print.hero`;
      await social(provider, mail, nickname.trim() || undefined);
      navigate('/train', { replace: true });
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__box card">
        <h1 className="auth__title">Печать героя</h1>
        <p className="auth__tagline">Киберпанк-тренажёр слепой печати</p>

        <div className="auth__tabs">
          <button
            type="button"
            className={`auth__tab${tab === 'login' ? ' auth__tab--active' : ''}`}
            onClick={() => setTab('login')}
          >
            Вход
          </button>
          <button
            type="button"
            className={`auth__tab${tab === 'register' ? ' auth__tab--active' : ''}`}
            onClick={() => setTab('register')}
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={submit}>
          {error && <p className="form__error">{error}</p>}

          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="hero@print.hero"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          {tab === 'register' && (
            <label className="field">
              <span className="field__label">Позывной (необязательно)</span>
              <input
                className="input"
                type="text"
                autoComplete="nickname"
                placeholder="Неон"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </label>
          )}

          <label className="field">
            <span className="field__label">Пароль</span>
            <input
              className="input"
              type="password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Синхронизация…' : tab === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="divider">или</div>

        <div className="auth__social">
          <button className="social" type="button" disabled={busy} onClick={() => socialLogin('google', 'Google')}>
            <span className="social__icon">◉</span> Google
          </button>
          <button className="social" type="button" disabled={busy} onClick={() => socialLogin('github', 'GitHub')}>
            <span className="social__icon">◈</span> GitHub
          </button>
          <button className="social" type="button" disabled={busy} onClick={() => socialLogin('vk', 'VK')}>
            <span className="social__icon">◐</span> VK
          </button>
        </div>

        <p className="form__hint center">
          Продолжая, вы соглашаетесь с правилами киберпанк-сети «Печать героя».
        </p>
      </div>
    </div>
  );
}
