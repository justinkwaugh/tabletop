import { assert, type HydratedGameState } from '@tabletop/common'
import type { HarnessScenario, HarnessScenarioMove } from '@tabletop/frontend-components'
import {
    ActionType,
    HydratedSantiagoGameState,
    MachineState,
    connectedSpringIntersections,
    isFieldSquare,
    isIrrigated,
    tilesPerRound,
    validCanalPlacements,
    validNeutralTilePlacements,
    validSpringPlacements,
    SquareType,
    type CanalSegment
} from '@tabletop/santiago'

// Irrigate keeps fields watered; neglect plants away from the water and routes canals away from
// fields, so unwatered fields lose their farmers and dry out.
type WaterPolicy = 'irrigate' | 'neglect'

type Square = { col: number; row: number }

const COLS = 8
const ROWS = 6

function santiagoState(state: HydratedGameState): HydratedSantiagoGameState {
    assert(state instanceof HydratedSantiagoGameState, 'Santiago scenarios need Santiago game state')
    return state
}

function fieldCounts(state: HydratedSantiagoGameState): { fields: number; dried: number } {
    let fields = 0
    let dried = 0
    for (const column of state.board.squares) {
        for (const square of column) {
            if (!isFieldSquare(square)) continue
            fields++
            if (square.dried) dried++
        }
    }
    return { fields, dried }
}

function isLastRound(state: HydratedSantiagoGameState): boolean {
    return state.getRemainingTileCount() <= tilesPerRound(state.players.length)
}

// True when the end of this round will dry at least one field: an unwatered field with no
// farmers left.
function droughtWillDryAField(state: HydratedSantiagoGameState): boolean {
    const connected = connectedSpringIntersections(state.board)
    return state.board.squares.some((column, col) =>
        column.some(
            (square, row) =>
                isFieldSquare(square) &&
                !square.dried &&
                square.farmerCount === 0 &&
                !isIrrigated(state.board, col, row, connected)
        )
    )
}

function nearestWater(square: Square, connected: Set<string>): number {
    let nearest = Infinity
    for (const key of connected) {
        const [col, row] = key.split(',').map(Number)
        const dx = Math.max(0, col - (square.col + 1), square.col - col)
        const dy = Math.max(0, row - (square.row + 1), square.row - row)
        nearest = Math.min(nearest, dx + dy)
    }
    return nearest
}

function chooseFieldSquare(state: HydratedSantiagoGameState, policy: WaterPolicy): Square | undefined {
    const connected = connectedSpringIntersections(state.board)
    const empty: Square[] = []
    for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
            if (state.board.squares[col][row].type === SquareType.Empty) empty.push({ col, row })
        }
    }
    const closeness = (square: Square) =>
        (isIrrigated(state.board, square.col, square.row, connected) ? -100 : 0) + nearestWater(square, connected)
    const ranked = empty.toSorted((a, b) => closeness(a) - closeness(b))
    return policy === 'irrigate' ? ranked[0] : ranked.at(-1)
}

function bordersOf(segment: CanalSegment): Square[] {
    return segment.orientation === 'H'
        ? [
              { col: segment.col, row: segment.row - 1 },
              { col: segment.col, row: segment.row }
          ]
        : [
              { col: segment.col - 1, row: segment.row },
              { col: segment.col, row: segment.row }
          ]
}

function chooseCanal(state: HydratedSantiagoGameState, policy: WaterPolicy): CanalSegment {
    const connected = connectedSpringIntersections(state.board)
    const thirstyFieldsServed = (segment: CanalSegment) =>
        bordersOf(segment).filter(({ col, row }) => {
            const square = state.board.squares[col]?.[row]
            return (
                square !== undefined &&
                isFieldSquare(square) &&
                !square.dried &&
                !isIrrigated(state.board, col, row, connected)
            )
        }).length
    const fieldsTouched = (segment: CanalSegment) =>
        bordersOf(segment).filter(({ col, row }) => {
            const square = state.board.squares[col]?.[row]
            return square !== undefined && isFieldSquare(square)
        }).length
    const options = validCanalPlacements(state.board)
    assert(options.length > 0, 'Canal building requires a placeable segment')
    const ranked =
        policy === 'irrigate'
            ? options.toSorted((a, b) => thirstyFieldsServed(b) - thirstyFieldsServed(a))
            : options.toSorted((a, b) => fieldsTouched(a) - fieldsTouched(b))
    return ranked[0]
}

