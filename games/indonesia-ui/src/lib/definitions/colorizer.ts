import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class IndonesiaGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return '#90cace'
            case Color.Red:
                return '#e55649'
            case Color.Yellow:
                return '#decd66'
            case Color.Green:
                return '#50823c'
            case Color.Purple:
                return '#aa387f'
            case Color.Gray:
                return '#888888'
            case Color.Orange:
                return '#e78e52'
            case Color.Black:
                return '#444444'
            default:
                return '#555555'
        }
    }

    override getBgColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return 'bg-[#90cace]'
            case Color.Red:
                return 'bg-[#e55649]'
            case Color.Yellow:
                return 'bg-[#decd66]'
            case Color.Green:
                return 'bg-[#50823c]'
            case Color.Purple:
                return 'bg-[#aa387f]'
            case Color.Gray:
                return 'bg-[#aaaaaa]'
            case Color.Black:
                return 'bg-[#444444]'
            case Color.Orange:
                return 'bg-[#e78e52]'
            default:
                return 'bg-[#555555]'
        }
    }

    override getBorderColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return 'border-[#90cace]'
            case Color.Red:
                return 'border-[#e55649]'
            case Color.Yellow:
                return 'border-[#decd66]'
            case Color.Green:
                return 'border-[#50823c]'
            case Color.Purple:
                return 'border-[#aa387f]'
            case Color.Gray:
                return 'border-[#888888]'
            case Color.Black:
                return 'border-[#444444]'
            case Color.Orange:
                return 'border-[#e78e52]'
            default:
                return 'border-[#555555]'
        }
    }
}
