import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { HcgPalette } from './palette.js'

const LIGHT_PLAYER_COLORS = new Set([Color.Yellow, Color.Pink, Color.Blue])

export class HcgColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && HcgPalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Yellow:
                return 'bg-[#f7e03c]'
            case Color.Purple:
                return 'bg-[#8a3fd1]'
            case Color.Pink:
                return 'bg-[#ff6ec7]'
            case Color.Blue:
                return 'bg-[#19b8c0]'
            case Color.Black:
                return 'bg-[#141414]'
            default:
                return super.getBgColor(color)
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Yellow:
                return 'border-[#f7e03c]'
            case Color.Purple:
                return 'border-[#8a3fd1]'
            case Color.Pink:
                return 'border-[#ff6ec7]'
            case Color.Blue:
                return 'border-[#19b8c0]'
            case Color.Black:
                return 'border-[#141414]'
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
