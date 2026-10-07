import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class UrbinoGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.White:
                return '#f3e6cc'
            case Color.Brown:
                return '#b8693a'
            default:
                return '#888888'
        }
    }

    override getBgColor(color?: string): string {
        switch (color) {
            case Color.White:
                return 'bg-[#f3e6cc]'
            case Color.Brown:
                return 'bg-[#b8693a]'
            default:
                return 'bg-[#888888]'
        }
    }

    override getBorderColor(color?: string): string {
        switch (color) {
            case Color.White:
                return 'border-[#f3e6cc]'
            case Color.Brown:
                return 'border-[#b8693a]'
            default:
                return 'border-[#888888]'
        }
    }
}
