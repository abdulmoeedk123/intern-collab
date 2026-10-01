import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
const Ctx = createContext(); export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [ready, setReady] = useState(false);
  useEffect(() => { (localStorage.getItem('token') ? api('/auth/me').then(d => setUser(d.user)).catch(() => {}) : Promise.resolve()).finally(() => setReady(true)); }, []);
  const sign = async (p, body) => { const d = await api(p, { method: 'POST', body }); localStorage.setItem('token', d.token); setUser(d.user); };
  const logout = () => { localStorage.removeItem('token'); setUser(null); };
  return <Ctx.Provider value={{ user, ready, logout, login: b => sign('/auth/login', b), register: b => sign('/auth/register', b) }}>{children}</Ctx.Provider>;
}
