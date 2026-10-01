import { Color } from '@tabletop/common'
import { MarketColor } from './marketColor.js'

const marketColors: readonly string[] = Object.values(MarketColor)

export const MarracashColors: Color[] = Object.values(Color).filter(
    (color) => !marketColors.includes(color)
)
