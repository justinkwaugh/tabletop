import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

export const MagnaGreciaPalette: PlayerColorPalette = {
    [Color.Red]: { fill: '#c8461f', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#f5e04a', text: '#1f1a10', contrast: '#1f1a10' },
    [Color.Gray]: { fill: '#686d73', text: '#ffffff', contrast: '#ffffff' },
    [Color.Blue]: { fill: '#4a94d0', text: '#1f1a10', contrast: '#1f1a10' }
}
