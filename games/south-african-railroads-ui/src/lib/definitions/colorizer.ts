import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { SarPalette } from './palette.js'

const LIGHT_PLAYER_COLORS = new Set([Color.Pink, Color.Orange, Color.Blue])

export class SarColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && SarPalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Pink:
                return 'bg-[#e46fae]'
            case Color.Purple:
                return 'bg-[#7a4fb4]'
            case Color.Orange:
                return 'bg-[#ee8a2c]'
            case Color.Red:
                return 'bg-[#7e2141]'
            case Color.Blue:
                return 'bg-[#72c4ea]'
            case Color.Gray:
                return 'bg-[#68717d]'
            default:
                return super.getBgColor(color)
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Pink:
                return 'border-[#e46fae]'
            case Color.Purple:
                return 'border-[#7a4fb4]'
            case Color.Orange:
                return 'border-[#ee8a2c]'
            case Color.Red:
                return 'border-[#7e2141]'
            case Color.Blue:
                return 'border-[#72c4ea]'
            case Color.Gray:
                return 'border-[#68717d]'
            default:
                return super.getBorderColor(color)
        }
    }

    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (asPlayerColor || !color) {
            return super.getTextColor(color, asPlayerColor)
        }
        return LIGHT_PLAYER_COLORS.has(color) ? 'text-black' : 'text-white'
    }

    override getBorderContrastColor(color?: Color): string {
        return color && LIGHT_PLAYER_COLORS.has(color) ? 'border-black' : 'border-white'
    }
}
