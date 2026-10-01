import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

export const MagnaGreciaPalette: PlayerColorPalette = {
    [Color.Red]: { fill: '#d02329', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#ffe700', text: '#1f1a10', contrast: '#1f1a10' },
    [Color.Gray]: { fill: '#aaafb3', text: '#1f1a10', contrast: '#1f1a10' },
    [Color.Blue]: { fill: '#69a6c3', text: '#1f1a10', contrast: '#1f1a10' }
}
