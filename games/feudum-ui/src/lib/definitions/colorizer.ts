import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class FeudumGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return '#2563eb'
            case Color.Red:
                return '#b91c1c'
            case Color.Yellow:
                return '#fde047'
            case Color.Green:
                return '#16a34a'
            case Color.Purple:
                return '#9333ea'
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
                return 'bg-[#2563eb]'
            case Color.Red:
                return 'bg-[#b91c1c]'
            case Color.Yellow:
                return 'bg-[#fde047]'
            case Color.Green:
                return 'bg-[#16a34a]'
            case Color.Purple:
                return 'bg-[#9333ea]'
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
                return 'border-[#2563eb]'
            case Color.Red:
                return 'border-[#b91c1c]'
            case Color.Yellow:
                return 'border-[#fde047]'
            case Color.Green:
                return 'border-[#16a34a]'
            case Color.Purple:
                return 'border-[#9333ea]'
            case Color.Gray:
                return 'border-[#888888]'
            case Color.Black:
                return 'border-[#444444]'
            default:
                return 'border-[#555555]'
        }
    }
}
