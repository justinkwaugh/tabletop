import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { MedinaPalette } from './palette.js'

export class MedinaColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && MedinaPalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Red:
                return 'bg-[#c0242a]'
            case Color.Blue:
                return 'bg-[#1a5cc0]'
            case Color.Green:
                return 'bg-[#258c36]'
            case Color.Yellow:
                return 'bg-[#ecbf1c]'
            default:
                return super.getBgColor(color)
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Red:
                return 'border-[#c0242a]'
            case Color.Blue:
                return 'border-[#1a5cc0]'
            case Color.Green:
                return 'border-[#258c36]'
            case Color.Yellow:
                return 'border-[#ecbf1c]'
            default:
                return super.getBorderColor(color)
        }
    }

    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (asPlayerColor || !color) {
            return super.getTextColor(color, asPlayerColor)
        }
        return color === Color.Yellow ? 'text-black' : 'text-white'
    }

    override getBorderContrastColor(color?: Color): string {
        return color === Color.Yellow ? 'border-black' : 'border-white'
    }
}
