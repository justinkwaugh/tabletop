import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class EstatesGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return '#539ad1'
            case Color.Red:
                return '#e55649'
            case Color.Yellow:
                return '#f3c244'
            case Color.Green:
                return '#63b878'
            case Color.Purple:
                return '#804796'
            case Color.Gray:
                return '#888888'
            default:
                return '#555555'
        }
    }

    override getBgColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return 'bg-[#539ad1]'
            case Color.Red:
                return 'bg-[#e55649]'
            case Color.Yellow:
                return 'bg-[#f3c244]'
            case Color.Green:
                return 'bg-[#63b878]'
            case Color.Purple:
                return 'bg-[#804796]'
            case Color.Gray:
                return 'bg-[#888888]'
            default:
                return 'bg-[#555555]'
        }
    }
}
