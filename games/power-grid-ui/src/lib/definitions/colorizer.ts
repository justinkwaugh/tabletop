import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { PowerGridPalette } from './palette.js'

const LIGHT_PLAYER_COLORS = new Set([Color.Yellow])

export class PowerGridColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && PowerGridPalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Red:
                return 'bg-[#c43d2f]'
            case Color.Blue:
                return 'bg-[#2f6fb8]'
            case Color.Green:
                return 'bg-[#3e8e41]'
            case Color.Yellow:
                return 'bg-[#e8c12e]'
            case Color.Purple:
                return 'bg-[#7d4c9e]'
            case Color.Black:
                return 'bg-[#34312e]'
            default:
                return super.getBgColor(color)
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Red:
                return 'border-[#c43d2f]'
            case Color.Blue:
                return 'border-[#2f6fb8]'
            case Color.Green:
                return 'border-[#3e8e41]'
            case Color.Yellow:
                return 'border-[#e8c12e]'
            case Color.Purple:
                return 'border-[#7d4c9e]'
            case Color.Black:
                return 'border-[#34312e]'
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
