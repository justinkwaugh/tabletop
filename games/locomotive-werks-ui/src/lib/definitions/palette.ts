import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

// Seats avoid the green, red, yellow and blue of the locomotive kinds.
export const LwPalette: PlayerColorPalette = {
    [Color.Purple]: { fill: '#6d4f9c', text: '#ffffff', contrast: '#ffffff' },
    [Color.Orange]: { fill: '#e38b2c', text: '#2a1608', contrast: '#2a1608' },
    [Color.Pink]: { fill: '#d7709f', text: '#2a1020', contrast: '#2a1020' },
    [Color.Brown]: { fill: '#7b5534', text: '#ffffff', contrast: '#ffffff' },
    [Color.Black]: { fill: '#2f2c28', text: '#e9eef2', contrast: '#e9eef2' }
}
