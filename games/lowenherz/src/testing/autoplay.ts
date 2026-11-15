import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import { LowenherzRuntime } from '../definition/runtime.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { ActionCardType, type StandardActionCard } from '../definition/actionCards.js'
import { PoliticsCardType, type PoliticsCard } from '../definition/politicsCards.js'
import type { HydratedLowenherzGameState, LowenherzProjectedState } from '../model/gameState.js'
import {
    BOARD_COLS,
    BOARD_ROWS,
    castleSquaresForOwner,
    getSquare,
    isWalledBetween,
    manhattanDistance,
    parseSquareKey,
    squareKey,
    SquareType,
    wallBetween
} from '../model/board.js'
import { HydratedPlaceCastle } from '../actions/placeCastle.js'
import { HydratedPlaceSetupKnight, type PlaceSetupKnight } from '../actions/placeSetupKnight.js'
import { NegotiationMoveKind } from '../actions/negotiationMove.js'
import type { ChooseAction } from '../actions/chooseAction.js'
import type { SubmitDuelBid } from '../actions/submitDuelBid.js'
import type { LookAtPoliticsPile } from '../actions/lookAtPoliticsPile.js'
import type { TakePoliticsCard } from '../actions/takePoliticsCard.js'
import { detectNewRegions } from '../util/regionDetection.js'
import { knightActionOptions } from '../util/knightActionHelpers.js'
import {
    duelBidIsValid,
    legalExpansionSquares,
    legalKnightSquares,
    legalWallEdges,
    lookAtPoliticsPileReason,
    negotiationProposalIsValid,
    playRenegadeCardReason,
    takePoliticsCardReason
} from '../util/legality.js'

type Square = { col: number; row: number }
type WallEdgeCandidate = { col1: number; row1: number; col2: number; row2: number }
type ActionBase = { id: string; gameId: string; source: ActionSource; playerId: string }

const MAX_ENCLOSURE_WIDTH = 5
const MAX_ENCLOSURE_HEIGHT = 4
const TAKE_PREFERENCE = [
    PoliticsCardType.Parchment,
    PoliticsCardType.Renegade,
    PoliticsCardType.Treasure,
    PoliticsCardType.Alliance
]

export function nextAction(state: LowenherzProjectedState, gameId: string): GameAction {
    const hydrated = LowenherzRuntime.hydrator.hydrateState(state)
    const playerId = hydrated.activePlayerIds[0]
    assertExists(playerId, `No player can act in ${hydrated.machineState}`)
    const base: ActionBase = {
        id: `autoplay-${hydrated.actionCount}`,
        gameId,
        source: ActionSource.User,
        playerId
    }

    switch (hydrated.machineState) {
        case MachineState.PlacingCastles:
            return { ...base, type: ActionType.PlaceCastle, ...castleSquare(hydrated, playerId) }
        case MachineState.PlacingSetupKnight: {
            const squares = HydratedPlaceSetupKnight.legalKnightSquares(hydrated, playerId)
            const square = pick(squares, seatIndex(hydrated, playerId))
            const knight: PlaceSetupKnight = {
                ...base,
                type: ActionType.PlaceSetupKnight,
                knightCol: square.col,
                knightRow: square.row
            }
            return knight
        }
        case MachineState.StartOfTurn:
            return { ...base, type: ActionType.DrawActionCard }
        case MachineState.ChoosingActions: {
            const choice: ChooseAction = {
                ...base,
                type: ActionType.ChooseAction,
                slot: chosenSlot(hydrated, playerId)
            }
            return renegadePlay(hydrated, base) ?? choice
        }
        case MachineState.Negotiating:
            return negotiationMove(hydrated, base)
        case MachineState.Dueling: {
            const bid: SubmitDuelBid = {
                ...base,
                type: ActionType.SubmitDuelBid,
                amount: duelBid(hydrated, playerId)
            }
            return bid
        }
        case MachineState.PlacingWalls: {
            const edge = chosenWall(hydrated, playerId)
            return edge
                ? { ...base, type: ActionType.PlaceWall, ...edge }
                : { ...base, type: ActionType.Pass }
        }
        case MachineState.PlacingKnights:
            return knightMove(hydrated, base)
        case MachineState.TakingPoliticsCard:
            return politicsMove(hydrated, base)
        case MachineState.ResolvingActions:
        case MachineState.EndOfGame:
            throw new Error(`No player action in ${hydrated.machineState}`)
    }
}

