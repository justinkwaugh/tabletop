import { ActionSource } from '@tabletop/common'
import type { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { BOARD_COLS, BOARD_ROWS } from '../model/board.js'
import { HydratedExpandRegion, type ExpandRegionSpace } from '../actions/expandRegion.js'
import { HydratedPlaceKnight } from '../actions/placeKnight.js'
import { HydratedPlaceWall } from '../actions/placeWall.js'
import { HydratedPlaceCastle } from '../actions/placeCastle.js'
import { HydratedNegotiationMove, NegotiationMoveKind } from '../actions/negotiationMove.js'
import { HydratedSubmitDuelBid } from '../actions/submitDuelBid.js'
import { HydratedLookAtPoliticsPile } from '../actions/lookAtPoliticsPile.js'
import { HydratedTakePoliticsCard } from '../actions/takePoliticsCard.js'
import { HydratedPlayRenegadeCard } from '../actions/playRenegadeCard.js'
import { HydratedPlayAllianceCard } from '../actions/playAllianceCard.js'
import { HydratedCancelAlliance } from '../actions/cancelAlliance.js'

// "Would this move be legal, and if not why?" - asked of the actions themselves, which are
// the only authority on the rules, but without every caller hand-building a throwaway
// action to ask with.
//
// The client used to construct `id: 'candidate'` actions inline at fourteen sites (two of
// them building the same PlaceWall field-for-field), and the board-wide scans below built a
// fresh action per square: ~150 allocations each, every one running its compiled typebox
// validator, recomputed on every reactive read. These wrappers keep the single source of
// truth - the action's own invalid*Reason - while making the construction the engine's
// business, and the scans reuse ONE candidate across all squares, mutating the coordinates
// between checks. The validator only guards against malformed action data, and these are
// built from typed parameters, so there's nothing for it to catch on the hot path.
//
// Board scans live here rather than in the UI for the same reason PlaceCastle.legalCastleSquares
// does: what counts as legal is a rules question.

export function expandRegionReason(
    state: HydratedLowenherzGameState,
    playerId: string,
    regionId: string,
    space: ExpandRegionSpace
): string | undefined {
    return candidateExpandRegion(state, playerId, regionId, space).invalidExpandRegionReason(state)
}

// Every square that would legally extend the given region right now.
export function legalExpansionSquares(
    state: HydratedLowenherzGameState,
    playerId: string,
    regionId: string
): { col: number; row: number }[] {
    const candidate = candidateExpandRegion(state, playerId, regionId, { col: 0, row: 0 })
    const result: { col: number; row: number }[] = []
    for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
            candidate.space = { col, row }
            if (candidate.isValidExpandRegion(state)) result.push({ col, row })
        }
    }
    return result
}

export function placeKnightReason(
    state: HydratedLowenherzGameState,
    playerId: string,
    col: number,
    row: number,
    treasureCardId?: string
): string | undefined {
    return candidatePlaceKnight(state, playerId, col, row, treasureCardId).invalidPlaceKnightReason(state)
}

// Every square the player could legally place a knight on. treasureCardIdFor lets the caller
// decide, per square, whether an armed Treasure card would be spent there - a wooded square
// costs ducats otherwise, so the answer can differ square by square.
export function legalKnightSquares(
    state: HydratedLowenherzGameState,
    playerId: string,
    treasureCardIdFor?: (col: number, row: number) => string | undefined
): { col: number; row: number }[] {
    const candidate = candidatePlaceKnight(state, playerId, 0, 0, undefined)
    const result: { col: number; row: number }[] = []
    for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
            candidate.col = col
            candidate.row = row
            candidate.treasureCardId = treasureCardIdFor?.(col, row)
            if (candidate.isValidPlaceKnight(state)) result.push({ col, row })
        }
    }
    return result
}

export function placeWallReason(
    state: HydratedLowenherzGameState,
    playerId: string,
    col1: number,
    row1: number,
    col2: number,
    row2: number
): string | undefined {
    return candidatePlaceWall(state, playerId, col1, row1, col2, row2).invalidPlaceWallReason(state)
}

// Every square edge a wall could legally go on. Each adjacent pair is visited once, as the
// east and south neighbours of the square it belongs to.
export function legalWallEdges(
    state: HydratedLowenherzGameState,
    playerId: string
): { col1: number; row1: number; col2: number; row2: number }[] {
    const candidate = candidatePlaceWall(state, playerId, 0, 0, 1, 0)
    const result: { col1: number; row1: number; col2: number; row2: number }[] = []
    const check = (col1: number, row1: number, col2: number, row2: number) => {
        candidate.col1 = col1
        candidate.row1 = row1
        candidate.col2 = col2
        candidate.row2 = row2
        if (candidate.isValidPlaceWall(state)) result.push({ col1, row1, col2, row2 })
    }
    for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
            if (col + 1 < BOARD_COLS) check(col, row, col + 1, row)
            if (row + 1 < BOARD_ROWS) check(col, row, col, row + 1)
        }
    }
    return result
}

