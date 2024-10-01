import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class KaivaiGameColorizer extends DefaultColorizer {
    override getUiColor(color?: Color): string {
        switch (color) {
            case Color.Blue:
                return '#3d467c'
            case Color.Red:
                return '#c14239'
            case Color.Yellow:
                return '#ffee86'
            case Color.Green:
                return '#759329'
            default:
                return '#555555'
        }
    }

    override getBgColor(color?: Color): string {
        switch (color) {
            case Color.Blue:
                return 'bg-[#3d467c]'
            case Color.Red:
                return 'bg-[#c14239]'
            case Color.Yellow:
                return 'bg-[#ffee86]'
            case Color.Green:
                return 'bg-[#759329]'
            default:
                return 'bg-[#555555]'
        }
    }
}
