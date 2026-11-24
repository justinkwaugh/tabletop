import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { LwPalette } from './palette.js'

const LIGHT_PLAYER_COLORS = new Set([Color.Orange, Color.Pink])

const BACKGROUNDS: Partial<Record<Color, string>> = {
    [Color.Purple]: 'bg-[#6d4f9c]',
    [Color.Orange]: 'bg-[#e38b2c]',
    [Color.Pink]: 'bg-[#d7709f]',
    [Color.Brown]: 'bg-[#7b5534]',
    [Color.Black]: 'bg-[#2f2c28]'
}

const BORDERS: Partial<Record<Color, string>> = {
    [Color.Purple]: 'border-[#6d4f9c]',
    [Color.Orange]: 'border-[#e38b2c]',
    [Color.Pink]: 'border-[#d7709f]',
    [Color.Brown]: 'border-[#7b5534]',
    [Color.Black]: 'border-[#2f2c28]'
}

export class LwColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && LwPalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        return (color && BACKGROUNDS[color]) ?? super.getBgColor(color)
    }

    override getBorderColor(color?: Color): string {
        return (color && BORDERS[color]) ?? super.getBorderColor(color)
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