function seatIndex(state: HydratedLowenherzGameState, playerId: string): number {
    return state.players.findIndex((player) => player.playerId === playerId)
}

function pick<T>(options: T[], seed: number): T {
    const option = options[seed % options.length]
    assertExists(option, 'Autoplay found no legal option')
    return option
}

function castleSquare(state: HydratedLowenherzGameState, playerId: string) {
    const squares = HydratedPlaceCastle.legalCastleSquares(state, playerId)
    const square = pick(squares, seatIndex(state, playerId) * 7 + state.actionCount * 13)
    return { castleCol: square.col, castleRow: square.row }
}

function chosenSlot(state: HydratedLowenherzGameState, playerId: string): 1 | 2 | 3 {
    const card = state.currentActionCard
    assertExists(card, 'Choosing actions requires a face-up card')
    if (card.type !== ActionCardType.Standard)
        throw new Error('Choosing actions requires a standard card')
    const used = new Set(state.decisions.filter((d) => d.playerId === playerId).map((d) => d.slot))
    const favoured = ((seatIndex(state, playerId) + state.actionCount) % 3) + 1
    const slots = ([1, 2, 3] as const).filter((slot) => !used.has(slot))
    const value = (slot: 1 | 2 | 3) =>
        slotValue(state, playerId, card, slot) + (slot === favoured ? 2 : 0)
    return slots.reduce((best, slot) => (value(slot) > value(best) ? slot : best))
}

function slotValue(
    state: HydratedLowenherzGameState,
    playerId: string,
    card: StandardActionCard,
    slot: 1 | 2 | 3
): number {
    if (slot === 1) return card.top.kind === 'income' ? card.top.value / 2 : 3
    const band = slot === 2 ? card.middle : card.bottom
    if (band.kind === 'border')
        return unenclosedCastles(state, playerId).length > 0 ? band.count * 2 : 0
    const ownsRegion = state.regions.some((region) => region.owner === playerId)
    return band.count + (ownsRegion ? 3 : 0)
}

function negotiationMove(state: HydratedLowenherzGameState, base: ActionBase): GameAction {
    const negotiation = state.negotiation
    assertExists(negotiation, 'Negotiating requires a negotiation')
    const playerId = base.playerId
    const otherId = negotiation.playerIds.find((id) => id !== playerId)
    assertExists(otherId, 'Negotiation needs two players')
    const decline = { ...base, type: ActionType.NegotiationMove, kind: NegotiationMoveKind.Decline }
    const propose = (fromPlayerId: string, amount: number) => ({
        ...base,
        type: ActionType.NegotiationMove,
        kind: NegotiationMoveKind.Propose,
        fromPlayerId,
        amount
    })

    if (state.actionCount % 4 === 0) return decline

    const offer = negotiation.offer
    if (offer && negotiationProposalIsValid(state, playerId, offer.fromPlayerId, offer.amount)) {
        return propose(offer.fromPlayerId, offer.amount)
    }

    const amount = 1 + ((seatIndex(state, playerId) + state.actionCount) % 3)
    for (const fromPlayerId of [playerId, otherId]) {
        if (negotiationProposalIsValid(state, playerId, fromPlayerId, amount)) {
            return propose(fromPlayerId, amount)
        }
    }
    return decline
}

