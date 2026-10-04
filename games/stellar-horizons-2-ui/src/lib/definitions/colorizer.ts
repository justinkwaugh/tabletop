import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { StellarHorizonsPalette } from './palette.js'

const BG_CLASSES: Partial<Record<Color, string>> = {
    [Color.Brown]: 'bg-[#a8916a]',
    [Color.Green]: 'bg-[#5fa443]',
    [Color.Purple]: 'bg-[#8f3f92]',
    [Color.Blue]: 'bg-[#2f8fd0]',
    [Color.Red]: 'bg-[#c8402f]',
    [Color.Black]: 'bg-[#3a3d44]',
    [Color.Yellow]: 'bg-[#d9b23c]'
}

const BORDER_CLASSES: Partial<Record<Color, string>> = {
    [Color.Brown]: 'border-[#a8916a]',
    [Color.Green]: 'border-[#5fa443]',
    [Color.Purple]: 'border-[#8f3f92]',
    [Color.Blue]: 'border-[#2f8fd0]',
    [Color.Red]: 'border-[#c8402f]',
    [Color.Black]: 'border-[#3a3d44]',
    [Color.Yellow]: 'border-[#d9b23c]'
}

const LIGHT_COLORS = new Set([Color.Brown, Color.Green, Color.Yellow])

export class StellarHorizonsColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && StellarHorizonsPalette[color]?.fill) ?? super.getUiColor(color)
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
        return LIGHT_COLORS.has(color) ? 'text-black' : 'text-white'
    }

    override getBorderContrastColor(color?: Color): string {
        return color && LIGHT_COLORS.has(color) ? 'border-black' : 'border-white'
    }
}
