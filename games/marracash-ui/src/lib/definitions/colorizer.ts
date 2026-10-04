import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class MarracashGameColorizer extends DefaultColorizer {
    override getTextColor(color?: Color, asPlayerColor: boolean = false): string {
        if (!asPlayerColor && color === Color.White) {
            return 'text-black'
        }
        return super.getTextColor(color, asPlayerColor)
    }

    override getBorderContrastColor(color?: Color): string {
        return color === Color.White ? 'border-black' : super.getBorderContrastColor(color)
    }
}
