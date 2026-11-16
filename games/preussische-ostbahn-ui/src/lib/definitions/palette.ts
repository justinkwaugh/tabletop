import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'

export const OstbahnPalette: PlayerColorPalette = {
    [Color.Pink]: { fill: '#d9609c', text: '#2a1020', contrast: '#2a1020' },
    [Color.Gray]: { fill: '#6c7884', text: '#ffffff', contrast: '#ffffff' },
    [Color.White]: { fill: '#ffffff', text: '#2b2418', contrast: '#2b2418' },
    [Color.Green]: { fill: '#1f9e94', text: '#06231f', contrast: '#06231f' },
    [Color.Blue]: { fill: '#8cc8ef', text: '#0d2433', contrast: '#0d2433' }
}