function duelBid(state: HydratedLowenherzGameState, playerId: string): number {
    const money = state.getPlayerState(playerId).getMoney()
    const amount = Math.min(money, (seatIndex(state, playerId) * 3 + state.actionCount) % 6)
    if (!duelBidIsValid(state, playerId, amount)) throw new Error(`Duel bid ${amount} is invalid`)
    return amount
}

function unenclosedCastles(state: HydratedLowenherzGameState, playerId: string): Square[] {
    const enclosed = new Set(state.regions.map((region) => region.castleSquareKey))
    return castleSquaresForOwner(state.board, playerId).filter(
        (castle) => !enclosed.has(squareKey(castle.col, castle.row))
    )
}

function chosenWall(
    state: HydratedLowenherzGameState,
    playerId: string
): WallEdgeCandidate | undefined {
    const legal = legalWallEdges(state, playerId)
    if (legal.length === 0) return undefined
    return (
        legal.find((edge) => enclosesOwnRegion(state, playerId, edge)) ??
        enclosurePlanWall(state, playerId, legal) ??
        nearestWallToOwnCastle(state, playerId, legal)
    )
}

function enclosesOwnRegion(
    state: HydratedLowenherzGameState,
    playerId: string,
    edge: WallEdgeCandidate
): boolean {
    const wall = wallBetween(edge.col1, edge.row1, edge.col2, edge.row2)
    assertExists(wall, 'Legal wall edges join adjacent squares')
    const board = { ...state.board, walls: [...state.board.walls, wall] }
    return detectNewRegions(board, state.regions).some((region) => region.owner === playerId)
}

// The cheapest legal rectangle around one of the player's open castles, walled one edge
// at a time across turns; the board edge counts as a wall, so corners come cheap.
function enclosurePlanWall(
    state: HydratedLowenherzGameState,
    playerId: string,
    legal: WallEdgeCandidate[]
): WallEdgeCandidate | undefined {
    const legalKeys = new Set(legal.map(edgeKey))
    let best: { missing: WallEdgeCandidate[]; area: number } | undefined
    for (const castle of unenclosedCastles(state, playerId)) {
        for (const rectangle of rectanglesAround(castle)) {
            if (!isEnclosable(state, playerId, castle, rectangle)) continue
            const missing = boundaryEdges(rectangle).filter(
                (edge) => !isWalledBetween(state.board, edge.col1, edge.row1, edge.col2, edge.row2)
            )
            if (missing.length === 0 || !missing.every((edge) => legalKeys.has(edgeKey(edge))))
                continue
            const area =
                (rectangle.col1 - rectangle.col0 + 1) * (rectangle.row1 - rectangle.row0 + 1)
            if (
                !best ||
                missing.length < best.missing.length ||
                (missing.length === best.missing.length && area > best.area)
            ) {
                best = { missing, area }
            }
        }
    }
    return best?.missing[0]
}

type Rectangle = { col0: number; row0: number; col1: number; row1: number }

function rectanglesAround(castle: Square): Rectangle[] {
    const rectangles: Rectangle[] = []
    for (let width = 1; width <= MAX_ENCLOSURE_WIDTH; width++) {
        for (let height = 1; height <= MAX_ENCLOSURE_HEIGHT; height++) {
            for (let col0 = castle.col - width + 1; col0 <= castle.col; col0++) {
                for (let row0 = castle.row - height + 1; row0 <= castle.row; row0++) {
                    const col1 = col0 + width - 1
                    const row1 = row0 + height - 1
                    if (col0 < 0 || row0 < 0 || col1 >= BOARD_COLS || row1 >= BOARD_ROWS) continue
                    rectangles.push({ col0, row0, col1, row1 })
                }
            }
        }
    }
    return rectangles
}

