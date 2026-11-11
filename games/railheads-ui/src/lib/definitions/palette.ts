import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

export const RailheadsPalette: PlayerColorPalette = {
    [Color.Pink]: { fill: '#d9609c', text: '#2a1020', contrast: '#2a1020' },
    [Color.Purple]: { fill: '#7a4fb4', text: '#ffffff', contrast: '#ffffff' },
    [Color.Orange]: { fill: '#e88a2a', text: '#2a1608', contrast: '#2a1608' },
    [Color.Blue]: { fill: '#2aa198', text: '#062a27', contrast: '#062a27' },
    [Color.Gray]: { fill: '#5d6b7a', text: '#ffffff', contrast: '#ffffff' }
}
