import { useEffect, useState } from 'react'
import { call } from '../lib/ipc'
import { useAuth } from '../store/authStore'

export function Login() {
  const { mode, nick, refresh, loginOffline, loginEly, logout } = useAuth()
  const [n, setN] = useState('')
  const [login, setLogin] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { refresh() }, [])

  return (
    <div>
      <h1 className="h-dot">Аккаунт</h1>
      <p className="sub">без аккаунта — просто ник · с Ely.by — работают скины{mode === 'ely' && nick ? ` · вошёл как ${nick}` : ''}</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, marginBottom: 10 }}>БЕЗ АККАУНТА</div>
          <input className="input" placeholder="Придумай ник…" value={n} onChange={(e) => setN(e.target.value)} />
          <button className="btn" style={{ marginTop: 10 }} onClick={() => loginOffline(n).catch((e) => setErr(e.message))}>Сохранить</button>
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, marginBottom: 10 }}>ELY.BY</div>
          <input className="input" placeholder="Логин…" value={login} onChange={(e) => setLogin(e.target.value)} />
          <input className="input" style={{ marginTop: 8 }} type="password" placeholder="Пароль…" value={pass} onChange={(e) => setPass(e.target.value)} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => { setErr(''); loginEly(login, pass).catch((e) => setErr(e.message)) }}>Войти</button>
            <button className="btn ghost" onClick={() => logout()}>Выйти</button>
          </div>
          <button className="link" style={{ marginTop: 10 }} onClick={() => call('paths:openElyReg')}>Нет аккаунта? Зарегистрироваться на ely.by</button>
        </div>
      </div>
      {err && <div style={{ color: 'var(--accent-soft)', marginTop: 10 }}>{err}</div>}
    </div>
  )
}