function isEnclosable(
    state: HydratedLowenherzGameState,
    playerId: string,
    castle: Square,
    rectangle: Rectangle
): boolean {
    const claimed = new Set(state.regions.flatMap((region) => region.squareKeys))
    for (let row = rectangle.row0; row <= rectangle.row1; row++) {
        for (let col = rectangle.col0; col <= rectangle.col1; col++) {
            if (claimed.has(squareKey(col, row))) return false
            const square = getSquare(state.board, col, row)
            const isTargetCastle = col === castle.col && row === castle.row
            if (square?.castleOwner && !isTargetCastle) return false
            if (square?.knightOwner && square.knightOwner !== playerId) return false
        }
    }
    return true
}

function boundaryEdges(rectangle: Rectangle): WallEdgeCandidate[] {
    const edges: WallEdgeCandidate[] = []
    for (let col = rectangle.col0; col <= rectangle.col1; col++) {
        if (rectangle.row0 > 0)
            edges.push({ col1: col, row1: rectangle.row0 - 1, col2: col, row2: rectangle.row0 })
        if (rectangle.row1 < BOARD_ROWS - 1)
            edges.push({ col1: col, row1: rectangle.row1, col2: col, row2: rectangle.row1 + 1 })
    }
    for (let row = rectangle.row0; row <= rectangle.row1; row++) {
        if (rectangle.col0 > 0)
            edges.push({ col1: rectangle.col0 - 1, row1: row, col2: rectangle.col0, row2: row })
        if (rectangle.col1 < BOARD_COLS - 1)
            edges.push({ col1: rectangle.col1, row1: row, col2: rectangle.col1 + 1, row2: row })
    }
    return edges
}

function edgeKey(edge: WallEdgeCandidate): string {
    return `${edge.col1},${edge.row1}:${edge.col2},${edge.row2}`
}

function nearestWallToOwnCastle(
    state: HydratedLowenherzGameState,
    playerId: string,
    legal: WallEdgeCandidate[]
): WallEdgeCandidate {
    const castles = castleSquaresForOwner(state.board, playerId)
    const distance = (edge: WallEdgeCandidate) =>
        Math.min(
            ...castles.map((castle) =>
                manhattanDistance(castle.col, castle.row, edge.col1, edge.row1)
            )
        )
    return legal.reduce((best, edge) => (distance(edge) < distance(best) ? edge : best))
}

function knightMove(state: HydratedLowenherzGameState, base: ActionBase): GameAction {
    const playerId = base.playerId
    const options = knightActionOptions(state, playerId)
    const expand = (regionId: string, space: Square) => ({
        ...base,
        type: ActionType.ExpandRegion,
        regionId,
        space
    })
    const place = (square: Square) => ({ ...base, type: ActionType.PlaceKnight, ...square })

    if (options.canContinueExpansion && state.expandingRegionId) {
        const squares = legalExpansionSquares(state, playerId, state.expandingRegionId)
        const square = preferredExpansion(state, squares)
        if (square) return expand(state.expandingRegionId, square)
    }

    const expansions = options.canStartExpansion ? expansionOptions(state, playerId) : []
    const invasion = expansions.find((option) => isInEnemyRegion(state, playerId, option.square))
    if (invasion) return expand(invasion.regionId, invasion.square)

    const knightSquares = options.canPlaceKnight ? legalKnightSquares(state, playerId) : []
    const ownRegionKeys = new Set(
        state.regions
            .filter((region) => region.owner === playerId)
            .flatMap((region) => region.squareKeys)
    )
    const inOwnRegion = knightSquares.find((square) =>
        ownRegionKeys.has(squareKey(square.col, square.row))
    )
    if (inOwnRegion) return place(inOwnRegion)

    const expansion = expansions.find((option) => isVillage(state, option.square)) ?? expansions[0]
    if (expansion) return expand(expansion.regionId, expansion.square)

    const blank = knightSquares.filter(
        (square) => getSquare(state.board, square.col, square.row)?.type === SquareType.Blank
    )
    if (blank.length > 0) return place(pick(blank, seatIndex(state, playerId) + state.actionCount))
    if (knightSquares.length > 0) return place(pick(knightSquares, state.actionCount))

    return { ...base, type: ActionType.Pass }
}

