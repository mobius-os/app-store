import {
  Bolt, Brain, Calendar, Camera, ColorTheme, ConfettiParty, DollarCircle, Dumbbell, Flag, Globe,
  GraduationCap, Grid, Headphones, Home, Maps, Music, NewsPaper, Plane, SettingsSlider, ShoppingBag,
  Speed, Spelling, SquareCheckCheckboxChecked, Terminal, Tools, TrophyTop,
} from '@openai/apps-sdk-ui/components/Icon'

// Each category has an icon and a hue, shown the way Google Play does it: a
// colored glyph on a soft tint of the same color, which reads in light and dark.
const CATEGORY_ICONS = {
  productivity: SquareCheckCheckboxChecked,
  everyday: Calendar,
  create: ColorTheme,
  explore: GraduationCap,
  money: DollarCircle,
  news: NewsPaper,
  agent: Tools,
  developer: Terminal,
  action: Bolt,
  puzzle: Brain,
  worlds: Globe,
  music: Headphones,
  health: Dumbbell,
  photo: Camera,
  audio: Music,
  travel: Plane,
  home: Home,
  shopping: ShoppingBag,
  utilities: SettingsSlider,
  strategy: Flag,
  racing: Speed,
  sports: TrophyTop,
  board: Grid,
  adventure: Maps,
  word: Spelling,
  party: ConfettiParty,
}

// The icon set has no game controller, so Games draws one in the same
// 24px, 2px-stroke line style as the set's other icons.
export function Gamepad(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 3.6l.9 4.6a2.6 2.6 0 0 1-4.5 2.2L15.5 15h-7l-1.8 2.4a2.6 2.6 0 0 1-4.5-2.2l.9-4.6A4.5 4.5 0 0 1 7.5 7Z" />
      <path d="M8 9.5v3M6.5 11h3" />
      <path d="M15.5 10.5h.01M17.5 12h.01" strokeWidth="2.6" />
    </svg>
  )
}

export function CategoryIcon({ category, size = 'md', glyph }) {
  const Glyph = glyph || CATEGORY_ICONS[category?.id]
  if (!Glyph) return null
  return (
    <span className={`st-cat-icon is-${size}`} style={{ '--cat': category.color }} aria-hidden="true">
      <Glyph width="1em" height="1em" />
    </span>
  )
}

const SORTS = [
  { id: 'top', label: 'Top' },
  { id: 'new', label: 'Newest' },
  { id: 'updated', label: 'Updated' },
]

export function CategorySort({ value, onChange }) {
  return (
    <div className="st-cat-sort" role="group" aria-label="Sort apps">
      {SORTS.map((sort) => (
        <button
          key={sort.id}
          type="button"
          className={value === sort.id ? 'is-active' : ''}
          aria-pressed={value === sort.id}
          onClick={() => onChange(sort.id)}
        >
          {sort.label}
        </button>
      ))}
    </div>
  )
}
