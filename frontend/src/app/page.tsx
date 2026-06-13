'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function switchMode(m: Mode) {
    setMode(m)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (mode === 'signup' && name.trim().length < 2) {
      setError('Escolha um apelido com pelo menos 2 letras.')
      return
    }
    if (!email.includes('@')) {
      setError('Digite um e-mail válido.')
      return
    }
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    if (mode === 'login') {
      const { data: loginData, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError('E-mail ou senha incorretos. Tente novamente.')
        setLoading(false)
        return
      }
      const nomeMeta = loginData.user?.user_metadata?.nome as string | undefined
      await supabase.from('profiles').upsert(
        { email, nome: nomeMeta || email.split('@')[0] },
        { onConflict: 'email', ignoreDuplicates: true }
      )
    } else {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome: name.trim() } },
      })
      if (err) {
        setError(err.message.includes('already registered')
          ? 'Este e-mail já está cadastrado. Tente fazer login.'
          : `Erro ao criar conta: ${err.message}`)
        setLoading(false)
        return
      }
      await supabase.from('profiles').upsert(
        { email, nome: name.trim() },
        { onConflict: 'email', ignoreDuplicates: true }
      )
    }

    router.push('/jogos')
  }

  return (
    <div className="login-screen">
      <div className="login-card">

        {/* Logo */}
        <div className="login-logo">
          <span className="login-ball">⚽</span>
          <h1 className="display login-title">
            COPA <span className="login-title-year">2026</span>
          </h1>
          <p className="login-sub">Bolão entre amigos · Palpite com estilo</p>
        </div>

        {/* Mode toggle */}
        <div className="mode-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            className={`mode-btn ${mode === 'login' ? 'on' : ''}`}
            onClick={() => switchMode('login')}
            aria-selected={mode === 'login'}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            className={`mode-btn ${mode === 'signup' ? 'on' : ''}`}
            onClick={() => switchMode('signup')}
            aria-selected={mode === 'signup'}
          >
            Criar conta
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>

          {/* Name — only for signup */}
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label" htmlFor="inp-name">
                Apelido no bolão
              </label>
              <input
                id="inp-name"
                type="text"
                className="auth-input"
                placeholder="Como você quer aparecer no ranking"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={24}
                autoComplete="nickname"
                autoFocus
              />
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="inp-email">
              E-mail
            </label>
            <input
              id="inp-email"
              type="email"
              className="auth-input"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoFocus={mode === 'login'}
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="inp-password">
              Senha
            </label>
            <input
              id="inp-password"
              type="password"
              className="auth-input"
              placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : 'Sua senha'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="form-submit"
            disabled={loading}
            style={{ marginTop: error ? '14px' : '8px' }}
          >
            {loading
              ? mode === 'login' ? 'Entrando…' : 'Criando conta…'
              : mode === 'login' ? 'Entrar no bolão ⚽' : 'Criar conta e palpitar'}
          </button>
        </form>

        {/* Footer hint */}
        <p style={{
          marginTop: '18px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--muted)',
          lineHeight: 1.5,
        }}>
          {mode === 'login'
            ? <>Não tem conta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit', padding: 0 }}
                >
                  Criar agora →
                </button>
              </>
            : <>Já tem conta?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit', padding: 0 }}
                >
                  Entrar →
                </button>
              </>
          }
        </p>

      </div>
    </div>
  )
}
