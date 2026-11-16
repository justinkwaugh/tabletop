import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

// Seats avoid the railroads' red, blue, green, brown, black and yellow: the red and blue seats
// are burgundy and light blue.
export const SarPalette: PlayerColorPalette = {
    [Color.Pink]: { fill: '#e46fae', text: '#2a1020', contrast: '#2a1020' },
    [Color.Purple]: { fill: '#7a4fb4', text: '#ffffff', contrast: '#ffffff' },
    [Color.Orange]: { fill: '#ee8a2c', text: '#2a1608', contrast: '#2a1608' },
    [Color.Red]: { fill: '#7e2141', text: '#ffffff', contrast: '#ffffff' },
    [Color.Blue]: { fill: '#72c4ea', text: '#0f2a38', contrast: '#0f2a38' },
    [Color.Gray]: { fill: '#68717d', text: '#ffffff', contrast: '#ffffff' }
}
