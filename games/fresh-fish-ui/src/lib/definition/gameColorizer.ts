import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class FreshFishColorizer extends DefaultColorizer {
    override getUiColor(color: Color): string {
        switch (color) {
            case Color.Blue:
                return '#0d56ad'
            case Color.Red:
                return '#ad0207'
            case Color.Green:
                return '#016e0a'
            case Color.Yellow:
                return '#fae54b'
            case Color.Purple:
                return '#9a0ee6'
            default:
                return '#555555'
        }
    }

    override getBgColor(color: Color): string {
        switch (color) {
            case Color.Blue:
                return 'bg-[#0d56ad]'
            case Color.Red:
                return 'bg-[#ad0207]'
            case Color.Green:
                return 'bg-[#016e0a]'
            case Color.Yellow:
                return 'bg-[#fae54b]'
            case Color.Purple:
                return 'bg-[#9a0ee6]'
            default:
                return 'bg-[#555555]'
        }
    }
}
