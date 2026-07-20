import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

// The real game's 4 colors are Rose, Gold, Purple, Gray - Pink/Yellow stand in for
// Rose/Gold since the shared Color enum has no exact match (see LowenherzColors).
export class LowenherzGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        switch (color) {
            case Color.Pink:
                return '#c9647f'
            case Color.Yellow:
                return '#d4af37'
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
            case Color.Pink:
                return 'bg-[#c9647f]'
            case Color.Yellow:
                return 'bg-[#d4af37]'
            case Color.Purple:
                return 'bg-[#804796]'
            case Color.Gray:
                return 'bg-[#aaaaaa]'
            default:
                return 'bg-[#555555]'
        }
    }

    override getBorderColor(color?: string): string {
        switch (color) {
            case Color.Pink:
                return 'border-[#c9647f]'
            case Color.Yellow:
                return 'border-[#d4af37]'
            case Color.Purple:
                return 'border-[#804796]'
            case Color.Gray:
                return 'border-[#888888]'
            default:
                return 'border-[#555555]'
        }
    }
}
