'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import BottomNav from './components/BottomNav'
import MatchCard from './components/MatchCard'
import { flags, matches, phaseLabels } from './data'

/* ─── Types ─── */
type Tab = 'Palpites' | 'Ranking' | 'Resultados' | 'Admin'
type GameFilter = 'TODOS' | 'HOJE' | 'R1' | 'R2' | 'R3' | 'MATA'
type OfficialFilter = 'GRUPOS' | 'MATA'
type PickMap = Record<number, [string, string]>
type OfficialMap = Record<number, [string, string]>
type TeamMap = Record<number, [string, string]>
type RankingRow = { email: string; name: string; pts: number; exact: number; correct: number; submitted: number }

/* ─── Constants ─── */
const GAME_FILTERS: Array<{ key: GameFilter; label: string }> = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'HOJE', label: 'Hoje' },
  { key: 'R1', label: '1ª rodada' },
  { key: 'R2', label: '2ª rodada' },
  { key: 'R3', label: '3ª rodada' },
  { key: 'MATA', label: 'Mata-mata' },
]

const OFFICIAL_FILTERS: Array<{ key: OfficialFilter; label: string }> = [
  { key: 'GRUPOS', label: 'Fase de grupos' },
  { key: 'MATA', label: 'Mata-mata' },
]

const TAB_ORDER: Tab[] = ['Palpites', 'Ranking', 'Resultados']
const ADMIN_EMAILS = ['bernardoutd@gmail.com', 'viktormb2005@gmail.com']
const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MEDALS = ['🥇', '🥈', '🥉']

/* ─── Helpers ─── */
function formatDay(date: string) {
  const dt = new Date(`${date}T12:00:00-03:00`)
  return `${DAY_NAMES[dt.getDay()]} · ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`
}

function isStarted(date: string, time: string) {
  return Date.now() >= new Date(`${date}T${time}:00-03:00`).getTime()
}

