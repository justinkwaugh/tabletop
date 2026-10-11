import { Color } from '@tabletop/common'
import type { PlayerColorPalette } from '@tabletop/frontend-components/definition/gameUiDefinition'
import { Side } from '@tabletop/napoleons-triumph'

const ARMY_BLOCK_COLORS: Record<Side, string> = {
    [Side.French]: '#1f62a6',
    [Side.Allied]: '#a9282c'
}

export const NapoleonsTriumphPalette: PlayerColorPalette = {
    [Color.Blue]: { fill: ARMY_BLOCK_COLORS[Side.French], text: '#ffffff', contrast: '#ffffff' },
    [Color.Red]: { fill: ARMY_BLOCK_COLORS[Side.Allied], text: '#ffffff', contrast: '#ffffff' }
}
