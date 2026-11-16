import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { RideTheRailsSeatPalette } from './seatPalette.js'

const DARK_INK_COLORS = new Set([Color.Pink, Color.White, Color.Gray])

const BG_CLASSES: Partial<Record<Color, string>> = {
    [Color.Green]: 'bg-[#15736e]',
    [Color.Pink]: 'bg-[#f2a0d6]',
    [Color.White]: 'bg-[#94c43a]',
    [Color.Brown]: 'bg-[#6e4126]',
    [Color.Gray]: 'bg-[#8c939b]'
}

const BORDER_CLASSES: Partial<Record<Color, string>> = {
    [Color.Green]: 'border-[#15736e]',
    [Color.Pink]: 'border-[#f2a0d6]',
    [Color.White]: 'border-[#94c43a]',
    [Color.Brown]: 'border-[#6e4126]',
    [Color.Gray]: 'border-[#8c939b]'
}

export class RideTheRailsGameColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && RideTheRailsSeatPalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        return (color && BG_CLASSES[color]) ?? super.getBgColor(color)
    }

    override getBorderColor(color?: Color): string {
        return (color && BORDER_CLASSES[color]) ?? super.getBorderColor(color)
    }

    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (asPlayerColor || !color) {
            return super.getTextColor(color, asPlayerColor)
        }
        return DARK_INK_COLORS.has(color) ? 'text-[#1b1b1b]' : 'text-white'
    }

    override getBorderContrastColor(color?: Color): string {
        return color && DARK_INK_COLORS.has(color) ? 'border-[#1b1b1b]' : 'border-white'
    }
}
