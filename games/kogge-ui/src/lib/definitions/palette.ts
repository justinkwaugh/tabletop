import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

export const KoggePalette: PlayerColorPalette = {
    [Color.Red]: { fill: '#c0342b', text: '#ffffff', contrast: '#ffffff' },
    [Color.Green]: { fill: '#2f7d3b', text: '#ffffff', contrast: '#ffffff' },
    [Color.Blue]: { fill: '#2d64b4', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#efc02e', text: '#2a1d0c', contrast: '#2a1d0c' }
}
