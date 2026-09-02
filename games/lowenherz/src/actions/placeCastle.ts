import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    castleSquaresForOwner,
    getSquare,
    manhattanDistance,
    neighbors,
    SquareType,
    totalCastlesPlaced
} from '../model/board.js'
import { buildPlacementPlan, currentPlacementSlot } from '../util/placementPlan.js'
import { hasLegalSetupKnightSquare } from '../util/setupKnightSquares.js'
import { PieceOwner } from '../model/owner.js'

const SAME_OWNER_CASTLE_MIN_GAP = 6

function placementPlanFor(state: HydratedLowenherzGameState) {
    return buildPlacementPlan(state.turnOrder, state.neutralColor !== undefined)
}

// Specific reasons a candidate castle square can be rejected - see
// describeCastleSquareProblem(). Not "wrong-terrain"/"occupied" combined into one
// generic reason because the UI needs to tell them apart to report accurately.
export type CastleSquareProblem =
    | 'notYourTurn'
    | 'wrongTerrain'
    | 'occupied'
    | 'noKnightSquare'
    | 'tooClose'

export type PlaceCastleMetadata = Type.Static<typeof PlaceCastleMetadata>
export const PlaceCastleMetadata = Type.Object({})

export type PlaceCastle = Type.Static<typeof PlaceCastle>
export const PlaceCastle = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.PlaceCastle), // This action is always this type
            playerId: Type.String(), // Required now
            castleCol: Type.Number(),
            castleRow: Type.Number(),
            metadata: Type.Optional(PlaceCastleMetadata) // Always optional, because it is an output
        })
    ])
)

export const PlaceCastleValidator = Compile(PlaceCastle)

export function isPlaceCastle(action?: GameAction): action is PlaceCastle {
    return action?.type === ActionType.PlaceCastle
}

// Who the NEXT setup placement will belong to - the acting player for the first laps,
// then the neutral prince for the final ones (3 players place 1 neutral castle each,
// 2 players place 2 - see buildPlacementPlan). Undefined once setup is done.
// Exported because the client needs it to preview the piece it's about to place: showing
// the player's own color through the neutral laps means the ghost castles/knights change
// color from seat to seat when every one of them is going to be neutral.
export function currentPlacementOwner(state: HydratedLowenherzGameState): PieceOwner | undefined {
    return currentPlacementSlot(placementPlanFor(state), totalCastlesPlaced(state.board))?.owner
}

export class HydratedPlaceCastle extends HydratableAction<typeof PlaceCastle> implements PlaceCastle {
    declare type: ActionType.PlaceCastle
    declare playerId: string
    declare castleCol: number
    declare castleRow: number
    declare metadata?: PlaceCastleMetadata

    constructor(data: PlaceCastle) {
        super(data, PlaceCastleValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidPlaceCastle(state)) {
            throw Error('Invalid PlaceCastle action')
        }

        const slot = currentPlacementSlot(placementPlanFor(state), totalCastlesPlaced(state.board))!

        state.board.squares[this.castleRow][this.castleCol] = {
            ...state.board.squares[this.castleRow][this.castleCol],
            castleOwner: slot.owner
        }

        // The knight is placed by PlaceSetupKnight, which reads this to know which castle
        // it is answering and therefore whose knight it is. Its stock is debited there too.
        state.pendingSetupCastle = {
            col: this.castleCol,
            row: this.castleRow,
            playerId: this.playerId
        }

        this.metadata = {}
    }

    isValidPlaceCastle(state: HydratedLowenherzGameState): boolean {
        return HydratedPlaceCastle.isValidCastleSquare(
            state,
            this.playerId,
            this.castleCol,
            this.castleRow
        )
    }

    static canPlaceCastle(state: HydratedLowenherzGameState, playerId: string): boolean {
        const slot = currentPlacementSlot(placementPlanFor(state), totalCastlesPlaced(state.board))
        return slot?.playerId === playerId
    }

    // Everything about a candidate castle square that doesn't depend on which knight
    // square goes with it - lets the UI validate/highlight a castle square the instant
    // it's picked, rather than waiting until the knight square is also chosen.
    static isValidCastleSquare(
        state: HydratedLowenherzGameState,
        playerId: string,
        castleCol: number,
        castleRow: number
    ): boolean {
        return (
            HydratedPlaceCastle.describeCastleSquareProblem(state, playerId, castleCol, castleRow) ===
            undefined
        )
    }

