import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'
import { MagnaGreciaPalette } from './palette.js'

export class MagnaGreciaColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        return (color && MagnaGreciaPalette[color]?.fill) ?? super.getUiColor(color)
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Yellow:
                return 'bg-[#e3b12f]'
            case Color.Orange:
                return 'bg-[#dd7431]'
            case Color.Brown:
                return 'bg-[#7b4b2a]'
            case Color.Red:
                return 'bg-[#b8322a]'
            default:
                return super.getBgColor(color)
        }
    }

    override getBorderColor(color?: Color): string {
        switch (color) {
            case Color.Yellow:
                return 'border-[#e3b12f]'
            case Color.Orange:
                return 'border-[#dd7431]'
            case Color.Brown:
                return 'border-[#7b4b2a]'
            case Color.Red:
                return 'border-[#b8322a]'
            default:
                return super.getBorderColor(color)
        }
    }
}
