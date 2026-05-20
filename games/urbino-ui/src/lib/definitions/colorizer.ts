import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class UrbinoGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.White:
                return '#f5f0e8'
            case Color.Brown:
                return '#a05a2c'
            default:
                return '#888888'
        }
    }

    override getBgColor(color?: string): string {
        switch (color) {
            case Color.White:
                return 'bg-[#f5f0e8]'
            case Color.Brown:
                return 'bg-[#a05a2c]'
            default:
                return 'bg-[#888888]'
        }
    }

    override getBorderColor(color?: string): string {
        switch (color) {
            case Color.White:
                return 'border-[#f5f0e8]'
            case Color.Brown:
                return 'border-[#a05a2c]'
            default:
                return 'border-[#888888]'
        }
    }
}
