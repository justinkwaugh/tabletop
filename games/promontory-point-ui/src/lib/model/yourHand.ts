import type { HydratedPromontoryPointGameState, RailroadId } from '@tabletop/promontory-point'
import { RAILROAD_TAGS } from './railroadTags.js'
import { currentTurnPlayerId } from './seatView.js'
import type { TurnPanel } from './turnPanel.js'

export enum HandSlotKind {
    // A piece already placed this turn: an empty disc where it stood.
    Placed = 'Placed',
    Piece = 'Piece'
}

export type HandSlot =
    | { kind: HandSlotKind.Placed }
    | {
          kind: HandSlotKind.Piece
          railroadId: RailroadId
          tag: string
          pickable: boolean
          picked: boolean
          noRoom: boolean
          // R-6.3-H2: the variant's kept piece, carried over face up.
          kept: boolean
      }

export type YourHand = {
    heading: string
    // Outside the viewer's own turn the hand is shown dimmed and takes no press.
    dimmed: boolean
    slots: HandSlot[]
    // R-6.1-H2: what the hand reads when the bag left it nothing.
    note?: string
}

const placed = (count: number): HandSlot[] =>
    Array.from({ length: count }, () => ({ kind: HandSlotKind.Placed }))

const shown = (railroadId: RailroadId, kept = false): HandSlot => ({
    kind: HandSlotKind.Piece,
    railroadId,
    tag: RAILROAD_TAGS[railroadId],
    pickable: false,
    picked: false,
    noRoom: false,
    kept
})

// Contract, "Your hand": the viewer's own pieces beside the map (a bar under the board on a
// phone). In its turn, the turn panel's pieces, pressed to pick (O-2); outside it, the viewer's
// own next hand, dimmed (R-5: only the viewer's own concealed pieces). A spectator has none.
export function yourHand(
    panel: TurnPanel | undefined,
    state: HydratedPromontoryPointGameState,
    viewerId: string | undefined
): YourHand | undefined {
    if (panel !== undefined) {
        return {
            heading: panel.piecesHeading,
            dimmed: false,
            slots: [
                ...placed(panel.placedCount),
                ...panel.pieces.map((piece): HandSlot => ({
                    kind: HandSlotKind.Piece,
                    ...piece,
                    kept: false
                }))
            ]
        }
    }
    if (
        viewerId === undefined ||
        // Contract, "Game end": no hand once the game has a result, by its own end or a call.
        state.result !== undefined ||
        !state.players.some((player) => player.playerId === viewerId)
    ) {
        return undefined
    }
    // The viewer's turn while another seat decides (R-4.3-H4) or before its panel opens.
    if (state.turn !== undefined && currentTurnPlayerId(state) === viewerId) {
        return {
            heading: 'Your pieces',
            dimmed: true,
            slots: [
                ...placed(state.turn.placementsMade),
                ...state.turn.pieces.map((railroadId) => shown(railroadId))
            ]
        }
    }
    const player = state.getPlayerState(viewerId)
    const slots = [
        ...player.knownHand().map((railroadId) => shown(railroadId)),
        ...(player.keptPiece === undefined ? [] : [shown(player.keptPiece, true)])
    ]
    return {
        heading: 'Your next pieces',
        dimmed: true,
        slots,
        ...(slots.length === 0 ? { note: 'none left in the bag' } : {})
    }
}
