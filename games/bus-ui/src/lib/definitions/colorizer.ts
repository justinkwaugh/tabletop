import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class BusGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return '#0c66b4'
            case Color.Red:
                return '#ef2519'
            case Color.Yellow:
                return '#fba01c'
            case Color.Green:
                return '#097858'
            case Color.Purple:
                return '#6e385c'
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
                return 'bg-[#0c66b4]'
            case Color.Red:
                return 'bg-[#ef2519]'
            case Color.Yellow:
                return 'bg-[#fba01c]'
            case Color.Green:
                return 'bg-[#097858]'
            case Color.Purple:
                return 'bg-[#6e385c]'
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
                return 'border-[#0c66b4]'
            case Color.Red:
                return 'border-[#ef2519]'
            case Color.Yellow:
                return 'border-[#fba01c]'
            case Color.Green:
                return 'border-[#097858]'
            case Color.Purple:
                return 'border-[#6e385c]'
            case Color.Gray:
                return 'border-[#888888]'
            case Color.Black:
                return 'border-[#444444]'
            default:
                return 'border-[#555555]'
        }
    }
}
