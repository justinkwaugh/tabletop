import { Side } from '@tabletop/napoleons-triumph'

/** A side's turn as the turn header and the history name it. */
export const TURN_TITLES: Record<Side, string> = {
    [Side.Allied]: 'Allies’ turn',
    [Side.French]: 'French turn'
}
