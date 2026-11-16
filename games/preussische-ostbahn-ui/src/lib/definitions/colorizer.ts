import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { OstbahnPalette } from './palette.js'

const DARK_TEXT_COLORS = new Set([Color.Pink, Color.White, Color.Green, Color.Blue])

const BG_CLASSES: Partial<Record<Color, string>> = {
    [Color.Pink]: 'bg-[#d9609c]',
    [Color.Gray]: 'bg-[#6c7884]',
    [Color.White]: 'bg-[#ffffff]',
    [Color.Green]: 'bg-[#1f9e94]',
    [Color.Blue]: 'bg-[#8cc8ef]'
}

const BORDER_CLASSES: Partial<Record<Color, string>> = {
    [Color.Pink]: 'border-[#d9609c]',
    [Color.Gray]: 'border-[#6c7884]',
    [Color.White]: 'border-[#ffffff]',
    [Color.Green]: 'border-[#1f9e94]',
    [Color.Blue]: 'border-[#8cc8ef]'
}

export class OstbahnColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && OstbahnPalette[color]?.fill) ?? super.getUiColor(color)
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
        return DARK_TEXT_COLORS.has(color) ? 'text-black' : 'text-white'
    }

    override getBorderContrastColor(color?: Color): string {
        return color && DARK_TEXT_COLORS.has(color) ? 'border-black' : 'border-white'
    }
}
