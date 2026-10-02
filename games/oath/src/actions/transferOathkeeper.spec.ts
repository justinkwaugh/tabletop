import { describe, expect, it } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction, machineContext } from '../testing/actions.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { setUpState, testGame } from '../testing/game.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { OathType, PlayerStatus } from '../model/oathEnums.js'
import type { OathProjectedState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { ResolveWake } from './resolveWake.js'
import { Muster } from './muster.js'
import { ResolveOathkeeper } from './resolveOathkeeper.js'
import { HydratedTransferOathkeeper, TransferOathkeeper, isTransferOathkeeper } from './transferOathkeeper.js'
import { CURRENT_OATH_REVISION, OathRevision, isAtLeastOathRevision } from '../util/revision.js'

const ORDER = 'denizen.order.wrestlers'

function seats(extra: OathPlayerState[] = []): OathPlayerState[] {
    return [
        testPlayer({
            playerId: 'p1',
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            siteId: 'c1',
            supply: 7,
            favor: 4,
            warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 }
        }),
        testPlayer({
            playerId: 'p2',
            color: Color.Red,
            status: PlayerStatus.Exile,
            siteId: 'c2',
            supply: 7,
            warbandsInPersonalBank: { p2: 4 }
        }),
        ...extra
    ]
}

function supremacyTable(oathRevision: number | undefined, extra: OathPlayerState[] = []): OathProjectedState {
    const players = seats(extra)
    const state = testState(players, {
        denizensBySite: { c1: [ORDER], c2: [] },
        machineState: MachineState.WakePhase,
        chancellorPlayerId: 'p1',
        oathType: OathType.Supremacy,
        oathkeeperPlayerId: 'p1',
        warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 } },
        oathRevision
    }).dehydrate()
    const order = players.map((player) => player.playerId)
    state.turnManager = {
        series: [{ type: 'turn', playerId: 'p1', start: 0 }],
        turnOrder: order,
        turnCounts: Object.fromEntries(order.map((id) => [id, 0]))
    }
    state.activePlayerIds = ['p1']
    return state
}

function awake(state: OathProjectedState, playerIds: string[]) {
    const game = testGame(playerIds)
    const result = engine.runNext(buildAction(ResolveWake, { playerId: 'p1', favorSteps: [] }), state, game)
    return { game, state: result.updatedState }
}

function musterAfter(
    state: OathProjectedState,
    playerIds: string[],
    warbandsBySite: OathProjectedState['warbandsBySite']
) {
    const { game, state: awakeState } = awake(state, playerIds)
    awakeState.warbandsBySite = warbandsBySite
    return { game, result: engine.runNext(buildAction(Muster, { playerId: 'p1', cardId: ORDER }), awakeState, game) }
}

function transfersIn(actions: readonly GameAction[]) {
    return actions.filter(isTransferOathkeeper)
}

describe('the revision flag', () => {
    it('is set on every new game', () => {
        expect(setUpState(3).oathRevision).toBe(CURRENT_OATH_REVISION)
    })

    it('reads an absent revision as older than every revision', () => {
        expect(isAtLeastOathRevision({}, OathRevision.TurnFlow)).toBe(false)
        expect(isAtLeastOathRevision({ oathRevision: 1 }, OathRevision.TurnFlow)).toBe(true)
    })
})