function expansionOptions(
    state: HydratedLowenherzGameState,
    playerId: string
): { regionId: string; square: Square }[] {
    return state.regions
        .filter((region) => region.owner === playerId)
        .flatMap((region) =>
            legalExpansionSquares(state, playerId, region.id).map((square) => ({
                regionId: region.id,
                square
            }))
        )
}

function preferredExpansion(
    state: HydratedLowenherzGameState,
    squares: Square[]
): Square | undefined {
    return squares.find((square) => isVillage(state, square)) ?? squares[0]
}

function isVillage(state: HydratedLowenherzGameState, square: Square): boolean {
    return getSquare(state.board, square.col, square.row)?.type === SquareType.Village
}

function isInEnemyRegion(
    state: HydratedLowenherzGameState,
    playerId: string,
    square: Square
): boolean {
    const key = squareKey(square.col, square.row)
    return state.regions.some(
        (region) =>
            region.owner !== undefined &&
            region.owner !== playerId &&
            region.squareKeys.includes(key)
    )
}

function renegadePlay(state: HydratedLowenherzGameState, base: ActionBase): GameAction | undefined {
    const playerId = base.playerId
    const player = state.getPlayerState(playerId)
    const holdsRenegade = player
        .getPoliticsCards()
        .some((card) => card.type === PoliticsCardType.Renegade)
    if (!holdsRenegade || player.knightsInStock <= 0) return undefined

    const ownRegions = state.regions.filter((region) => region.owner === playerId)
    const enemyRegions = state.regions.filter(
        (region) => region.owner !== undefined && region.owner !== playerId
    )
    for (const ownRegion of ownRegions) {
        for (const enemyRegion of enemyRegions) {
            for (const removedKey of enemyRegion.squareKeys) {
                const [removedCol, removedRow] = parseSquareKey(removedKey)
                if (
                    getSquare(state.board, removedCol, removedRow)?.knightOwner !==
                    enemyRegion.owner
                )
                    continue
                for (const placedKey of ownRegion.squareKeys) {
                    const [placedCol, placedRow] = parseSquareKey(placedKey)
                    const params = {
                        ownRegionId: ownRegion.id,
                        enemyRegionId: enemyRegion.id,
                        removedCol,
                        removedRow,
                        placedCol,
                        placedRow
                    }
                    if (playRenegadeCardReason(state, playerId, params) === undefined) {
                        return { ...base, type: ActionType.PlayRenegadeCard, ...params }
                    }
                }
            }
        }
    }
    return undefined
}

function politicsMove(state: HydratedLowenherzGameState, base: ActionBase): GameAction {
    const playerId = base.playerId
    const opened = state.openedPoliticsPile
    if (!opened) {
        const pile = lookAtPoliticsPileReason(state, playerId, 'A') === undefined ? 'A' : 'B'
        const look: LookAtPoliticsPile = {
            ...base,
            type: ActionType.LookAtPoliticsPile,
            pile,
            revealsInfo: true
        }
        return look
    }
    const cards = state.inspectedPoliticsCards(playerId)
    assertExists(cards, 'An opened politics pile has been inspected')
    const rank = (card: PoliticsCard) => TAKE_PREFERENCE.indexOf(card.type)
    const card = cards
        .filter(
            (candidate) => takePoliticsCardReason(state, playerId, opened, candidate) === undefined
        )
        .reduce<PoliticsCard | undefined>(
            (best, candidate) => (!best || rank(candidate) < rank(best) ? candidate : best),
            undefined
        )
    assertExists(card, 'An opened politics pile offers a card')
    const take: TakePoliticsCard = {
        ...base,
        type: ActionType.TakePoliticsCard,
        pile: opened,
        card
    }
    return take
}
