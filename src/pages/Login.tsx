import { useEffect, useState } from 'react'
import { call } from '../lib/ipc'
import { t, useLang } from '../lib/i18n'
import { useAuth } from '../store/authStore'

export function Login() {
  useLang()
  const { mode, nick, refresh, loginOffline, loginEly, logout } = useAuth()
  const [n, setN] = useState('')
  const [login, setLogin] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { refresh() }, [])

  return (
    <div>
      <h1 className="h-dot">{t('login.title')}</h1>
      <p className="sub">{t('login.subtitle')}{mode === 'ely' && nick ? t('login.logged_as', { nick }) : ''}</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, marginBottom: 10 }}>{t('login.offline_title')}</div>
          <input className="input" placeholder={t('login.nick_ph')} value={n} onChange={(e) => setN(e.target.value)} />
          <button className="btn" style={{ marginTop: 10 }} onClick={() => loginOffline(n).catch((e) => setErr(e.message))}>{t('common.save')}</button>
        </div>
        <div className="card">
          <div style={{ fontFamily: 'var(--font-dot)', letterSpacing: 2, marginBottom: 10 }}>ELY.BY</div>
          <input className="input" placeholder={t('login.login_ph')} value={login} onChange={(e) => setLogin(e.target.value)} />
          <input className="input" style={{ marginTop: 8 }} type="password" placeholder={t('login.pass_ph')} value={pass} onChange={(e) => setPass(e.target.value)} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => { setErr(''); loginEly(login, pass).catch((e) => setErr(e.message)) }}>{t('login.sign_in')}</button>
            <button className="btn ghost" onClick={() => logout()}>{t('login.sign_out')}</button>
          </div>
          <button className="link" style={{ marginTop: 10 }} onClick={() => call('paths:openElyReg')}>{t('login.register')}</button>
        </div>
      </div>
      {err && <div style={{ color: 'var(--accent-soft)', marginTop: 10 }}>{err}</div>}
    </div>
  )
}