function candidateExpandRegion(
    state: HydratedLowenherzGameState,
    playerId: string,
    regionId: string,
    space: ExpandRegionSpace
): HydratedExpandRegion {
    return new HydratedExpandRegion({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.ExpandRegion,
        playerId,
        regionId,
        space
    })
}

function candidatePlaceKnight(
    state: HydratedLowenherzGameState,
    playerId: string,
    col: number,
    row: number,
    treasureCardId: string | undefined
): HydratedPlaceKnight {
    return new HydratedPlaceKnight({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PlaceKnight,
        playerId,
        col,
        row,
        ...(treasureCardId ? { treasureCardId } : {})
    })
}

function candidatePlaceWall(
    state: HydratedLowenherzGameState,
    playerId: string,
    col1: number,
    row1: number,
    col2: number,
    row2: number
): HydratedPlaceWall {
    return new HydratedPlaceWall({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PlaceWall,
        playerId,
        col1,
        row1,
        col2,
        row2
    })
}

// The remaining one-off checks. Each mirrors an action's own invalid*Reason - the actions stay
// the authority, these just spare every caller the ceremony of building one to ask.

// Boolean rather than a reason string: PlaceCastle reports its problems through
// describeCastleSquareProblem (a typed problem code the UI turns into wording), so there's no
// invalid*Reason here to mirror.
export function placeCastleIsValid(
    state: HydratedLowenherzGameState,
    playerId: string,
    castleCol: number,
    castleRow: number,
    knightCol: number,
    knightRow: number
): boolean {
    return new HydratedPlaceCastle({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PlaceCastle,
        playerId,
        castleCol,
        castleRow,
        knightCol,
        knightRow
    }).isValidPlaceCastle(state)
}

export function negotiationProposalIsValid(
    state: HydratedLowenherzGameState,
    playerId: string,
    fromPlayerId: string,
    amount: number
): boolean {
    return new HydratedNegotiationMove({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.NegotiationMove,
        playerId,
        kind: NegotiationMoveKind.Propose,
        fromPlayerId,
        amount
    }).isValidNegotiationMove(state)
}

export function duelBidIsValid(
    state: HydratedLowenherzGameState,
    playerId: string,
    amount: number,
    treasureCardIds?: string[]
): boolean {
    return new HydratedSubmitDuelBid({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.SubmitDuelBid,
        playerId,
        amount,
        ...(treasureCardIds && treasureCardIds.length > 0 ? { treasureCardIds } : {})
    }).isValidSubmitDuelBid(state)
}

export function lookAtPoliticsPileReason(
    state: HydratedLowenherzGameState,
    playerId: string,
    pile: 'A' | 'B'
): string | undefined {
    return new HydratedLookAtPoliticsPile({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.LookAtPoliticsPile,
        playerId,
        pile,
        revealsInfo: true
    }).invalidLookAtPoliticsPileReason(state)
}

export function takePoliticsCardReason(
    state: HydratedLowenherzGameState,
    playerId: string,
    pile: 'A' | 'B',
    cardId: string
): string | undefined {
    return new HydratedTakePoliticsCard({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.TakePoliticsCard,
        playerId,
        pile,
        cardId,
        revealsInfo: true
    }).invalidTakePoliticsCardReason(state)
}

export function playRenegadeCardReason(
    state: HydratedLowenherzGameState,
    playerId: string,
    params: {
        cardId: string
        ownRegionId: string
        enemyRegionId: string
        removedCol: number
        removedRow: number
        placedCol: number
        placedRow: number
    }
): string | undefined {
    return new HydratedPlayRenegadeCard({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PlayRenegadeCard,
        playerId,
        ...params
    }).invalidPlayRenegadeCardReason(state)
}

export function playAllianceCardReason(
    state: HydratedLowenherzGameState,
    playerId: string,
    params: { cardId: string; ownRegionId: string; enemyRegionId: string }
): string | undefined {
    return new HydratedPlayAllianceCard({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.PlayAllianceCard,
        playerId,
        ...params
    }).invalidPlayAllianceCardReason(state)
}

export function cancelAllianceReason(
    state: HydratedLowenherzGameState,
    playerId: string,
    allianceId: string
): string | undefined {
    return new HydratedCancelAlliance({
        id: 'candidate',
        gameId: state.gameId,
        source: ActionSource.User,
        type: ActionType.CancelAlliance,
        playerId,
        allianceId
    }).invalidCancelAllianceReason(state)
}
