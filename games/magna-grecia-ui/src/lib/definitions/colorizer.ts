import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { MagnaGreciaPalette } from './palette.js'

const LIGHT_PLAYER_COLORS = new Set([Color.Yellow, Color.Blue])

export class MagnaGreciaColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && MagnaGreciaPalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Red:
                return 'bg-[#c8461f]'
            case Color.Yellow:
                return 'bg-[#f5e04a]'
            case Color.Gray:
                return 'bg-[#686d73]'
            case Color.Blue:
                return 'bg-[#4a94d0]'
            default:
                return super.getBgColor(color)
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Red:
                return 'border-[#c8461f]'
            case Color.Yellow:
                return 'border-[#f5e04a]'
            case Color.Gray:
                return 'border-[#686d73]'
            case Color.Blue:
                return 'border-[#4a94d0]'
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
