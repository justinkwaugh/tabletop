import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

// The wooden houses: red, blue, green, yellow, purple and black.
export const PowerGridPalette: PlayerColorPalette = {
    [Color.Red]: { fill: '#c43d2f', text: '#ffffff', contrast: '#ffffff' },
    [Color.Blue]: { fill: '#2f6fb8', text: '#ffffff', contrast: '#ffffff' },
    [Color.Green]: { fill: '#3e8e41', text: '#ffffff', contrast: '#ffffff' },
    [Color.Yellow]: { fill: '#e8c12e', text: '#231d0c', contrast: '#231d0c' },
    [Color.Purple]: { fill: '#7d4c9e', text: '#ffffff', contrast: '#ffffff' },
    [Color.Black]: { fill: '#34312e', text: '#ffffff', contrast: '#ffffff' }
}