    // Same check as isValidCastleSquare, but says WHICH rule rejected the square -
    // the 4 conditions below are otherwise indistinguishable from a single boolean,
    // which previously left the UI unable to tell "it's not your turn" apart from
    // "that spot is too close to your own castle" (a claim that's nonsensically wrong
    // when this is a player's very first castle).
    static describeCastleSquareProblem(
        state: HydratedLowenherzGameState,
        playerId: string,
        castleCol: number,
        castleRow: number
    ): CastleSquareProblem | undefined {
        const slot = currentPlacementSlot(placementPlanFor(state), totalCastlesPlaced(state.board))
        if (!slot || slot.playerId !== playerId) return 'notYourTurn'

        const castleSquare = getSquare(state.board, castleCol, castleRow)
        if (!castleSquare || castleSquare.type !== SquareType.Blank) return 'wrongTerrain'
        if (castleSquare.castleOwner || castleSquare.knightOwner) return 'occupied'

        // A castle arrives with a knight beside it, so a square with nowhere legal to put that
        // knight is not a placement that can be completed - it is a dead end that only reveals
        // itself on the second click, after the castle appears to have been placed.
        //
        // legalCastleSquares has always excluded these; this check is what makes
        // isValidCastleSquare agree with it. The two disagreeing is what let a player select an
        // isolated square that the board had already greyed out.
        //
        // Asked before the spacing rule on purpose: requiredCastleGap measures the best gap
        // available among squares that DO have a knight square, so reporting 'tooClose' for a
        // square that was never viable would name the wrong reason.
        if (!hasLegalSetupKnightSquare(state, castleCol, castleRow)) {
            return 'noKnightSquare'
        }

        const existingSameOwnerCastles = castleSquaresForOwner(state.board, slot.owner)
        const requiredGap = HydratedPlaceCastle.requiredCastleGap(state, slot.owner)
        const tooClose = existingSameOwnerCastles.some(
            (existing) =>
                manhattanDistance(existing.col, existing.row, castleCol, castleRow) < requiredGap
        )
        return tooClose ? 'tooClose' : undefined
    }

    // The same-owner spacing this placement actually has to clear. Normally the rulebook's
    // "at least 6 spaces between them", but relaxed to the best the board still offers when
    // NOTHING clears 6.
    //
    // Setup places 12 castles under a hard spacing rule with no Pass and no take-backs, so a
    // sequence of individually legal placements can leave the next one with nowhere to go -
    // the game then hangs before turn 1. Random legal play reached that state in roughly
    // 1 in 500 two-player games (the variant places four castles of their own each, so its
    // spacing is by far the tightest). Rather than let a game die at setup, the requirement
    // degrades to the largest gap any legal square can offer, which still spreads castles as
    // far apart as the board permits. It only ever engages when the strict rule is
    // unsatisfiable, so ordinary games are unaffected.
    static requiredCastleGap(state: HydratedLowenherzGameState, owner: PieceOwner): number {
        const existing = castleSquaresForOwner(state.board, owner)
        if (existing.length === 0) return SAME_OWNER_CASTLE_MIN_GAP

        let bestAchievableGap = 0
        for (let row = 0; row < state.board.squares.length; row++) {
            for (let col = 0; col < state.board.squares[row].length; col++) {
                const square = getSquare(state.board, col, row)
                if (!square || square.type !== SquareType.Blank) continue
                if (square.castleOwner || square.knightOwner) continue
                if (!hasLegalSetupKnightSquare(state, col, row)) continue

                let nearest = Number.POSITIVE_INFINITY
                for (const castle of existing) {
                    nearest = Math.min(nearest, manhattanDistance(castle.col, castle.row, col, row))
                }
                if (nearest >= SAME_OWNER_CASTLE_MIN_GAP) return SAME_OWNER_CASTLE_MIN_GAP
                bestAchievableGap = Math.max(bestAchievableGap, nearest)
            }
        }
        return bestAchievableGap
    }

    // All castle squares currently legal for this player - a square only counts if it
    // also has at least one legal adjacent knight square, since a castle placement that
    // can never be completed isn't a real option.
    static legalCastleSquares(
        state: HydratedLowenherzGameState,
        playerId: string
    ): { col: number; row: number }[] {
        const result: { col: number; row: number }[] = []
        for (let row = 0; row < state.board.squares.length; row++) {
            for (let col = 0; col < state.board.squares[row].length; col++) {
                // No separate hasLegalKnightSquare test any more: isValidCastleSquare asks it,
                // so this list and that predicate cannot drift apart again.
                if (HydratedPlaceCastle.isValidCastleSquare(state, playerId, col, row)) {
                    result.push({ col, row })
                }
            }
        }
        return result
    }
}
