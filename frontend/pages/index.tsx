// frontend/pages/index.tsx - WITH AUTHENTICATION
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { LogIn, UserPlus, Users, Terminal } from 'lucide-react';

const countries = [
  { name: 'United States', code: 'US', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺' },
  { name: 'India', code: 'IN', flag: '🇮🇳' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪' },
  { name: 'France', code: 'FR', flag: '🇫🇷' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵' },
  { name: 'China', code: 'CN', flag: '🇨🇳' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
  { name: 'Mexico', code: 'MX', flag: '🇲🇽' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹' },
  { name: 'Russia', code: 'RU', flag: '🇷🇺' },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷' },
  { name: 'Singapore', code: 'SG', flag: '🇸🇬' },
  { name: 'UAE', code: 'AE', flag: '🇦🇪' },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦' },
  { name: 'Pakistan', code: 'PK', flag: '🇵🇰' },
  { name: 'Bangladesh', code: 'BD', flag: '🇧🇩' },
  { name: 'Sri Lanka', code: 'LK', flag: '🇱🇰' },
  { name: 'Other', code: 'GL', flag: '🌍' },
];

export default function Home() {
  const [view, setView] = useState<'choice' | 'guest' | 'login' | 'signup'>('choice');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const [country, setCountry] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const router = useRouter();

  const addToast = (text: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const savedUsername = localStorage.getItem('username');

    if (token && savedUsername) {
        setUsername(savedUsername);
        setGender(localStorage.getItem('gender') || 'other');
        setCountry(localStorage.getItem('country') || 'Unknown');
        setIsLoggedIn(true);
        setView('guest'); // Show room selection screen, don't auto-redirect
    }
  }, []);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('username', data.username);
        const genderVal = data.gender || 'other';
        const countryVal = data.country || 'Unknown';
        localStorage.setItem('gender', genderVal);
        localStorage.setItem('country', countryVal);
        if (data.avatar) localStorage.setItem('avatar', data.avatar);
        if (data.bio) localStorage.setItem('bio', data.bio);
        if (data.displayName) localStorage.setItem('displayName', data.displayName);

        setUsername(data.username);
        setGender(genderVal);
        setCountry(countryVal);
        setIsLoggedIn(true);

        // Auto-join general chat
        router.push({
          pathname: '/room/general chat',
          query: {
            username: data.username,
            gender: genderVal,
            country: countryVal,
          }
        });
      } else {
        const errorMessage = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        addToast('Login failed: ' + (errorMessage || 'Please try again'));
      }
    } catch (error) {
      addToast('Login error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!username || !email || !password || !gender || !country) {
      addToast('Please fill all fields');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          gender,
          country,
          displayName: displayName || username,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        addToast('Account created! Please login.');
        setView('login');
        setPassword(''); // Clear password
      } else {
        const errorMessage = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        addToast('Signup failed: ' + (errorMessage || 'Please try again'));
      }
    } catch (error) {
      addToast('Signup error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = () => {
    if (!username.trim()) return addToast('Please enter a username');
    if (!gender) return addToast('Please select your gender');
    if (!country) return addToast('Please select your country');

    const room = 'general chat';
    router.push({
      pathname: `/room/${room}`,
      query: {
        username: username.trim(),
        gender,
        country,
      }
    });
  };

  const handleGuestLogin = () => {
    // Clear any previous registered user session data so guest doesn't inherit identity
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('gender');
    localStorage.removeItem('country');
    localStorage.removeItem('avatar');
    localStorage.removeItem('bio');
    localStorage.removeItem('displayName');
    localStorage.removeItem('status');
    localStorage.removeItem('age');

    setUsername('');
    setGender('other');
    setCountry('Unknown');
    setIsLoggedIn(false);
    setView('guest');
  };

  const handleDevOwnerLogin = () => {
    setUsername('admin_owner');
    setGender('other');
    setCountry('Other');
    setView('guest');
  };

  // Choice Screen
  if (view === 'choice') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
        <div className="relative max-w-md w-full px-4">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur-xl opacity-30"></div>

          <div className="relative bg-gray-900 bg-opacity-90 backdrop-blur-sm p-10 rounded-2xl shadow-2xl border border-gray-800">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-block p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-4">
                <span className="text-3xl">💬</span>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Welcome to Global Chat
              </h1>
              <p className="text-gray-400 text-sm mt-2">Choose how to continue</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setView('login')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all transform hover:scale-105"
              >
                <LogIn className="w-5 h-5" />
                Login with Account
              </button>

              <button
                onClick={() => setView('signup')}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all transform hover:scale-105"
              >
                <UserPlus className="w-5 h-5" />
                Create New Account
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900 text-gray-400">or</span>
                </div>
              </div>

              <button
                onClick={handleGuestLogin}
                className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-all transform hover:scale-105"
              >
                <Users className="w-5 h-5" />
                Continue as Guest
              </button>
            </div>

            <div className="mt-8 pt-4 border-t border-gray-800 text-center">
              <button onClick={handleDevOwnerLogin} className="text-xs text-green-400 hover:text-green-300 flex items-center justify-center mx-auto gap-1">
                <Terminal className="w-3 h-3" /> Developer: Login as Owner
              </button>
            </div>

            <div className="text-center mt-6">
              <p className="text-xs text-gray-500">
                By continuing, you agree to our community guidelines
              </p>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // Login Screen
  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
        <div className="relative max-w-md w-full px-4">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur-xl opacity-30"></div>

          <div className="relative bg-gray-900 bg-opacity-90 backdrop-blur-sm p-10 rounded-2xl shadow-2xl border border-gray-800">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
              <p className="text-gray-400 text-sm mt-2">Login to your account</p>
            </div>

            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </button>
              <button
                onClick={() => setView('choice')}
                className="w-full py-2 text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Signup Screen
  if (view === 'signup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
        <div className="relative max-w-md w-full px-4">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur-xl opacity-30"></div>

          <div className="relative bg-gray-900 bg-opacity-90 backdrop-blur-sm p-10 rounded-2xl shadow-2xl border border-gray-800">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white">Create Account</h2>
              <p className="text-gray-400 text-sm mt-2">Join the global conversation</p>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <input
                type="text"
                placeholder="Username (unique, cannot change)"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-purple-500"
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={20}
              />
              <input
                type="text"
                placeholder="Display Name (shown to others)"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-purple-500"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                maxLength={30}
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-purple-500"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-purple-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />

              <div className="space-y-2">
                <label className="text-sm text-gray-300 font-medium">Gender</label>
                <div className="grid grid-cols-3 gap-2">
                  {['male', 'female', 'other'].map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`p-3 rounded-lg border transition-all ${gender === g
                        ? 'bg-purple-900 border-purple-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                    >
                      <div className="flex flex-col items-center space-y-1">
                        <span className="text-xl">
                          {g === 'male' ? '♂️' : g === 'female' ? '♀️' : '⚧'}
                        </span>
                        <span className="text-xs font-medium capitalize">{g}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <select
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white outline-none focus:ring-2 focus:ring-purple-500"
                value={country}
                onChange={e => setCountry(e.target.value)}
              >
                <option value="">Select Country</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSignup}
                disabled={isLoading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Sign Up'}
              </button>
              <button
                onClick={() => setView('choice')}
                className="w-full py-2 text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Guest/Room Selection Screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur-xl opacity-30"></div>

        <div className="relative bg-gray-900 bg-opacity-90 backdrop-blur-sm p-10 rounded-2xl shadow-2xl border border-gray-800 w-96 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-block p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full">
              <span className="text-3xl">💬</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Global Chat
            </h1>
            <p className="text-gray-400 text-sm">Join conversations worldwide</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-300 font-medium flex items-center">
                <span className="bg-gray-800 p-1 rounded mr-2">👤</span>
                Username
              </label>
              <input
                type="text"
                placeholder="Enter your display name"
                className={`w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isLoggedIn ? 'opacity-70 cursor-not-allowed' : ''}`}
                value={username}
                onChange={e => !isLoggedIn && setUsername(e.target.value)}
                readOnly={isLoggedIn}
                disabled={isLoggedIn}
                maxLength={20}
              />
              {isLoggedIn && (
                <p className="text-xs text-gray-500 mt-1">Username cannot be changed for registered accounts</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300 font-medium flex items-center">
                <span className="bg-gray-800 p-1 rounded mr-2">⚧</span>
                Gender
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['male', 'female', 'other'].map((g) => (
                  <button
                    key={g}
                    onClick={() => !isLoggedIn && setGender(g)}
                    disabled={isLoggedIn}
                    className={`p-3 rounded-lg border transition-all ${gender === g
                      ? 'bg-blue-900 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
                      }`}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <span className="text-xl">
                        {g === 'male' ? '♂️' : g === 'female' ? '♀️' : '⚧'}
                      </span>
                      <span className="text-xs font-medium capitalize">{g}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300 font-medium flex items-center">
                <span className="bg-gray-800 p-1 rounded mr-2">🌍</span>
                Country
              </label>
              <div className="relative">
                <select
                  className={`w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white appearance-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all pr-10 ${isLoggedIn ? 'opacity-70 cursor-not-allowed' : ''}`}
                  value={country}
                  onChange={e => !isLoggedIn && setCountry(e.target.value)}
                  disabled={isLoggedIn}
                >
                  <option value="" className="bg-gray-800">Select your country</option>
                  {countries.map((c) => (
                    <option key={c.code} value={c.name} className="bg-gray-800">
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <span className="text-gray-500">▼</span>
                </div>
              </div>
              {country && (
                <div className="flex items-center space-x-2 text-sm text-gray-400">
                  <span>Selected:</span>
                  <span className="text-white">
                    {countries.find(c => c.name === country)?.flag} {country}
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={joinRoom}
            disabled={!username || !gender || !country}
            className={`w-full py-3 rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] ${username && gender && country
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
          >
            {username && gender && country ? (
              <div className="flex items-center justify-center space-x-2">
                <span>🎯</span>
                <span>Join Chat Room</span>
              </div>
            ) : (
              'Complete all fields'
            )}
          </button>

          <button
            onClick={() => setView('choice')}
            className="w-full py-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Change login method
          </button>

          <div className="text-center pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              By joining, you agree to our community guidelines
            </p>
          </div>
        </div>
      </div>

      <div className="fixed top-5 right-5 space-y-3 z-50">
        {toasts.map(toast => (
          <div key={toast.id} className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-slide-in-right max-w-sm">
            {toast.text}
          </div>
        ))}
      </div>

    </div>
  );
}
