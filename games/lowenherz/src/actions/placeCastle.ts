import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    castleSquaresForColor,
    getSquare,
    manhattanDistance,
    neighbors,
    SquareType
} from '../model/board.js'
import { buildPlacementPlan, currentPlacementSlot } from '../util/placementPlan.js'

const SAME_COLOR_CASTLE_MIN_GAP = 6

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
            knightCol: Type.Number(),
            knightRow: Type.Number(),
            metadata: Type.Optional(PlaceCastleMetadata) // Always optional, because it is an output
        })
    ])
)

export const PlaceCastleValidator = Compile(PlaceCastle)

export function isPlaceCastle(action?: GameAction): action is PlaceCastle {
    return action?.type === ActionType.PlaceCastle
}

// The color the NEXT setup placement will actually be - the acting player's own for the
// first laps, then the shared neutral color for the final ones (3 players place 1 neutral
// castle each, 2 players place 2 - see buildPlacementPlan). Undefined once setup is done.
// Exported because the client needs it to preview the piece it's about to place: showing
// the player's own color through the neutral laps means the ghost castles/knights change
// color from seat to seat when every one of them is going to be neutral.
export function currentPlacementColor(state: HydratedLowenherzGameState): Color | undefined {
    const plan = buildPlacementPlan(
        state.turnOrder,
        (playerId) => state.getPlayerState(playerId).color,
        state.neutralColor
    )
    return currentPlacementSlot(plan, totalCastlesPlaced(state))?.color
}

// The total number of castles (any color) currently on the board - this always equals
// how many setup placements have happened so far, since placement is the only way a
// castle ever appears on the board.
function totalCastlesPlaced(state: HydratedLowenherzGameState): number {
    let count = 0
    for (const row of state.board.squares) {
        for (const square of row) {
            if (square.castleColor) count++
        }
    }
    return count
}

export class HydratedPlaceCastle extends HydratableAction<typeof PlaceCastle> implements PlaceCastle {
    declare type: ActionType.PlaceCastle
    declare playerId: string
    declare castleCol: number
    declare castleRow: number
    declare knightCol: number
    declare knightRow: number
    declare metadata?: PlaceCastleMetadata

    constructor(data: PlaceCastle) {
        super(data, PlaceCastleValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidPlaceCastle(state)) {
            throw Error('Invalid PlaceCastle action')
        }

        const slot = currentPlacementSlot(this.buildPlan(state), totalCastlesPlaced(state))!

        state.board.squares[this.castleRow][this.castleCol] = {
            ...state.board.squares[this.castleRow][this.castleCol],
            castleColor: slot.color
        }
        state.board.squares[this.knightRow][this.knightCol] = {
            ...state.board.squares[this.knightRow][this.knightCol],
            knightColor: slot.color
        }

        const playerState = state.getPlayerState(this.playerId)
        // Neutral-color placements aren't drawn from any player's own knight stock.
        if (slot.color === playerState.color) {
            playerState.knightsInStock -= 1
        }

        this.metadata = {}
    }

    private buildPlan(state: HydratedLowenherzGameState) {
        return buildPlacementPlan(
            state.turnOrder,
            (playerId) => state.getPlayerState(playerId).color,
            state.neutralColor
        )
    }

    isValidPlaceCastle(state: HydratedLowenherzGameState): boolean {
        if (!HydratedPlaceCastle.isValidCastleSquare(state, this.playerId, this.castleCol, this.castleRow)) {
            return false
        }
        return HydratedPlaceCastle.isValidKnightSquare(
            state,
            this.castleCol,
            this.castleRow,
            this.knightCol,
            this.knightRow
        )
    }

