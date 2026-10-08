import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { KoggePalette } from './palette.js'

const LIGHT_PLAYER_COLORS = new Set([Color.Yellow])

export class KoggeColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && KoggePalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Red:
                return 'bg-[#c0342b]'
            case Color.Green:
                return 'bg-[#2f7d3b]'
            case Color.Blue:
                return 'bg-[#2d64b4]'
            case Color.Yellow:
                return 'bg-[#efc02e]'
            default:
                return super.getBgColor(color)
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Red:
                return 'border-[#c0342b]'
            case Color.Green:
                return 'border-[#2f7d3b]'
            case Color.Blue:
                return 'border-[#2d64b4]'
            case Color.Yellow:
                return 'border-[#efc02e]'
            default:
                return super.getBorderColor(color)
        }
    }

    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (asPlayerColor || !color) {
            return super.getTextColor(color, asPlayerColor)
        }
        return LIGHT_PLAYER_COLORS.has(color) ? 'text-[#2a1d0c]' : 'text-white'
    }

    override getBorderContrastColor(color?: Color): string {
        return color && LIGHT_PLAYER_COLORS.has(color) ? 'border-[#2a1d0c]' : 'border-white'
    }
}
