import type { MatchData } from '../data'
import { phaseLabels } from '../data'

type MatchCardProps = {
  match: MatchData
  flags: Record<string, string>
  pick: [string, string]
  official: [string, string] | null
  disabled: boolean
  isToday?: boolean
  homeLabel: string
  awayLabel: string
  onPickChange: (matchId: number, side: 0 | 1, value: string) => void
}

function calcPoints(pick: [string, string], result: [string, string] | null): number | null {
  if (!result || result[0] === '' || result[1] === '') return null
  if (pick[0] === '' || pick[1] === '') return null
  const [ph, pa, rh, ra] = [+pick[0], +pick[1], +result[0], +result[1]]
  if ([ph, pa, rh, ra].some(isNaN)) return null
  if (ph === rh && pa === ra) return 3
  return Math.sign(ph - pa) === Math.sign(rh - ra) ? 1 : 0
}

export default function MatchCard({
  match,
  flags,
  pick,
  official,
  disabled,
  isToday = false,
  homeLabel,
  awayLabel,
  onPickChange,
}: MatchCardProps) {
  const noTeams = homeLabel === '' && awayLabel === ''
  const locked = disabled || noTeams

  const homeName = homeLabel || 'A definir'
  const awayName = awayLabel || 'A definir'
  const homeFlag = homeLabel ? (flags[homeLabel] ?? '🏳️') : '❔'
  const awayFlag = awayLabel ? (flags[awayLabel] ?? '🏳️') : '❔'

  const stageLabel =
    match.stage === 'FIN' ? '🏆 FINAL' :
    match.stage.startsWith('R') ? `Grupo ${match.group}` :
    (phaseLabels[match.stage] ?? match.stage)

  const hasResult = official && official[0] !== '' && official[1] !== ''
  const pts = hasResult ? calcPoints(pick, official) : null

  /* Visual class logic */
  const cardClass = [
    'match',
    disabled ? 'locked' : '',
    isToday && !disabled ? 'today-game' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cardClass}>
      {/* Meta */}
      <div className="m-meta">
        <span className="grp">{stageLabel}</span>
        <span className="m-time">{match.time} · Brasília</span>
      </div>

      {/* Teams + inputs */}
      <div className="m-row">
        {/* Home */}
        <div className="team">
          <span className="fl">{homeFlag}</span>
          <span className={`nm ${noTeams ? 'undefined-team' : ''}`}>{homeName}</span>
        </div>

        {/* Score */}
        <div className="placar">
          <input
            className="sc"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            placeholder="–"
            value={pick[0]}
            disabled={locked}
            onChange={e => onPickChange(match.id, 0, e.target.value)}
          />
          <span className="vs">×</span>
          <input
            className="sc"
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            placeholder="–"
            value={pick[1]}
            disabled={locked}
            onChange={e => onPickChange(match.id, 1, e.target.value)}
          />
        </div>

        {/* Away */}
        <div className="team">
          <span className="fl">{awayFlag}</span>
          <span className={`nm ${noTeams ? 'undefined-team' : ''}`}>{awayName}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="m-foot">
        <span className="res-of">
          {hasResult
            ? <span>Placar oficial: <b>{official![0]} × {official![1]}</b></span>
            : disabled
              ? <span className="lock-tag">🔒 Palpites encerrados</span>
              : null}
        </span>
        {pts !== null && (
          <span className={`pts ${pts === 3 ? 'exato' : pts === 1 ? 'certo' : 'zero'}`}>
            {pts === 3 ? '🎯 +3' : pts === 1 ? '✓ +1' : '0 pt'}
          </span>
        )}
      </div>
    </div>
  )
}
