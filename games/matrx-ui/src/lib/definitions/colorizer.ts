import { Color } from '@tabletop/common'
import { DefaultColorizer } from '@tabletop/frontend-components'

export class MatrxGameColorizer extends DefaultColorizer {
    override getUiColor(color?: string): string {
        return color === Color.White ? '#ece7dc' : '#16171a'
    }

    override getBgColor(color?: string): string {
        return color === Color.White ? 'bg-[#ece7dc]' : 'bg-[#16171a]'
    }

    override getBorderColor(color?: string): string {
        return color === Color.White ? 'border-[#ece7dc]' : 'border-[#16171a]'
    }
}
