import { Color } from '@tabletop/common'
import { Side } from '../components/pieces.js'

export const SIDE_COLORS: Record<Side, Color> = {
    [Side.French]: Color.Blue,
    [Side.Allied]: Color.Red
}

export const NapoleonsTriumphColors = [Color.Blue, Color.Red]
