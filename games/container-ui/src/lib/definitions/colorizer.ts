import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class ContainerGameColorizer extends DefaultColorizer {
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
            case Color.Black:
                return '#444444'
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
                return 'bg-[#aaaaaa]'
            case Color.Black:
                return 'bg-[#444444]'
            default:
                return 'bg-[#555555]'
        }
    }

    override getBorderColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return 'border-[#539ad1]'
            case Color.Red:
                return 'border-[#e55649]'
            case Color.Yellow:
                return 'border-[#f3c244]'
            case Color.Green:
                return 'border-[#63b878]'
            case Color.Purple:
                return 'border-[#804796]'
            case Color.Gray:
                return 'border-[#888888]'
            case Color.Black:
                return 'border-[#444444]'
            default:
                return 'border-[#555555]'
        }
    }
}
