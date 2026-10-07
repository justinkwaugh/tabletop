import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

// Seats avoid the grocers' red, green, orange and blue and the builders' gray: lemon yellow,
// violet, hot pink, aqua (the blue seat) and near-black.
export const HcgPalette: PlayerColorPalette = {
    [Color.Yellow]: { fill: '#f7e03c', text: '#2e2606', contrast: '#2e2606' },
    [Color.Purple]: { fill: '#8a3fd1', text: '#ffffff', contrast: '#ffffff' },
    [Color.Pink]: { fill: '#ff6ec7', text: '#3a0a28', contrast: '#3a0a28' },
    [Color.Blue]: { fill: '#19b8c0', text: '#062a2c', contrast: '#062a2c' },
    [Color.Black]: { fill: '#141414', text: '#ffffff', contrast: '#ffffff' }
}
