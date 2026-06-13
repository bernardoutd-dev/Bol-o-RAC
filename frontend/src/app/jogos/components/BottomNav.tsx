'use client'

type Tab = 'Palpites' | 'Ranking' | 'Resultados'

type BottomNavProps = {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  isAdmin?: boolean
}

const NAV_ITEMS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'Palpites',    label: 'Palpites',    icon: '⚽' },
  { key: 'Ranking',     label: 'Ranking',     icon: '🏆' },
  { key: 'Resultados',  label: 'Resultados',  icon: '📝' },
  { key: 'Admin',       label: 'Admin',       icon: '🛡️' },
]

export default function BottomNav({ activeTab, onTabChange, isAdmin }: BottomNavProps) {
  const items = isAdmin ? NAV_ITEMS : NAV_ITEMS.slice(0, 2)
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegação principal">
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          onClick={() => onTabChange(item.key)}
          className={activeTab === item.key ? 'on' : ''}
          aria-label={item.label}
          aria-current={activeTab === item.key ? 'page' : undefined}
        >
          <span className="ic">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