describe('R-2.11-H1 — the title changing hands is its own System Action from the turn-flow revision', () => {
    it('records the move, from and to, right after the action that caused it', () => {
        const table = supremacyTable(OathRevision.TurnFlow)
        const { result } = musterAfter(table, ['p1', 'p2'], { c2: { p2: 1 } })

        expect(result.processedActions.map((action) => action.type)).toEqual([ActionType.Muster, ActionType.TransferOathkeeper])
        const [transfer] = transfersIn(result.processedActions)
        expect(transfer.source).toBe(ActionSource.System)
        expect(transfer.fromPlayerId).toBe('p1')
        expect(transfer.toPlayerId).toBe('p2')
        expect(result.updatedState.oathkeeperPlayerId).toBe('p2')
        expect(result.updatedState.oathkeeperIsUsurper).toBe(false)
        expect(result.updatedState.machineState).toBe(MachineState.ActPhase)
    })

    it('records a vacated title with no one to take it (R-2.11, R-9.1)', () => {
        const table = supremacyTable(OathRevision.TurnFlow)
        const { result } = musterAfter(table, ['p1', 'p2'], {})

        const [transfer] = transfersIn(result.processedActions)
        expect(transfer.fromPlayerId).toBe('p1')
        expect(transfer.toPlayerId).toBeUndefined()
        expect(result.updatedState.oathkeeperPlayerId).toBeUndefined()
    })

    it('triggers no further transfer of its own', () => {
        const table = supremacyTable(OathRevision.TurnFlow)
        const { result } = musterAfter(table, ['p1', 'p2'], { c2: { p2: 1 } })

        expect(transfersIn(result.processedActions)).toHaveLength(1)
    })

    it('records nothing when the title stays put', () => {
        const { result } = musterAfter(supremacyTable(OathRevision.TurnFlow), ['p1', 'p2'], { c1: { [IMPERIAL_WARBANDS]: 1 } })

        expect(transfersIn(result.processedActions)).toHaveLength(0)
        expect(result.updatedState.oathkeeperPlayerId).toBe('p1')
    })

    it('still opens the outgoing holder’s choice at once when two tie (R-2.11.b)', () => {
        const third = testPlayer({
            playerId: 'p3',
            color: Color.Yellow,
            status: PlayerStatus.Exile,
            siteId: 'p1',
            warbandsInPersonalBank: { p3: 4 }
        })
        const table = supremacyTable(OathRevision.TurnFlow, [third])
        const { game, result } = musterAfter(table, ['p1', 'p2', 'p3'], { c2: { p2: 1 }, p1: { p3: 1 } })

        expect(transfersIn(result.processedActions)).toHaveLength(0)
        expect(result.updatedState.machineState).toBe(MachineState.OathkeeperChoice)
        expect(result.updatedState.oathkeeperPlayerId).toBe('p1')

        const chosen = engine.runNext(buildAction(ResolveOathkeeper, { playerId: 'p1', chosenPlayerId: 'p3' }), result.updatedState, game)
        expect(transfersIn(chosen.processedActions)).toHaveLength(0)
        expect(chosen.updatedState.oathkeeperPlayerId).toBe('p3')
        expect(chosen.updatedState.machineState).toBe(MachineState.ActPhase)
    })

    it('leaves a game created before the revision moving the title inline, as it was recorded', () => {
        const table = supremacyTable(undefined)
        const { result } = musterAfter(table, ['p1', 'p2'], { c2: { p2: 1 } })

        expect(result.processedActions.map((action) => action.type)).toEqual([ActionType.Muster])
        expect(result.updatedState.oathkeeperPlayerId).toBe('p2')
    })
})

describe('applying a recorded transfer', () => {
    function transfer(fields: Partial<TransferOathkeeper>) {
        return new HydratedTransferOathkeeper(buildAction(TransferOathkeeper, { source: ActionSource.System, ...fields }))
    }

    it('refuses a move from a seat that does not hold the title', () => {
        const state = testState(seats(), { oathkeeperPlayerId: 'p1', oathRevision: OathRevision.TurnFlow })
        expect(() => transfer({ fromPlayerId: 'p2', toPlayerId: 'p1' }).apply(state, machineContext(state))).toThrow(/held by p1, not p2/)
    })

    it('refuses a move to the seat already holding it', () => {
        const state = testState(seats(), { oathkeeperPlayerId: 'p1', oathRevision: OathRevision.TurnFlow })
        expect(() => transfer({ fromPlayerId: 'p1', toPlayerId: 'p1' }).apply(state, machineContext(state))).toThrow(/would not move/)
    })

    it('turns the title to its Oathkeeper side for the new holder (R-2.11.c)', () => {
        const state = testState(seats(), { oathkeeperPlayerId: 'p1', oathkeeperIsUsurper: true, oathRevision: OathRevision.TurnFlow })
        transfer({ fromPlayerId: 'p1', toPlayerId: 'p2' }).apply(state, machineContext(state))
        expect(state.oathkeeperPlayerId).toBe('p2')
        expect(state.oathkeeperIsUsurper).toBe(false)
    })
})
