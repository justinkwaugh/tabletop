import { describe, expect, it } from 'vitest'
import {
    advanceSpan,
    assertExists,
    createBranch,
    executeBranchAction,
    settleSpan,
    type GameAction,
    type UnmergedBranch
} from '@tabletop/common'
import { isResolveSurvey } from '../actions/resolveSurvey.js'
import { isSettleExplorations } from '../actions/settleExplorations.js'
import { TechField } from '../components/techFields.js'
import { TechId } from '../components/techs.js'
import { shipsAvailableToBuild } from '../model/building.js'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '../model/gameState.js'
import { MarkerReason } from '../model/pieces.js'
import { TurnPhase } from '../model/turn.js'
import { playPhase } from '../model/turnPlan.js'
import {
    advanceTo,
    edit,
    endPhase,
    endPhaseWithActions,
    engine,
    execute,
    executeWithoutAdvancing,
    finishDecade,
    hydrate,
    placeShip,
    startedGame,
    userAction
} from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

function cargoShipFor(state: HydratedStellarHorizonsGameState, playerId: string): string {
    const definition = shipsAvailableToBuild(state, playerId).find(
        (candidate) => candidate.cargo > 0
    )
    assertExists(definition, `${playerId} has no cargo ship to build`)
    return definition.id
}

function withCargoShipsAtSol(state: StellarHorizonsProjectedState) {
    return edit(state, (hydrated) => {
        for (const playerId of hydrated.initiativeOrder()) {
            placeShip(hydrated, playerId, cargoShipFor(hydrated, playerId), 'sol')
        }
    })
}

function tableContent({
    id: _id,
    actionCount: _actionCount,
    actionChecksum: _actionChecksum,
    machineState: _machineState,
    activePlayerIds: _activePlayerIds,
    parallelSpan: _parallelSpan,
    ...rest
}: StellarHorizonsProjectedState) {
    return rest
}

function playPrivately(
    game: ReturnType<typeof startedGame>['game'],
    state: StellarHorizonsProjectedState,
    playerId: string,
    actions: readonly GameAction[]
): UnmergedBranch {
    let execution = createBranch({ engine, game, state, playerId })
    const recorded = [...execution.processedActions]
    for (const action of actions) {
        execution = executeBranchAction({
            engine,
            game,
            state,
            branch: execution.branch,
            action: structuredClone(action)
        })
        recorded.push(...execution.processedActions)
    }
    return { branch: execution.branch, actions: recorded }
}

