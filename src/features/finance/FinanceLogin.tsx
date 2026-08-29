import { useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import Button from '../../common/Button'
import Input from '../../common/Input'

export default function FinanceLogin() {
  const login = useAuthStore(s => s.login)
  const loading = useAuthStore(s => s.loading)
  const error = useAuthStore(s => s.error)
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!identity.trim() || !password) return
    void login(identity.trim(), password)
  }

  return (
    <div className="finance-login-container">
      <form className="finance-login-card" onSubmit={submit}>
        <div className="fin-login-head">
          <span className="fin-login-mark">◈</span>
          <div>
            <h1 className="fin-login-title">PLOS</h1>
            <p className="fin-login-sub">Hesabına giriş yap</p>
          </div>
        </div>
        <Input
          label="E-posta / Kullanıcı Adı"
          value={identity}
          onChange={e => setIdentity(e.target.value)}
          placeholder="ornek@mail.com"
          autoFocus
        />
        <Input
          label="Şifre"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        {error && <p className="finance-error">{error}</p>}
        <Button type="submit" disabled={loading || !identity.trim() || !password}>
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </Button>
        <p className="fin-login-note">Verilerin mobil uygulamayla aynı hesapta tutulur.</p>
      </form>
    </div>
  )
}
