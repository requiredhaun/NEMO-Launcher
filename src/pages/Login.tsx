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
      <h1 className="h-dot">ACCOUNT</h1>
      <p className="sub">offline или ely.by · сейчас: {mode} {nick}</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, marginBottom: 10 }}>OFFLINE</div>
          <input className="input" placeholder="Ник…" value={n} onChange={(e) => setN(e.target.value)} />
          <button className="btn" style={{ marginTop: 10 }} onClick={() => loginOffline(n).catch((e) => setErr(e.message))}>SAVE NICK</button>
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, marginBottom: 10 }}>ELY.BY</div>
          <input className="input" placeholder="Логин…" value={login} onChange={(e) => setLogin(e.target.value)} />
          <input className="input" style={{ marginTop: 8 }} type="password" placeholder="Пароль…" value={pass} onChange={(e) => setPass(e.target.value)} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => loginEly(login, pass).catch((e) => setErr(e.message))}>LOGIN</button>
            <button className="btn ghost" onClick={() => logout()}>LOGOUT</button>
          </div>
        </div>
      </div>
      {err && <div style={{ color: '#ff6b6f', marginTop: 10 }}>{err}</div>}
    </div>
  )
}
