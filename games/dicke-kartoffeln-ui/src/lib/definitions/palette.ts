import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

// Painted farm-gate colours that stand out against green fields and red seed sacks.
export const DickeKartoffelnPalette: PlayerColorPalette = {
    [Color.Blue]: { fill: '#2f62b5', text: '#ffffff', contrast: '#ffffff' },
    [Color.Purple]: { fill: '#7b3fa3', text: '#ffffff', contrast: '#ffffff' },
    [Color.Orange]: { fill: '#e2801f', text: '#2a1604', contrast: '#2a1604' },
    [Color.Pink]: { fill: '#e2609e', text: '#2a0a1a', contrast: '#2a0a1a' },
    [Color.Black]: { fill: '#232323', text: '#ffffff', contrast: '#ffffff' },
    [Color.White]: { fill: '#f6f2e4', text: '#2a1c10', contrast: '#2a1c10' }
}
