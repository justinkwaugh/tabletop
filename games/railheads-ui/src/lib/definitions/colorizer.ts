import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { RailheadsPalette } from './palette.js'

const LIGHT_PLAYER_COLORS = new Set([Color.Pink, Color.Orange, Color.Blue])

export class RailheadsColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && RailheadsPalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Pink:
                return 'bg-[#d9609c]'
            case Color.Purple:
                return 'bg-[#7a4fb4]'
            case Color.Orange:
                return 'bg-[#e88a2a]'
            case Color.Blue:
                return 'bg-[#2aa198]'
            case Color.Gray:
                return 'bg-[#5d6b7a]'
            default:
                return super.getBgColor(color)
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Pink:
                return 'border-[#d9609c]'
            case Color.Purple:
                return 'border-[#7a4fb4]'
            case Color.Orange:
                return 'border-[#e88a2a]'
            case Color.Blue:
                return 'border-[#2aa198]'
            case Color.Gray:
                return 'border-[#5d6b7a]'
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