    static canPlaceCastle(state: HydratedLowenherzGameState, playerId: string): boolean {
        const plan = buildPlacementPlan(
            state.turnOrder,
            (id) => state.getPlayerState(id).color,
            state.neutralColor
        )
        const slot = currentPlacementSlot(plan, totalCastlesPlaced(state))
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
        const plan = buildPlacementPlan(
            state.turnOrder,
            (id) => state.getPlayerState(id).color,
            state.neutralColor
        )
        const slot = currentPlacementSlot(plan, totalCastlesPlaced(state))
        if (!slot || slot.playerId !== playerId) return 'notYourTurn'

        const castleSquare = getSquare(state.board, castleCol, castleRow)
        if (!castleSquare || castleSquare.type !== SquareType.Blank) return 'wrongTerrain'
        if (castleSquare.castleColor || castleSquare.knightColor) return 'occupied'

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
        if (!HydratedPlaceCastle.hasLegalKnightSquare(state, castleCol, castleRow)) {
            return 'noKnightSquare'
        }

        const existingSameColorCastles = castleSquaresForColor(state.board, slot.color)
        const requiredGap = HydratedPlaceCastle.requiredCastleGap(state, slot.color)
        const tooClose = existingSameColorCastles.some(
            (existing) =>
                manhattanDistance(existing.col, existing.row, castleCol, castleRow) < requiredGap
        )
        return tooClose ? 'tooClose' : undefined
    }

    // The same-colour spacing this placement actually has to clear. Normally the rulebook's
    // "at least 6 spaces between them", but relaxed to the best the board still offers when
    // NOTHING clears 6.
    //
    // Setup places 12 castles under a hard spacing rule with no Pass and no take-backs, so a
    // sequence of individually legal placements can leave the next one with nowhere to go -
    // the game then hangs before turn 1. Random legal play reached that state in roughly
    // 1 in 500 two-player games (the variant places four own-colour castles each, so its
    // spacing is by far the tightest). Rather than let a game die at setup, the requirement
    // degrades to the largest gap any legal square can offer, which still spreads castles as
    // far apart as the board permits. It only ever engages when the strict rule is
    // unsatisfiable, so ordinary games are unaffected.
    static requiredCastleGap(state: HydratedLowenherzGameState, color: Color): number {
        const existing = castleSquaresForColor(state.board, color)
        if (existing.length === 0) return SAME_COLOR_CASTLE_MIN_GAP

        let bestAchievableGap = 0
        for (let row = 0; row < state.board.squares.length; row++) {
            for (let col = 0; col < state.board.squares[row].length; col++) {
                const square = getSquare(state.board, col, row)
                if (!square || square.type !== SquareType.Blank) continue
                if (square.castleColor || square.knightColor) continue
                if (!HydratedPlaceCastle.hasLegalKnightSquare(state, col, row)) continue

                let nearest = Number.POSITIVE_INFINITY
                for (const castle of existing) {
                    nearest = Math.min(nearest, manhattanDistance(castle.col, castle.row, col, row))
                }
                if (nearest >= SAME_COLOR_CASTLE_MIN_GAP) return SAME_COLOR_CASTLE_MIN_GAP
                bestAchievableGap = Math.max(bestAchievableGap, nearest)
            }
        }
        return bestAchievableGap
    }

    static isValidKnightSquare(
        state: HydratedLowenherzGameState,
        castleCol: number,
        castleRow: number,
        knightCol: number,
        knightRow: number
    ): boolean {
        const isAdjacentToCastle = neighbors(castleCol, castleRow).some(
            (n) => n.col === knightCol && n.row === knightRow
        )
        if (!isAdjacentToCastle) return false

        const knightSquare = getSquare(state.board, knightCol, knightRow)
        if (!knightSquare) return false
        // Knights may never be placed on wooded spaces during setup (only during
        // regular in-game play, where they're allowed for a ducat cost).
        if (knightSquare.type !== SquareType.Blank) return false
        if (knightSquare.castleColor || knightSquare.knightColor) return false

        return true
    }

    static hasLegalKnightSquare(
        state: HydratedLowenherzGameState,
        castleCol: number,
        castleRow: number
    ): boolean {
        return neighbors(castleCol, castleRow).some((n) =>
            HydratedPlaceCastle.isValidKnightSquare(state, castleCol, castleRow, n.col, n.row)
        )
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
