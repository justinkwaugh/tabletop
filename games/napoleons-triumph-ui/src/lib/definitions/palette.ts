import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Side } from '@tabletop/napoleons-triumph'

/** The armies keep the colours of their wooden blocks: French blue and Allied red. */
export const ARMY_COLORS: Record<Side, { block: string; shade: string; ink: string }> = {
    [Side.French]: { block: '#1f62a6', shade: '#174a80', ink: '#f4f1e6' },
    [Side.Allied]: { block: '#a9282c', shade: '#801d21', ink: '#f4f1e6' }
}

export const NapoleonsTriumphPalette: PlayerColorPalette = {
    [Color.Blue]: { fill: ARMY_COLORS[Side.French].block, text: '#ffffff', contrast: '#ffffff' },
    [Color.Red]: { fill: ARMY_COLORS[Side.Allied].block, text: '#ffffff', contrast: '#ffffff' }
}
