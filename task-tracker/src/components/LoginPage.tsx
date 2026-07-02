import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { LogIn, UserPlus, Loader2, Target } from 'lucide-react';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          setError(error.message === 'User already registered'
            ? 'Пользователь с таким email уже существует'
            : error.message);
        } else {
          setSuccess('Регистрация успешна! Теперь войдите в систему.');
          setIsSignUp(false);
          setFullName('');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message === 'Invalid login credentials'
            ? 'Неверный email или пароль'
            : error.message);
        }
      }
    } catch (err: unknown) {
      setError('Произошла ошибка: ' + (err instanceof Error ? err.message : String(err)));
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mx-auto mb-4">
            <Target className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">
            АРМ Управление мониторинга за строительством объектов теплоснабжения МО
          </h1>
          <p className="text-slate-500 mt-3">Войдите в систему для продолжения</p>
        </div>

        {/* Форма */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            {isSignUp ? 'Регистрация' : 'Вход в систему'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ФИО</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition bg-white"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 font-medium"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : isSignUp ? (
                <>
                  <UserPlus size={20} /> Зарегистрироваться
                </>
              ) : (
                <>
                  <LogIn size={20} /> Войти
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          После регистрации вам будет назначена роль «Гость».<br />
          Администратор повысит ваши права при необходимости.
        </p>
      </div>
    </div>
  );
}