describe('a decade of parallel spans', () => {
    it('plays each phase as a span of its own, in the order the rulebook gives', () => {
        const { game, state: started } = startedGame(3)
        const [p1, p2, p3] = started.turnManager.turnOrder
        let state = withCargoShipsAtSol(started)
        const visits: [TurnPhase | undefined, string][] = []
        while (state.year === 2150 && playPhase(state) !== undefined) {
            visits.push([playPhase(state), state.activePlayerIds[0]])
            state = endPhase(game, state)
        }
        expect(visits).toEqual([
            [TurnPhase.Build, p3],
            [TurnPhase.Build, p2],
            [TurnPhase.Build, p1],
            [TurnPhase.Cargo, p1],
            [TurnPhase.Cargo, p2],
            [TurnPhase.Cargo, p3],
            [TurnPhase.Movement, p3],
            [TurnPhase.Movement, p2],
            [TurnPhase.Movement, p1],
            [TurnPhase.Development, p1],
            [TurnPhase.Development, p2],
            [TurnPhase.Development, p3]
        ])
        expect(state.year).toBe(2160)
    })

    it('merges the private branches of a phase in merge order to what playing them in turn reaches', () => {
        const { game, state: resting } = startedGame(3, {}, { resting: true })
        expect(resting.machineState).toBe(MachineState.BuildPhase)
        expect(resting.parallelSpan?.branchPlayerId).toBeUndefined()
        const order = resting.turnManager.turnOrder
        const hydrated = hydrate(resting)
        const plays = new Map(
            order.map((playerId) => [
                playerId,
                [
                    userAction(game, playerId, ActionType.BuildShip, {
                        shipId: cargoShipFor(hydrated, playerId),
                        systemId: 'sol'
                    }),
                    userAction(game, playerId, ActionType.EndPhase, { phase: TurnPhase.Build })
                ]
            ])
        )
        const branches = order.map((playerId) =>
            playPrivately(game, resting, playerId, plays.get(playerId) ?? [])
        )
        expect(branches.every((record) => record.branch.closed)).toBe(true)

        const settled = settleSpan({ engine, game, state: resting, unmergedBranches: branches })
        expect(settled.refusal).toBeUndefined()
        expect(settled.mergedPlayerIds).toEqual(order.toReversed())

        let local = advanceSpan({ engine, game, state: resting })?.updatedState ?? resting
        for (const playerId of order.toReversed()) {
            for (const action of plays.get(playerId) ?? []) {
                local = execute(game, local, structuredClone(action))
            }
        }
        expect(Object.keys(settled.updatedState.ships)).toHaveLength(3)
        expect(tableContent(settled.updatedState)).toEqual(tableContent(local))
    })

    it('keeps every exploration private until all have closed, then settles them in initiative order', () => {
        const { game, state: started } = startedGame(3)
        const [p1, p2, p3] = started.turnManager.turnOrder
        const prepared = edit(started, (hydrated) => {
            placeShip(hydrated, p1, 'starfarers-kepler', 'alpha-centauri')
            placeShip(hydrated, p2, 'givers-mendel', 'alpha-centauri')
        })
        const moving = advanceTo(game, prepared, TurnPhase.Movement, p1)
        const movementOver = executeWithoutAdvancing(
            game,
            moving,
            userAction(game, p1, ActionType.EndPhase, { phase: TurnPhase.Movement })
        )
        const closed = engine.closeBranch({ state: movementOver, playerId: p1 }).updatedState
        const resting = engine.completeSpan({ state: closed, game }).updatedState
        expect(resting.machineState).toBe(MachineState.ExplorationPhase)

        const explore = (state: StellarHorizonsProjectedState, playerId: string, shipId: string) =>
            playPrivately(game, state, playerId, [
                userAction(game, playerId, ActionType.Explore, { shipId }),
                userAction(game, playerId, ActionType.EndPhase, { phase: TurnPhase.Exploration })
            ])

        const first = explore(resting, p1, 'starfarers-kepler')
        const oneClosed = settleSpan({ engine, game, state: resting, unmergedBranches: [first] })
        expect(oneClosed.refusal).toBeUndefined()
        expect(oneClosed.mergedPlayerIds).toEqual([])
        expect(oneClosed.updatedState.parallelSpan?.closedPlayerIds).toEqual([p1, p3])
        expect(hydrate(oneClosed.updatedState).getPlayerState(p1).earnedMarkers).toEqual([])

        const second = explore(oneClosed.updatedState, p2, 'givers-mendel')
        const idle = oneClosed.createdBranches.filter((record) => record.branch.playerId === p3)
        const all = settleSpan({
            engine,
            game,
            state: oneClosed.updatedState,
            unmergedBranches: [first, second, ...idle]
        })
        expect(all.refusal).toBeUndefined()
        expect(all.mergedPlayerIds).toEqual([p1, p2, p3])
        expect(all.updatedState.machineState).toBe(MachineState.DevelopmentPhase)
        const settlements = all.processedActions.filter(isSettleExplorations)
        expect(settlements.map((action) => action.playerId)).toEqual([p1, p2])
        const after = hydrate(all.updatedState)
        expect(after.getPlayerState(p1).techMarkers.Biology).toHaveLength(2)
        expect(after.getPlayerState(p2).techMarkers.Biology).toHaveLength(2)
    })

    it('draws the markers earned after the exploration phase and decides surveys then', () => {
        const { game, state: started } = startedGame(2)
        const [p1, p2] = started.turnManager.turnOrder
        let state = edit(started, (hydrated) => {
            placeShip(hydrated, p1, 'starfarers-kepler', 'alpha-centauri')
            placeShip(hydrated, p2, 'givers-mendel', 'alpha-centauri')
        })
        state = advanceTo(game, state, TurnPhase.Exploration, p1)
        state = execute(
            game,
            state,
            userAction(game, p1, ActionType.Explore, { shipId: 'starfarers-kepler' })
        )
        const explored = hydrate(state)
        expect(explored.getPlayerState(p1).earnedMarkers[0]).toEqual({
            shipId: 'starfarers-kepler',
            systemId: 'alpha-centauri',
            field: TechField.Biology,
            count: 1,
            reason: MarkerReason.Exploration
        })
        expect(explored.getPlayerState(p1).techMarkers.Biology).toHaveLength(1)
        expect(explored.getPlayerState(p1).pendingSurveys).toEqual([])

        state = endPhase(game, state)
        expect(playPhase(state)).toBe(TurnPhase.Exploration)
        expect(state.activePlayerIds).toEqual([p2])
        state = execute(
            game,
            state,
            userAction(game, p2, ActionType.Explore, { shipId: 'givers-mendel' })
        )
        const result = endPhaseWithActions(game, state)
        const settlements = result.processedActions.filter(isSettleExplorations)
        expect(settlements.map((action) => action.playerId)).toEqual([p1, p2])
        const settled = settlements.flatMap((action) => action.metadata?.settled ?? [])
        expect(settled[0]).toMatchObject({
            shipId: 'starfarers-kepler',
            field: TechField.Biology,
            count: 1,
            cash: 0
        })
        expect(settled[0].markers).toHaveLength(1)
        const after = hydrate(result.state)
        expect(after.getPlayerState(p1).techMarkers.Biology).toHaveLength(2)
        expect(after.getPlayerState(p2).techMarkers.Biology).toHaveLength(2)

        const surveys = result.processedActions.filter(isResolveSurvey)
        const surveyed = settled.filter((entry) => entry.survey)
        expect(surveys).toHaveLength(surveyed.length)
        for (const entry of settled) {
            const total = entry.markers.reduce((sum, value) => sum + value, 0)
            expect(entry.survey).toBe(entry.reason === MarkerReason.Exploration && total >= 3)
        }
    })

    it('pays cash for markers an empty pool cannot supply, when they are drawn', () => {
        const { game, state: started } = startedGame(2)
        const [p1] = started.turnManager.turnOrder
        let state = edit(started, (hydrated) => {
            placeShip(hydrated, p1, 'starfarers-kepler', 'alpha-centauri')
            hydrated.techPools.Biology = [0, 0, 0, 0, 0]
        })
        state = advanceTo(game, state, TurnPhase.Exploration, p1)
        const cash = hydrate(state).getPlayerState(p1).cash
        state = execute(
            game,
            state,
            userAction(game, p1, ActionType.Explore, { shipId: 'starfarers-kepler' })
        )
        expect(hydrate(state).getPlayerState(p1).cash).toBe(cash)
        const result = endPhaseWithActions(game, state)
        const [settlement] = result.processedActions.filter(isSettleExplorations)
        expect(settlement.metadata?.settled[0]).toMatchObject({ markers: [], cash: 1, survey: false })
        expect(hydrate(result.state).getPlayerState(p1).cash).toBe(cash + 1)
    })

    it('returns the markers spent on techs to the pool at the end of the turn', () => {
        const { game, state: started } = startedGame(2)
        const [p1] = started.turnManager.turnOrder
        let state = edit(started, (hydrated) => {
            hydrated.getPlayerState(p1).techMarkers.Biology = [5, 5]
        })
        state = advanceTo(game, state, TurnPhase.Development, p1)
        const poolBefore = [...hydrate(state).techPools.Biology]
        state = execute(
            game,
            state,
            userAction(game, p1, ActionType.DevelopTech, {
                techId: TechId.Terraforming,
                markers: [5, 5],
                cash: 0
            })
        )
        const developed = hydrate(state)
        expect(developed.getPlayerState(p1).spentMarkers.Biology).toEqual([5, 5])
        expect(developed.getPlayerState(p1).techMarkers.Biology).toEqual([])
        expect(developed.techPools.Biology).toEqual(poolBefore)

        const next = hydrate(finishDecade(game, state))
        expect(next.year).toBe(2160)
        expect(next.getPlayerState(p1).spentMarkers.Biology).toEqual([])
        expect(next.techPools.Biology[4]).toBe(poolBefore[4] + 2)
    })
})
