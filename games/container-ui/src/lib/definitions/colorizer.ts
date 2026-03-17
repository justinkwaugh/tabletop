import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class ContainerGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return '#00b4ac'
            case Color.Orange:
                return '#f89f3a'
            case Color.Purple:
                return '#895591'
            case Color.Pink:
                return '#f1709a'
            case Color.Brown:
                return '#69504d'
            default:
                return '#555555'
        }
    }

    override getBgColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return 'bg-[#00b4ac]'
            case Color.Orange:
                return 'bg-[#f89f3a]'
            case Color.Purple:
                return 'bg-[#895591]'
            case Color.Pink:
                return 'bg-[#f1709a]'
            case Color.Brown:
                return 'bg-[#69504d]'
            default:
                return 'bg-[#555555]'
        }
    }

    override getBorderColor(color?: string): string {
        switch (color) {
            case Color.Blue:
                return 'border-[#00b4ac]'
            case Color.Orange:
                return 'border-[#f89f3a]'
            case Color.Purple:
                return 'border-[#895591]'
            case Color.Pink:
                return 'border-[#f1709a]'
            case Color.Brown:
                return 'border-[#69504d]'
            default:
                return 'border-[#555555]'
        }
    }
}