function nextMove(state: HydratedSantiagoGameState, policy: WaterPolicy): HarnessScenarioMove {
    const playerId = state.activePlayerIds[0]
    switch (state.machineState) {
        case MachineState.SpringPlacement: {
            const spots = validSpringPlacements()
            return { type: ActionType.PlaceSpring, playerId, ...spots[Math.floor(spots.length / 2)] }
        }
        case MachineState.TileReveal:
            return { type: ActionType.RevealTiles, playerId }
        case MachineState.Bidding:
            return { type: ActionType.PlaceBid, playerId, amount: 0 }
        case MachineState.PlantingPhase: {
            if (state.planterIndex >= state.plantersOrder.length) {
                const neutral = validNeutralTilePlacements(state.board)[0]
                assert(neutral !== undefined, 'The neutral field requires a placement')
                return { type: ActionType.PlaceNeutralTile, playerId, ...neutral }
            }
            const square = state.revealedTiles.length > 0 ? chooseFieldSquare(state, policy) : undefined
            return square
                ? { type: ActionType.PlaceField, playerId, tileIndex: 0, ...square }
                : { type: ActionType.Pass, playerId }
        }
        case MachineState.CanalBuilding:
            if (state.canalProposalIndex < state.canalProposalOrder.length) {
                return { type: ActionType.Pass, playerId }
            }
            return { type: ActionType.OverseerDecision, playerId, segment: chooseCanal(state, policy), accepting: false }
        case MachineState.ExtraIrrigation: {
            const hasPersonalCanal = state.getPlayerState(playerId).hasPersonalCanal
            return policy === 'irrigate' && hasPersonalCanal
                ? { type: ActionType.BuildCanal, playerId, segment: chooseCanal(state, policy) }
                : { type: ActionType.Pass, playerId }
        }
        default:
            throw new Error(`Santiago scenarios cannot move in ${state.machineState}`)
    }
}

function scenario(
    definition: Omit<HarnessScenario, 'nextMove' | 'isComplete' | 'playerCount'> & {
        policy: WaterPolicy
        isComplete(state: HydratedSantiagoGameState): boolean
    }
): HarnessScenario {
    const { policy, isComplete, ...rest } = definition
    return {
        ...rest,
        playerCount: 4,
        nextMove: (state) => nextMove(santiagoState(state), policy),
        isComplete: (state) => {
            const santiago = santiagoState(state)
            return santiago.machineState === MachineState.EndOfGame || isComplete(santiago)
        }
    }
}

export const santiagoHarnessScenarios: HarnessScenario[] = [
    scenario({
        id: 'midgame-healthy',
        label: 'Mid-game, healthy',
        description: 'Round 6 about to begin; fields planted near the water and kept irrigated.',
        policy: 'irrigate',
        isComplete: (state) => state.machineState === MachineState.TileReveal && state.round >= 6
    }),
    scenario({
        id: 'late-drought',
        label: 'Late game, drought',
        description: 'A full board where about half the fields have dried to desert.',
        policy: 'neglect',
        isComplete: (state) => {
            if (state.machineState !== MachineState.TileReveal) return false
            const { fields, dried } = fieldCounts(state)
            return (fields >= 16 && dried * 2 >= fields) || isLastRound(state)
        }
    }),
    scenario({
        id: 'final-round',
        label: 'Final round',
        description: 'The last round about to be revealed, on a well-irrigated board.',
        policy: 'irrigate',
        isComplete: (state) => state.machineState === MachineState.TileReveal && isLastRound(state)
    }),
    scenario({
        id: 'before-drought',
        label: 'Just before a drought',
        description: 'Last personal-canal decision of a round; pass it to watch unwatered fields dry.',
        policy: 'neglect',
        isComplete: (state) =>
            state.machineState === MachineState.ExtraIrrigation &&
            state.round >= 2 &&
            state.extraIrrigationIndex === state.extraIrrigationOrder.length - 1 &&
            droughtWillDryAField(state)
    })
]