function calcPoints(pick: [string, string], result: [string, string] | null): number | null {
  if (!result || result[0] === '' || result[1] === '') return null
  if (pick[0] === '' || pick[1] === '') return null
  const [ph, pa, rh, ra] = [+pick[0], +pick[1], +result[0], +result[1]]
  if ([ph, pa, rh, ra].some(isNaN)) return null
  if (ph === rh && pa === ra) return 3
  return Math.sign(ph - pa) === Math.sign(rh - ra) ? 1 : 0
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* ─── Component ─── */
export default function JogosPage() {
  const [tab, setTab] = useState<Tab>('Palpites')
  const [gameFilter, setGameFilter] = useState<GameFilter>('HOJE')
  const [officialFilter, setOfficialFilter] = useState<OfficialFilter>('GRUPOS')
  const [profileOpen, setProfileOpen] = useState(false)

  const [picks, setPicks] = useState<PickMap>({})
  const [official, setOfficial] = useState<OfficialMap>({})
  const [teams, setTeams] = useState<TeamMap>({})

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState('')

  const [loading, setLoading] = useState(true)
  const [rankingRows, setRankingRows] = useState<RankingRow[]>([])
  const [rankingLoading, setRankingLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  /* ─── Admin state ─── */
  const [participants, setParticipants] = useState<{ email: string; name: string }[]>([])
  const [adminTargetEmail, setAdminTargetEmail] = useState('')
  const [adminTargetName, setAdminTargetName] = useState('')
  const [adminPicks, setAdminPicks] = useState<PickMap>({})
  const [adminFilter, setAdminFilter] = useState<GameFilter>('TODOS')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')

  /* ─── Toast ─── */
  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2100)
  }, [])

  /* ─── Derived ─── */
  const today = useMemo(
    () => new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' }),
    []
  )

  const filledCount = useMemo(
    () => Object.values(picks).filter(p => p[0] !== '' && p[1] !== '').length,
    [picks]
  )

  /* ─── Swipe to switch tabs ─── */
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (Math.abs(dx) > 60 && dy < 40) {
      const idx = TAB_ORDER.indexOf(tab)
      if (dx < 0 && idx < TAB_ORDER.length - 1) setTab(TAB_ORDER[idx + 1])
      else if (dx > 0 && idx > 0) setTab(TAB_ORDER[idx - 1])
    }
  }

  /* ─── Initial load ─── */
  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!user || error) { window.location.href = '/'; return }

      setUserEmail(user.email ?? null)
      const name = (user.user_metadata?.nome as string | undefined)
        || user.email?.split('@')[0]
        || 'Você'
      setUserName(name)

      const [picksRes, officialRes, teamsRes] = await Promise.all([
        supabase.from('picks').select('match_id, home_score, away_score').eq('user_email', user.email),
        supabase.from('official_results').select('match_id, home_score, away_score'),
        supabase.from('team_assignments').select('match_id, home_team, away_team'),
      ])

      if (Array.isArray(picksRes.data)) {
        setPicks(picksRes.data.reduce<PickMap>((acc, r) => {
          acc[r.match_id] = [String(r.home_score ?? ''), String(r.away_score ?? '')]
          return acc
        }, {}))
      }
      if (Array.isArray(officialRes.data)) {
        setOfficial(officialRes.data.reduce<OfficialMap>((acc, r) => {
          acc[r.match_id] = [String(r.home_score ?? ''), String(r.away_score ?? '')]
          return acc
        }, {}))
      }
      if (Array.isArray(teamsRes.data)) {
        setTeams(teamsRes.data.reduce<TeamMap>((acc, r) => {
          acc[r.match_id] = [String(r.home_team ?? ''), String(r.away_team ?? '')]
          return acc
        }, {}))
      }

      setLoading(false)
    }

    init()
  }, [])

  /* ─── Ranking ─── */
  const loadRanking = useCallback(async () => {
    setRankingLoading(true)
    const supabase = createClient()

    const [picksRes, officialRes] = await Promise.all([
      supabase.from('picks').select('*'),
      supabase.from('official_results').select('match_id, home_score, away_score'),
    ])

    const officialMap: OfficialMap = {}
    if (Array.isArray(officialRes.data)) {
      officialRes.data.forEach(r => { officialMap[r.match_id] = [String(r.home_score), String(r.away_score)] })
    }

    const byUser: Record<string, { name: string; picks: PickMap }> = {}
    if (Array.isArray(picksRes.data)) {
      picksRes.data.forEach(r => {
        if (!byUser[r.user_email]) {
          byUser[r.user_email] = {
            name: (r.user_name as string | null) || (r.user_email as string).split('@')[0],
            picks: {},
          }
        }
        byUser[r.user_email].picks[r.match_id] = [String(r.home_score ?? ''), String(r.away_score ?? '')]
      })
    }

    const rows: RankingRow[] = Object.entries(byUser).map(([email, { name, picks: up }]) => {
      let pts = 0, exact = 0, correct = 0, submitted = 0
      for (const idStr in up) {
        const pick = up[+idStr]
        if (pick[0] === '' || pick[1] === '') continue
        submitted++
        const p = calcPoints(pick, officialMap[+idStr] ?? null)
        if (p === 3) { pts += 3; exact++ }
        else if (p === 1) { pts += 1; correct++ }
      }
      return { email, name, pts, exact, correct, submitted }
    })

    rows.sort((a, b) => b.pts - a.pts || b.exact - a.exact || a.name.localeCompare(b.name))
    setRankingRows(rows)
    setRankingLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'Ranking') loadRanking()
  }, [tab, loadRanking])

  /* ─── Picks auto-save ─── */
  const persistPicks = useCallback(
    async (current: PickMap, email: string, name: string) => {
      const base = Object.entries(current)
        .filter(([, p]) => p[0] !== '' || p[1] !== '')
        .map(([id, p]) => ({ match_id: Number(id), user_email: email, home_score: p[0], away_score: p[1] }))
      if (!base.length) return

      const supabase = createClient()

      // Try with user_name (requires migration to add the column)
      let { error } = await supabase
        .from('picks')
        .upsert(base.map(r => ({ ...r, user_name: name })), { onConflict: 'user_email,match_id' })

      // Column doesn't exist yet — retry without user_name
      if (error) {
        console.warn('[picks] retrying without user_name:', error.message)
        const retry = await supabase.from('picks').upsert(base, { onConflict: 'user_email,match_id' })
        error = retry.error
      }

      if (error) {
        console.error('[picks] save failed:', error)
        showToast('Erro ao salvar — tente de novo', false)
      } else {
        showToast('Palpites salvos ✓')
      }
    },
    [showToast]
  )

  const handlePickChange = useCallback((matchId: number, side: 0 | 1, value: string) => {
    const raw = value.replace(/[^0-9]/g, '')
    const norm = raw === '' ? '' : String(Math.max(0, Math.min(99, Number(raw))))
    setPicks(prev => {
      const next: PickMap = {
        ...prev,
        [matchId]: side === 0
          ? [norm, prev[matchId]?.[1] ?? '']
          : [prev[matchId]?.[0] ?? '', norm],
      }
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (userEmail) saveTimer.current = setTimeout(() => persistPicks(next, userEmail, userName), 700)
      return next
    })
  }, [userEmail, userName, persistPicks])

  /* ─── Official results ─── */
  const handleOfficialChange = useCallback((matchId: number, side: 0 | 1, value: string) => {
    const raw = value.replace(/[^0-9]/g, '')
    const norm = raw === '' ? '' : String(Math.max(0, Math.min(99, Number(raw))))
    setOfficial(prev => ({
      ...prev,
      [matchId]: side === 0 ? [norm, prev[matchId]?.[1] ?? ''] : [prev[matchId]?.[0] ?? '', norm],
    }))
  }, [])

  const handleTeamChange = useCallback((matchId: number, side: 0 | 1, value: string) => {
    setTeams(prev => ({
      ...prev,
      [matchId]: side === 0 ? [value, prev[matchId]?.[1] ?? ''] : [prev[matchId]?.[0] ?? '', value],
    }))
  }, [])

  const saveOfficial = useCallback(async () => {
    const supabase = createClient()

    const officialRows = Object.entries(official)
      .filter(([, r]) => r[0] !== '' && r[1] !== '')
      .map(([id, r]) => ({ match_id: Number(id), home_score: r[0], away_score: r[1] }))

    const teamsRows = Object.entries(teams)
      .filter(([, t]) => t[0] !== '' || t[1] !== '')
      .map(([id, t]) => ({ match_id: Number(id), home_team: t[0], away_team: t[1] }))

    const [r1, r2] = await Promise.all([
      officialRows.length
        ? supabase.from('official_results').upsert(officialRows, { onConflict: 'match_id' })
        : Promise.resolve({ error: null }),
      teamsRows.length
        ? supabase.from('team_assignments').upsert(teamsRows, { onConflict: 'match_id' })
        : Promise.resolve({ error: null }),
    ])

    if (r1.error) console.error('[saveOfficial] official_results:', r1.error)
    if (r2.error) console.error('[saveOfficial] team_assignments:', r2.error)

    if (!r1.error && !r2.error) showToast('Resultados salvos ✓')
    else showToast('Erro ao salvar — execute o schema SQL no Supabase', false)
  }, [official, teams, showToast])

  /* ─── Logout ─── */
  const handleLogout = useCallback(async () => {
    await createClient().auth.signOut()
    window.location.href = '/'
  }, [])

  /* ─── Admin ─── */
  const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false

  const loadParticipants = useCallback(async () => {
    const { data } = await createClient().from('picks').select('user_email, user_name')
    if (!Array.isArray(data)) return
    const map: Record<string, string> = {}
    data.forEach((r: { user_email: string; user_name: string | null }) => {
      if (!map[r.user_email]) map[r.user_email] = r.user_name || r.user_email.split('@')[0]
    })
    setParticipants(Object.entries(map).map(([email, name]) => ({ email, name })))
  }, [])

  useEffect(() => {
    if (tab === 'Admin') loadParticipants()
  }, [tab, loadParticipants])

  const selectParticipant = useCallback(async (email: string, name: string) => {
    setAdminTargetEmail(email)
    setAdminTargetName(name)
    setNewUserEmail('')
    setNewUserName('')
    const { data } = await createClient().from('picks').select('match_id, home_score, away_score').eq('user_email', email)
    setAdminPicks(Array.isArray(data)
      ? data.reduce<PickMap>((acc, r) => { acc[r.match_id] = [String(r.home_score ?? ''), String(r.away_score ?? '')]; return acc }, {})
      : {}
    )
  }, [])

  const handleAdminPickChange = useCallback((matchId: number, side: 0 | 1, value: string) => {
    const raw = value.replace(/[^0-9]/g, '')
    const norm = raw === '' ? '' : String(Math.max(0, Math.min(99, Number(raw))))
    setAdminPicks(prev => ({
      ...prev,
      [matchId]: side === 0 ? [norm, prev[matchId]?.[1] ?? ''] : [prev[matchId]?.[0] ?? '', norm],
    }))
  }, [])

  const saveAdminPicks = useCallback(async () => {
    if (!adminTargetEmail) { showToast('Selecione um participante', false); return }
    await persistPicks(adminPicks, adminTargetEmail, adminTargetName)
  }, [adminPicks, adminTargetEmail, adminTargetName, persistPicks, showToast])

  const activateNewUser = useCallback(() => {
    if (!newUserEmail.includes('@')) { showToast('E-mail inválido', false); return }
    if (newUserName.trim().length < 2) { showToast('Nome muito curto', false); return }
    setAdminTargetEmail(newUserEmail.trim())
    setAdminTargetName(newUserName.trim())
    setAdminPicks({})
    setNewUserEmail('')
    setNewUserName('')
  }, [newUserEmail, newUserName, showToast])

  /* ─── Filtered matches ─── */
  const filteredMatches = useMemo(() => matches.filter(m => {
    if (gameFilter === 'TODOS') return true
    if (gameFilter === 'HOJE') return m.date === today
    if (gameFilter === 'MATA') return !['R1', 'R2', 'R3'].includes(m.stage)
    return m.stage === gameFilter
  }), [gameFilter, today])

  const officialMatches = useMemo(
    () => matches.filter(m => officialFilter === 'GRUPOS' ? m.stage.startsWith('R') : !m.stage.startsWith('R')),
    [officialFilter]
  )

  const matchGroups = useMemo(() => {
    const result: Array<{ date: string; items: typeof filteredMatches }> = []
    for (const m of filteredMatches) {
      const last = result[result.length - 1]
      if (!last || last.date !== m.date) result.push({ date: m.date, items: [m] })
      else last.items.push(m)
    }
    return result
  }, [filteredMatches])

  const adminFilteredMatches = useMemo(() => matches.filter(m => {
    if (adminFilter === 'TODOS') return true
    if (adminFilter === 'HOJE') return m.date === today
    if (adminFilter === 'MATA') return !['R1', 'R2', 'R3'].includes(m.stage)
    return m.stage === adminFilter
  }), [adminFilter, today])

  const adminMatchGroups = useMemo(() => {
    const result: Array<{ date: string; items: typeof adminFilteredMatches }> = []
    for (const m of adminFilteredMatches) {
      const last = result[result.length - 1]
      if (!last || last.date !== m.date) result.push({ date: m.date, items: [m] })
      else last.items.push(m)
    }
    return result
  }, [adminFilteredMatches])

  /* ─── Loading screen ─── */
  if (loading) {
    return (
      <main style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loader-ring" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--muted)', letterSpacing: '0.04em' }}>
            Carregando palpites…
          </p>
        </div>
      </main>
    )
  }

  const initials = getInitials(userName)

  /* ─── Main render ─── */
  return (
    <main
      style={{
        minHeight: '100svh',
        background: 'radial-gradient(1200px 500px at 50% -200px,#14502f44,transparent),repeating-linear-gradient(0deg,transparent 0 78px,#ffffff04 78px 156px),#081711',
        color: 'var(--chalk)',
        paddingBottom: '84px',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >

      {/* ─── Profile backdrop ─── */}
      {profileOpen && (
        <>
          <div className="profile-backdrop" onClick={() => setProfileOpen(false)} />
          <div className="profile-sheet">
            <div className="sheet-handle" />
            <div className="avatar-lg">{initials}</div>
            <p className="sheet-name">{userName}</p>
            <p className="sheet-email" style={{ textAlign: 'center' }}>{userEmail}</p>
            <hr className="sheet-divider" />
            <button className="btn-danger" onClick={handleLogout}>
              Sair do bolão
            </button>
          </div>
        </>
      )}

      {/* ─── Header ─── */}
      <div className="app-header">
        <div className="header-text">
          <div className="hd-eyebrow">Bolão entre amigos</div>
          <h1 className="display hd-title">
            COPA <span className="hd-title-year">2026</span>
          </h1>
          <p className="hd-sub">
            104 jogos · {filledCount} palpite{filledCount !== 1 ? 's' : ''} preenchido{filledCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="avatar-btn"
          onClick={() => setProfileOpen(true)}
          aria-label="Perfil e configurações"
        >
          {initials}
        </button>
      </div>

      {/* ══════════════════════════════
          TAB: PALPITES
         ══════════════════════════════ */}
      <div className={tab !== 'Palpites' ? 'hide' : ''}>
        <div className="chips">
          {GAME_FILTERS.map(f => (
            <button key={f.key} className={`chip ${gameFilter === f.key ? 'on' : ''}`} onClick={() => setGameFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {matchGroups.length === 0 ? (
          <div className="empty">
            {gameFilter === 'HOJE'
              ? '☀️ Sem jogos hoje.\nBola pra frente!'
              : 'Nenhum jogo aqui.\nBola pra frente! ⚽'}
          </div>
        ) : (
          matchGroups.map(({ date, items }) => (
            <div key={date}>
              <div className="day-head">
                {formatDay(date)}
                {date === today && <span className="today-badge">Hoje</span>}
              </div>
              {items.map(m => {
                const locked = isStarted(m.date, m.time)
                const homeLabel = m.home || teams[m.id]?.[0] || ''
                const awayLabel = m.away || teams[m.id]?.[1] || ''
                return (
                  <MatchCard
                    key={m.id}
                    match={m}
                    flags={flags}
                    pick={picks[m.id] ?? ['', '']}
                    official={official[m.id] ?? null}
                    disabled={locked}
                    isToday={m.date === today}
                    homeLabel={homeLabel}
                    awayLabel={awayLabel}
                    onPickChange={handlePickChange}
                  />
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* ══════════════════════════════
          TAB: RANKING
         ══════════════════════════════ */}
      <div className={tab !== 'Ranking' ? 'hide' : ''}>
        <div className="panel">
          <h2 className="display" style={{ fontSize: '17px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏆</span> Classificação
          </h2>

          {rankingLoading ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {[80, 60, 75].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: '56px', borderRadius: '12px', opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          ) : rankingRows.length === 0 ? (
            <div className="empty" style={{ padding: '24px 0 8px' }}>
              <span className="spin">⚽</span>
              <br />Ninguém palpitou ainda.<br />Seja o primeiro! 🥇
            </div>
          ) : (
            rankingRows.map((r, i) => (
              <div key={r.email} className={`rk-row ${i < 3 ? `p${i + 1}` : ''} ${r.email === userEmail ? 'me' : ''}`}>
                <div className="rk-pos">
                  {i < 3 ? MEDALS[i] : `${i + 1}º`}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className={`rk-name ${r.email === userEmail ? 'eu' : ''}`}>
                    {r.name}{r.email === userEmail ? ' (você)' : ''}
                  </div>
                  <div className="rk-detail">
                    {r.submitted} palpites · {r.correct} acerto{r.correct !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="rk-ex">🎯 {r.exact}</div>
                <div className="rk-pts">{r.pts}<small> pts</small></div>
              </div>
            ))
          )}
        </div>

        <button className="btn-ghost" onClick={loadRanking}>↻ Atualizar ranking</button>

        <div className="panel">
          <h2 className="display" style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📋</span> Regras
          </h2>
          <div className="rules">
            <span className="dot-ex">● 3 pontos</span> — acertou o <b>placar exato</b><br />
            <span className="dot-ok">● 1 ponto</span> — acertou o vencedor ou o empate<br />
            ● Palpites <b>travam no horário do jogo</b> (horário de Brasília)<br />
            ● Desempate: quem tiver mais <b>placares exatos 🎯</b><br />
            ● Mata-mata: vale <b>tempo normal + prorrogação</b> (pênaltis não contam)
          </div>
        </div>
      </div>

      {/* ══════════════════════════════
          TAB: RESULTADOS (ADMIN)
         ══════════════════════════════ */}
      <div className={tab !== 'Resultados' ? 'hide' : ''}>
        <p className="of-note">
          ⚙️ Área do administrador: lance os <b>resultados oficiais</b> e preencha os times do mata-mata quando forem definidos. Só uma pessoa mexe aqui! 😉
        </p>

        <div className="chips">
          {OFFICIAL_FILTERS.map(f => (
            <button key={f.key} className={`chip ${officialFilter === f.key ? 'on' : ''}`} onClick={() => setOfficialFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {officialMatches.map(m => {
          const isKnockout = m.home === '' && m.away === ''
          const homeLabel = m.home || teams[m.id]?.[0] || ''
          const awayLabel = m.away || teams[m.id]?.[1] || ''
          const stageLabel = m.stage.startsWith('R')
            ? `Grupo ${m.group}`
            : m.stage === 'FIN' ? '🏆 FINAL' : (phaseLabels[m.stage] ?? m.stage)
          const res: [string, string] = official[m.id] ?? ['', '']

          return (
            <div key={m.id} className="match">
              <div className="m-meta">
                <span className="grp">{stageLabel}</span>
                <span className="m-time">{m.time} · Brasília</span>
              </div>

              {isKnockout && (
                <div className="mata-inputs">
                  <input
                    list="allTeams"
                    className="mata-input"
                    placeholder="Mandante"
                    value={homeLabel}
                    onChange={e => handleTeamChange(m.id, 0, e.target.value)}
                  />
                  <input
                    list="allTeams"
                    className="mata-input"
                    placeholder="Visitante"
                    value={awayLabel}
                    onChange={e => handleTeamChange(m.id, 1, e.target.value)}
                  />
                </div>
              )}

              <div className="m-row">
                <div className="team">
                  <span className="fl">{homeLabel ? (flags[homeLabel] ?? '🏳️') : '❔'}</span>
                  <span className={`nm ${!homeLabel ? 'undefined-team' : ''}`}>{homeLabel || 'A definir'}</span>
                </div>
                <div className="placar">
                  <input
                    className="sc"
                    type="number"
                    inputMode="numeric"
                    min={0} max={99}
                    placeholder="–"
                    value={res[0]}
                    onChange={e => handleOfficialChange(m.id, 0, e.target.value)}
                  />
                  <span className="vs">×</span>
                  <input
                    className="sc"
                    type="number"
                    inputMode="numeric"
                    min={0} max={99}
                    placeholder="–"
                    value={res[1]}
                    onChange={e => handleOfficialChange(m.id, 1, e.target.value)}
                  />
                </div>
                <div className="team">
                  <span className="fl">{awayLabel ? (flags[awayLabel] ?? '🏳️') : '❔'}</span>
                  <span className={`nm ${!awayLabel ? 'undefined-team' : ''}`}>{awayLabel || 'A definir'}</span>
                </div>
              </div>
            </div>
          )
        })}

        <datalist id="allTeams">
          {Object.keys(flags).map(n => <option key={n} value={n} />)}
        </datalist>

        <button className="btn-gold" onClick={saveOfficial}>Salvar resultados oficiais</button>
      </div>

      {/* ══════════════════════════════
          TAB: ADMIN
         ══════════════════════════════ */}
      {isAdmin && (
        <div className={tab !== 'Admin' ? 'hide' : ''}>
          <p className="of-note">🛡️ <b>Painel Admin</b> — edite palpites de qualquer participante, incluindo jogos encerrados.</p>

          {/* Participant selector */}
          <div className="panel">
            <h2 className="display" style={{ fontSize: '15px', marginBottom: '12px' }}>👤 Participante</h2>

            {participants.map(p => (
              <div
                key={p.email}
                className={`admin-user-row ${adminTargetEmail === p.email ? 'active' : ''}`}
                onClick={() => selectParticipant(p.email, p.name)}
              >
                <div className="admin-user-name">{p.name}</div>
                <div className="admin-user-email">{p.email}</div>
              </div>
            ))}

            {participants.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '8px 0' }}>
                Nenhum participante ainda
              </p>
            )}

            <hr className="sheet-divider" style={{ margin: '14px 0 10px' }} />

            <p style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Novo participante
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input className="auth-input" type="email" placeholder="E-mail" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
              <input className="auth-input" type="text" placeholder="Nome" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
              <button className="btn-ghost" onClick={activateNewUser}>Selecionar novo →</button>
            </div>
          </div>

          {/* Picks for selected participant */}
          {adminTargetEmail && (
            <>
              <div className="panel" style={{ padding: '10px 14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Editando: <strong style={{ color: 'var(--gold)' }}>{adminTargetName}</strong>
                  <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {adminTargetEmail}</span>
                </p>
              </div>

              <div className="chips">
                {GAME_FILTERS.map(f => (
                  <button key={f.key} className={`chip ${adminFilter === f.key ? 'on' : ''}`} onClick={() => setAdminFilter(f.key)}>
                    {f.label}
                  </button>
                ))}
              </div>

              {adminMatchGroups.map(({ date, items }) => (
                <div key={date}>
                  <div className="day-head">
                    {formatDay(date)}
                    {date === today && <span className="today-badge">Hoje</span>}
                  </div>
                  {items.map(m => {
                    const homeLabel = m.home || teams[m.id]?.[0] || ''
                    const awayLabel = m.away || teams[m.id]?.[1] || ''
                    return (
                      <MatchCard
                        key={m.id}
                        match={m}
                        flags={flags}
                        pick={adminPicks[m.id] ?? ['', '']}
                        official={official[m.id] ?? null}
                        disabled={false}
                        homeLabel={homeLabel}
                        awayLabel={awayLabel}
                        onPickChange={handleAdminPickChange}
                      />
                    )
                  })}
                </div>
              ))}

              <button className="btn-gold" onClick={saveAdminPicks}>
                Salvar palpites de {adminTargetName}
              </button>
            </>
          )}
        </div>
      )}

      {/* ─── Toast ─── */}
      {toast && (
        <div
          className="toast show"
          style={{
            borderColor: toast.ok ? 'var(--ok)' : 'var(--hot)',
            color: toast.ok ? 'var(--ok)' : 'var(--hot)',
            background: toast.ok ? '#0a2217' : '#2a0c06',
          }}
        >
          {toast.msg}
        </div>
      )}

      <BottomNav activeTab={tab} onTabChange={setTab} isAdmin={isAdmin} />
    </main>
  )
}
