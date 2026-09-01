import * as Type from 'typebox'

// Who a piece on the board belongs to: a playerId, or the neutral prince.
//
// Pieces are keyed by owner rather than by color because a viewer's preferred-color
// setting can re-map which color an owner is drawn in (see GameColors.getPlayerColor),
// so a color does not identify an owner. The prince is not a player and has no
// playerId, so it needs a value of its own.
export const NEUTRAL_OWNER = 'neutral'

export type PieceOwner = Type.Static<typeof PieceOwner>
export const PieceOwner = Type.String()

export function isNeutralOwner(owner?: PieceOwner): boolean {
    return owner === NEUTRAL_OWNER
}
