import {
    ActionSource,
    assert,
    assertExists,
    GameEngine,
    GameProgress,
    MachineContext,
    reportGameProgress,
    type Game,
    type GameAction,
    type OffsetTupleCoordinates
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { describe, expect, it } from 'vitest'
import { CellType } from '../components/cells.js'
import type { FreshFishProjectedState, HydratedFreshFishGameState } from '../model/gameState.js'
import { createTestGame } from '../util/testHelper.js'
import { ActionType } from './actions.js'
import { GoodsType } from './goodsType.js'
import { FreshFishRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(FreshFishRuntime)
const masterSeed = '0123456789abcdef0123456789abcdef'
const finalStallCount = Object.values(GoodsType).length

function act<T extends GameAction>(action: T): GameAction {
    return action
}

function reservedCell(state: HydratedFreshFishGameState, playerId: string): OffsetTupleCoordinates {
    const reserved = [...state.board].find(({ coords }) =>
        state.board.isCellReservedForPlayer(coords, playerId)
    )
    assertExists(reserved, `${playerId} has no disk to build on`)
    return reserved.coords
}

function botAction(
    game: Game,
    state: HydratedFreshFishGameState,
    playerId: string,
    step: number
): GameAction {
    const base = { id: `a${step}`, gameId: state.gameId, source: ActionSource.User, playerId }
    const context = new MachineContext({ gameState: state, gameConfig: game.config })
    const valid = FreshFishRuntime.stateHandlers[state.machineState].validActionsForPlayer(
        playerId,
        context
    )
    switch (state.machineState) {
        case MachineState.StartOfTurn: {
            if (valid.includes(ActionType.DrawTile) && step % 3 !== 0)
                return act({ ...base, type: ActionType.DrawTile, revealsInfo: true })
            if (valid.includes(ActionType.PlaceDisk)) {
                const empty = [...state.board].find(
                    ({ coords, cell }) =>
                        cell.type === CellType.Empty &&
                        (state.turnManager.turnCount(playerId) === 0 ||
                            state.board.hasOrthogonalPiece(coords))
                )
                if (empty) return act({ ...base, type: ActionType.PlaceDisk, coords: empty.coords })
            }
            if (valid.includes(ActionType.DrawTile))
                return act({ ...base, type: ActionType.DrawTile, revealsInfo: true })
            return act({ ...base, type: ActionType.Pass })
        }
        case MachineState.MarketTileDrawn:
            return act({
                ...base,
                type: ActionType.PlaceMarket,
                coords: reservedCell(state, playerId)
            })
        case MachineState.AuctioningTile: {
            const money = state.getPlayerState(playerId).money
            const seat = state.players.findIndex((player) => player.playerId === playerId)
            return act({ ...base, type: ActionType.PlaceBid, amount: Math.min(money, seat + 1) })
        }
        case MachineState.AuctionEnded:
        case MachineState.TileBagEmptied: {
            const goodsType = state.getChosenStallType()
            assertExists(goodsType, 'A stall is waiting to be placed')
            return act({
                ...base,
                type: ActionType.PlaceStall,
                goodsType,
                ...(state.getPlayerState(playerId).hasDiskOnBoard()
                    ? { coords: reservedCell(state, playerId) }
                    : {})
            })
        }
        default:
            throw Error(`No bot move in ${state.machineState}`)
    }
}

function expectedFraction(state: FreshFishProjectedState, initialRemaining: number): number {
    const steps = initialRemaining + finalStallCount
    const done =
        initialRemaining - state.tileBag.remaining + finalStallCount - state.finalStalls.length
    return Math.round((done / steps) * 1000) / 1000
}

function playToEnd(
    count: number,
    onState: (state: FreshFishProjectedState) => void
): FreshFishProjectedState {
    const game = createTestGame(count)
    let state = engine.startGame(game, { masterSeed }).initialState
    onState(state)
    for (let step = 0; state.result === undefined; step++) {
        assert(step < 20000, 'Playthrough did not finish')
        const [playerId] = state.activePlayerIds
        assertExists(playerId, `No active player in ${state.machineState}`)
        const hydrated = FreshFishRuntime.hydrator.hydrateState(state)
        const action = botAction(game, hydrated, playerId, step)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
        onState(state)
    }
    return state
}

describe.each([2, 3, 4, 5])('Fresh Fish Game Progress with %i players', (count) => {
    it('counts the bag down against its starting size, then the final stalls', () => {
        const reports: GameProgress[] = []
        let initialRemaining: number | undefined
        const finished = playToEnd(count, (state) => {
            initialRemaining ??= state.tileBag.remaining
            const progress = reportGameProgress(FreshFishRuntime, state)
            assertExists(progress, 'Fresh Fish reports Game Progress')
            expect(progress.fraction).toBe(expectedFraction(state, initialRemaining))
            expect(Value.Check(GameProgress, progress)).toBe(true)
            reports.push(progress)
        })
        assertExists(initialRemaining, 'The game started with a bag')
        expect(finished.result).toBeDefined()
        expect(reports[0]).toEqual({ fraction: 0, label: `${initialRemaining} tiles left` })
        for (const [index, report] of reports.entries())
            expect(report.fraction).toBeGreaterThanOrEqual(reports[index - 1]?.fraction ?? 0)
        const labels = reports.map((report) => report.label)
        expect(labels).toContain('1 tile left')
        expect(labels).not.toContain('1 tiles left')
        expect(labels).toContain('Last tile')
        expect(reports.find((report) => report.label === 'Last tile')).not.toHaveProperty('final')
        expect(reports.find((report) => report.label === 'Final stalls')).toMatchObject({
            final: true
        })
        expect(
            reports.filter((report) => report.final).every((r) => r.label === 'Final stalls')
        ).toBe(true)
        expect(reports.at(-1)).toEqual({ fraction: 1, label: 'Final stalls', final: true })
    })
})
