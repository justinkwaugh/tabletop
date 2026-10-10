import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { NapoleonsTriumphPalette } from './palette.js'

export class NapoleonsTriumphColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && NapoleonsTriumphPalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Blue:
                return 'bg-[#1f62a6]'
            case Color.Red:
                return 'bg-[#a9282c]'
            default:
                return super.getBgColor(color)
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Blue:
                return 'border-[#1f62a6]'
            case Color.Red:
                return 'border-[#a9282c]'
            default:
                return super.getBorderColor(color)
        }
    }

    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (asPlayerColor || !color) {
            return super.getTextColor(color, asPlayerColor)
        }
        return 'text-white'
    }

    override getBorderContrastColor(_color?: Color): string {
        return 'border-white'
    }
}
