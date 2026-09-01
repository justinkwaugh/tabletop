import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { getSquare } from '../model/board.js'
import { isValidSetupKnightSquare, legalSetupKnightSquares } from '../util/setupKnightSquares.js'

export type PlaceSetupKnightMetadata = Type.Static<typeof PlaceSetupKnightMetadata>
export const PlaceSetupKnightMetadata = Type.Object({})

// The second half of a setup placement: the knight that goes beside the castle just
// placed by PlaceCastle. Which castle is not carried on the action - state.pendingSetupCastle
// records it, so there is exactly one castle this can ever be answering.
export type PlaceSetupKnight = Type.Static<typeof PlaceSetupKnight>
export const PlaceSetupKnight = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceSetupKnight), // This action is always this type
            playerId: Type.String(), // Required now
            knightCol: Type.Number(),
            knightRow: Type.Number(),
            metadata: Type.Optional(PlaceSetupKnightMetadata) // Always optional, because it is an output
        })
    ])
)

export const PlaceSetupKnightValidator = Compile(PlaceSetupKnight)

export function isPlaceSetupKnight(action?: GameAction): action is PlaceSetupKnight {
    return action?.type === ActionType.PlaceSetupKnight
}

export class HydratedPlaceSetupKnight
    extends HydratableAction<typeof PlaceSetupKnight>
    implements PlaceSetupKnight
{
    declare type: ActionType.PlaceSetupKnight
    declare playerId: string
    declare knightCol: number
    declare knightRow: number
    declare metadata?: PlaceSetupKnightMetadata

    constructor(data: PlaceSetupKnight) {
        super(data, PlaceSetupKnightValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidPlaceSetupKnight(state)) {
            throw Error('Invalid PlaceSetupKnight action')
        }

        const pending = state.pendingSetupCastle
        assert(pending !== undefined, 'PlaceSetupKnight requires a castle awaiting its knight')

        // The knight belongs to whoever owns the castle it was placed for, which is the
        // neutral prince on the neutral laps rather than the player making the placement.
        const castleSquare = getSquare(state.board, pending.col, pending.row)
        assert(
            castleSquare?.castleOwner !== undefined,
            'The pending setup castle has no castle on its square'
        )
        const owner = castleSquare.castleOwner

        state.board.squares[this.knightRow][this.knightCol] = {
            ...state.board.squares[this.knightRow][this.knightCol],
            knightOwner: owner
        }

        // The neutral prince's placements aren't drawn from any player's own knight stock.
        if (owner === this.playerId) {
            state.getPlayerState(this.playerId).knightsInStock -= 1
        }

        state.pendingSetupCastle = undefined
        this.metadata = {}
    }

    isValidPlaceSetupKnight(state: HydratedLowenherzGameState): boolean {
        const pending = state.pendingSetupCastle
        if (!pending || pending.playerId !== this.playerId) return false
        return isValidSetupKnightSquare(
            state,
            pending.col,
            pending.row,
            this.knightCol,
            this.knightRow
        )
    }

    static canPlaceSetupKnight(state: HydratedLowenherzGameState, playerId: string): boolean {
        return state.pendingSetupCastle?.playerId === playerId
    }

    // The squares the UI may offer for the castle currently awaiting its knight.
    static legalKnightSquares(
        state: HydratedLowenherzGameState,
        playerId: string
    ): { col: number; row: number }[] {
        const pending = state.pendingSetupCastle
        if (!pending || pending.playerId !== playerId) return []
        return legalSetupKnightSquares(state, pending.col, pending.row)
    }
}
