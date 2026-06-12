'use client'

type Tab = 'Palpites' | 'Ranking' | 'Resultados'

type BottomNavProps = {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const NAV_ITEMS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'Palpites', label: 'Palpites', icon: '⚽' },
  { key: 'Ranking',  label: 'Ranking',  icon: '🏆' },
  { key: 'Resultados', label: 'Resultados', icon: '📝' },
]

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegação principal">
      {NAV_ITEMS.map(item => (
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
