import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

export const MedinaPalette: PlayerColorPalette = {
    [Color.Red]: { fill: '#c0242a', text: '#fbe9d6', contrast: '#fbe9d6' },
    [Color.Blue]: { fill: '#1a5cc0', text: '#e7eefb', contrast: '#e7eefb' },
    [Color.Green]: { fill: '#258c36', text: '#e8f6e8', contrast: '#e8f6e8' },
    [Color.Yellow]: { fill: '#ecbf1c', text: '#2a1609', contrast: '#2a1609' }
}
