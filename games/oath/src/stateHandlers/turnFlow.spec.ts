import { describe, expect, it } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction, machineContext } from '../testing/actions.js'
import { testBanners, testPlayer, testState } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { bank } from '../testing/choices.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { Banner, OathType, PlayerStatus, Suit } from '../model/oathEnums.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { CompleteRest, isCompleteRest } from '../actions/completeRest.js'
import { HydratedUseRestPower, UseRestPower } from '../actions/useRestPower.js'
import { HydratedRollEndDie, RollEndDie, isRollEndDie } from '../actions/rollEndDie.js'
import { isResolveWake } from '../actions/resolveWake.js'
import { OathRevision } from '../util/revision.js'
import { hasFreeActionAhead } from '../util/freeActions.js'
import { bySuit } from '../data/typedData.js'

const INSOMNIA = 'denizen.discord.insomnia'
const POVERTY = 'denizen.beast.vow-of-poverty'
const OBEDIENCE = 'denizen.order.vow-of-obedience'
const NAYSAYERS = 'denizen.discord.naysayers'

interface TableOptions {
    createdBeforeRevisions?: boolean
    resting?: 'p1' | 'p2'
    round?: number
    p1?: Partial<OathPlayerState>
    p2?: Partial<OathPlayerState>
    state?: Partial<OathProjectedState>
}

/** p1 is the Chancellor and first in turn order (R-1.7); p2 is an Exile and closes the round. */
function table({ createdBeforeRevisions = false, resting = 'p1', round = 1, p1 = {}, p2 = {}, state = {} }: TableOptions = {}) {
    const seats: OathPlayerState[] = [
        testPlayer({
            playerId: 'p1',
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            siteId: 'c1',
            supply: 7,
            favor: 4,
            warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 },
            ...p1
        }),
        testPlayer({
            playerId: 'p2',
            color: Color.Red,
            status: PlayerStatus.Exile,
            siteId: 'c2',
            supply: 7,
            favor: 2,
            warbandsInPersonalBank: { p2: 4 },
            ...p2
        })
    ]
    const raw = testState(seats, {
        machineState: MachineState.ActPhase,
        chancellorPlayerId: 'p1',
        oathType: OathType.Supremacy,
        oathkeeperPlayerId: 'p1',
        warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 } },
        round,
        oathRevision: createdBeforeRevisions ? undefined : OathRevision.TurnFlow,
        ...state
    }).dehydrate()
    raw.turnManager = {
        series: [{ type: 'turn', playerId: resting, start: 0 }],
        turnOrder: ['p1', 'p2'],
        turnCounts: { p1: resting === 'p2' ? 1 : 0, p2: 0 }
    }
    raw.activePlayerIds = [resting]
    return raw
}

const game = testGame(['p1', 'p2'])

function run(action: GameAction, state: OathProjectedState) {
    return engine.runNext(action, state, game)
}

function endActPhase(state: OathProjectedState, playerId = state.activePlayerIds[0]) {
    return run(buildAction(EndActPhase, { playerId }), state)
}

function kinds(actions: readonly GameAction[]) {
    return actions.map((action) => [action.type, action.source])
}

function restPower(cardId: string) {
    return powerIndexOf(cardId, PowerTiming.Rest)
}

describe('R-4.3 — the Rest is a System Action when nothing waits on the player (turn-flow revision)', () => {
    it('ends the turn with End the Act Phase: one System Rest, then the next seat’s Wake', () => {
        const result = endActPhase(table())

        expect(kinds(result.processedActions).slice(0, 2)).toEqual([
            [ActionType.EndActPhase, ActionSource.User],
            [ActionType.CompleteRest, ActionSource.System]
        ])
        expect(result.processedActions.filter(isCompleteRest)).toHaveLength(1)
        expect(result.updatedState.activePlayerIds).toEqual(['p2'])
        expect(result.updatedState.turnManager.series.at(-1)).toMatchObject({ playerId: 'p2' })
        expect(result.processedActions.find(isResolveWake)?.source).toBe(ActionSource.System)
        expect(result.updatedState.machineState).toBe(MachineState.ActPhase)
    })

    it('waits on a player holding Insomnia, and using it ends the turn by itself (R-4.3.5)', () => {
        const resting = endActPhase(table({ p1: { advisers: [{ cardId: INSOMNIA, faceUp: true }] } }))
        expect(resting.processedActions.filter(isCompleteRest)).toHaveLength(0)
        expect(resting.updatedState.machineState).toBe(MachineState.RestPhase)
        expect(resting.updatedState.activePlayerIds).toEqual(['p1'])

        const used = run(buildAction(UseRestPower, { playerId: 'p1', cardId: INSOMNIA, powerIndex: restPower(INSOMNIA) }), resting.updatedState)
        expect(kinds(used.processedActions).slice(0, 2)).toEqual([
            [ActionType.UseRestPower, ActionSource.User],
            [ActionType.CompleteRest, ActionSource.System]
        ])
        expect(used.updatedState.activePlayerIds).toEqual(['p2'])
    })

    it('lets the player end the turn without the powers left', () => {
        const resting = endActPhase(table({ p1: { advisers: [{ cardId: INSOMNIA, faceUp: true }] } }))
        const ended = run(buildAction(CompleteRest, { playerId: 'p1' }), resting.updatedState)
        expect(kinds(ended.processedActions)[0]).toEqual([ActionType.CompleteRest, ActionSource.User])
        expect(ended.updatedState.activePlayerIds).toEqual(['p2'])
    })

    it('does not wait on Vow of Poverty while the player has favor, and does when they have none', () => {
        const withFavor = endActPhase(table({ p1: { favor: 1, advisers: [{ cardId: POVERTY, faceUp: true }] } }))
        expect(withFavor.processedActions.filter(isCompleteRest)).toHaveLength(1)

        const without = endActPhase(table({ p1: { favor: 0, advisers: [{ cardId: POVERTY, faceUp: true }] } }))
        expect(without.updatedState.machineState).toBe(MachineState.RestPhase)
    })

    it('does not wait on a bank power when every bank it could take from is empty', () => {
        const allEmpty = endActPhase(table({ p1: { advisers: [{ cardId: OBEDIENCE, faceUp: true }] }, state: { favorBank: bySuit(() => 0) } }))
        expect(allEmpty.processedActions.filter(isCompleteRest)).toHaveLength(1)

        const oneHolds = endActPhase(table({ p1: { advisers: [{ cardId: OBEDIENCE, faceUp: true }] }, state: { favorBank: bySuit((suit) => (suit === Suit.Hearth ? 2 : 0)) } }))
        expect(oneHolds.updatedState.machineState).toBe(MachineState.RestPhase)
    })

    it('does not wait on Naysayers while no Exile holds the title', () => {
        const result = endActPhase(table({ p1: { advisers: [{ cardId: NAYSAYERS, faceUp: true }] } }))
        expect(result.processedActions.filter(isCompleteRest)).toHaveLength(1)
    })

    it('reads usable powers by one rule the panel shares', () => {
        const state = new HydratedOathGameState(table({ p1: { advisers: [{ cardId: OBEDIENCE, faceUp: true }, { cardId: INSOMNIA, faceUp: true }] } }))
        expect(HydratedUseRestPower.usableRestPowers(state, 'p1').map((power) => power.cardId).sort()).toEqual([INSOMNIA, OBEDIENCE].sort())
    })

    it('keeps the Rest a player’s own step in a game created before the revision (R-X.4)', () => {
        const result = endActPhase(table({ createdBeforeRevisions: true }))
        expect(result.processedActions.filter(isCompleteRest)).toHaveLength(0)
        expect(result.updatedState.machineState).toBe(MachineState.RestPhase)
    })
})

describe('R-3.3 — the Chancellor rolls the end die between rounds', () => {
    function roundEnd(round: number, options: TableOptions = {}) {
        return endActPhase(table({ resting: 'p2', round, ...options }))
    }

    function seedRolling(roll: number, round: number): number {
        for (let seed = 1; seed < 500; seed++) {
            const waiting = roundEnd(round, { state: { prng: { seed, invocations: 0 } } }).updatedState
            const rolled = run(buildAction(RollEndDie, { playerId: 'p1' }), waiting)
            if (rolled.processedActions.find(isRollEndDie)?.metadata?.roll === roll) return seed
        }
        throw Error(`no seed below 500 rolls a ${roll}`)
    }

    it('stops the round on the Chancellor, with nothing rolled yet', () => {
        const result = roundEnd(6)
        const rest = result.processedActions.find(isCompleteRest)
        expect(rest?.source).toBe(ActionSource.System)
        expect(rest?.metadata).toMatchObject({ endedRound: true, awaitsEndDie: true })
        expect(rest?.metadata?.endDieRoll).toBeUndefined()
        expect(rest?.revealsInfo).toBe(false)
        expect(result.updatedState.machineState).toBe(MachineState.EndOfRound)
        expect(result.updatedState.activePlayerIds).toEqual(['p1'])
        expect(result.updatedState.round).toBe(6)
        expect(engine.getValidActionTypesForPlayer(game, result.updatedState, 'p1')).toEqual([ActionType.RollEndDie])
        expect(engine.getValidActionTypesForPlayer(game, result.updatedState, 'p2')).toEqual([])
    })

    it('refuses the roll from any other seat', () => {
        const waiting = roundEnd(6).updatedState
        expect(() => run(buildAction(RollEndDie, { playerId: 'p2' }), waiting)).toThrow()
    })

    it('leaves the last seat’s End the Act Phase the last undoable action until the roll, which nothing undoes (R-X.3)', () => {
        const result = roundEnd(6)
        const users = result.processedActions.filter((action) => action.source === ActionSource.User)
        expect(users.map((action) => [action.type, action.playerId])).toEqual([[ActionType.EndActPhase, 'p2']])
        expect(result.processedActions.some((action) => action.revealsInfo)).toBe(false)

        const rolled = run(buildAction(RollEndDie, { playerId: 'p1' }), result.updatedState)
        expect(rolled.processedActions[0].revealsInfo).toBe(true)
    })

    it('a 4 in round six goes on to round seven, opening with the Chancellor’s Wake (R-1.7)', () => {
        const seed = seedRolling(4, 6)
        const waiting = roundEnd(6, { state: { prng: { seed, invocations: 0 } } }).updatedState
        const rolled = run(buildAction(RollEndDie, { playerId: 'p1' }), waiting)

        expect(rolled.processedActions.find(isRollEndDie)?.metadata).toEqual({ roll: 4, round: 6, threshold: 5 })
        expect(rolled.updatedState.round).toBe(7)
        expect(rolled.updatedState.winningPlayerIds).toEqual([])
        expect(rolled.updatedState.activePlayerIds).toEqual(['p1'])
        expect(rolled.updatedState.turnManager.series.at(-1)).toMatchObject({ playerId: 'p1' })
    })

    it('a 5 in round six ends the game for the Chancellor', () => {
        const seed = seedRolling(5, 6)
        const waiting = roundEnd(6, { state: { prng: { seed, invocations: 0 } } }).updatedState
        const rolled = run(buildAction(RollEndDie, { playerId: 'p1' }), waiting)

        expect(rolled.processedActions.find(isRollEndDie)?.metadata).toEqual({ roll: 5, round: 6, threshold: 5, wonBy: 'R-3.3' })
        expect(rolled.updatedState.machineState).toBe(MachineState.EndOfGame)
        expect(rolled.updatedState.winningPlayerIds).toEqual(['p1'])
    })

    it('gives the win to a Citizen meeting the Successor goal (R-3.3.1)', () => {
        const players = [
            testPlayer({ playerId: 'p1', color: Color.Purple, status: PlayerStatus.Chancellor }),
            testPlayer({ playerId: 'p2', color: Color.Red, status: PlayerStatus.Citizen, relicIds: [GRAND_SCEPTER_ID] })
        ]
        for (let seed = 1; seed < 100; seed++) {
            const state = testState(players, {
                machineState: MachineState.EndOfRound,
                chancellorPlayerId: 'p1',
                oathType: OathType.Devotion,
                oathkeeperPlayerId: 'p1',
                round: 7,
                prng: { seed, invocations: 0 },
                oathRevision: OathRevision.TurnFlow
            })
            const roll = new HydratedRollEndDie(buildAction(RollEndDie, { playerId: 'p1' }))
            roll.apply(state, machineContext(state))
            if (state.winningPlayerIds.length === 0) continue
            expect(state.winningPlayerIds).toEqual(['p2'])
            expect(roll.metadata?.wonBy).toBe('R-3.3.1')
            return
        }
        throw Error('no seed below 100 rolls a 3 or higher')
    })

    it('rolls nothing and goes on when an Exile holds the title', () => {
        const result = roundEnd(6, {
            state: { oathType: OathType.ThePeople, oathkeeperPlayerId: 'p2', banners: testBanners({ [Banner.PeoplesFavor]: 'p2' }, 2) }
        })
        expect(result.processedActions.find(isCompleteRest)?.metadata?.awaitsEndDie).toBeUndefined()
        expect(result.updatedState.machineState).not.toBe(MachineState.EndOfRound)
        expect(result.updatedState.round).toBe(7)
    })

    it('ends round eight by War Exhaustion at the automatic Rest, with no roll (R-3.4)', () => {
        const before = table({ resting: 'p2', round: 8 })
        const result = endActPhase(before)
        const rest = result.processedActions.find(isCompleteRest)
        expect(rest?.metadata?.awaitsEndDie).toBeUndefined()
        expect(rest?.metadata?.wonBy).toBe('R-3.4.1')
        expect(result.updatedState.machineState).toBe(MachineState.EndOfGame)
        expect(result.updatedState.prng.invocations).toBe(before.prng.invocations)
    })

    it('rolls inside the Rest, as recorded, in a game created before the revision (R-X.4)', () => {
        const result = roundEnd(6, { createdBeforeRevisions: true })
        expect(result.updatedState.machineState).toBe(MachineState.RestPhase)
        const rested = run(buildAction(CompleteRest, { playerId: 'p2' }), result.updatedState)
        expect(rested.processedActions.find(isCompleteRest)?.metadata?.endDieRoll).toBeDefined()
        expect(rested.processedActions[0].revealsInfo).toBe(true)
        expect(rested.processedActions.some(isRollEndDie)).toBe(false)
    })
})

describe('the automatic Rest and the other System Actions of the same cascade', () => {
    it('strands no free action: a grant due at End the Act Phase is not carried past it (R-10.2)', () => {
        const state = table({ p1: { freeTravelAtAction: 0 } })
        expect(hasFreeActionAhead(new HydratedOathGameState(state), 'p1')).toBe(true)
        const result = endActPhase(state)
        expect(result.processedActions.filter(isCompleteRest)).toHaveLength(1)
        expect(hasFreeActionAhead(new HydratedOathGameState(result.updatedState), 'p1')).toBe(false)
    })

    it('records one title transfer, one Rest and one Wake, in that order, and the Wake reads the new holder (R-2.11-H1, R-4.1.3)', () => {
        const state = table({ state: { warbandsBySite: { c2: { p2: 1 } } } })
        const result = endActPhase(state)

        expect(result.processedActions.map((action) => action.type)).toEqual([
            ActionType.EndActPhase,
            ActionType.TransferOathkeeper,
            ActionType.CompleteRest,
            ActionType.ResolveWake
        ])
        expect(result.updatedState.oathkeeperPlayerId).toBe('p2')
        expect(result.processedActions.find(isResolveWake)?.metadata?.flippedToUsurper).toBe(true)
        expect(result.updatedState.oathkeeperIsUsurper).toBe(true)
    })

    it('decides the Rest once the title has moved: Naysayers, usable only under the new holder, keeps the turn open (R-4.3.5)', () => {
        const state = table({
            resting: 'p2',
            p2: { advisers: [{ cardId: NAYSAYERS, faceUp: true }] },
            state: { warbandsBySite: { c2: { p2: 1 } } }
        })
        const result = endActPhase(state)

        expect(result.processedActions.map((action) => action.type)).toEqual([
            ActionType.EndActPhase,
            ActionType.TransferOathkeeper
        ])
        expect(result.updatedState.oathkeeperPlayerId).toBe('p2')
        expect(result.updatedState.machineState).toBe(MachineState.RestPhase)
        expect(result.updatedState.activePlayerIds).toEqual(['p2'])
        const hydrated = new HydratedOathGameState(result.updatedState)
        expect(HydratedUseRestPower.usableRestPowers(hydrated, 'p2').map((power) => power.cardId)).toEqual([NAYSAYERS])
    })
})

describe('the Rest panel reads its banks the way the engine does', () => {
    it('a bank power is usable with a bank that holds favor', () => {
        const state = new HydratedOathGameState(table({ p1: { advisers: [{ cardId: OBEDIENCE, faceUp: true }] } }))
        const [power] = HydratedUseRestPower.usableRestPowers(state, 'p1')
        expect(power.cardId).toBe(OBEDIENCE)
        expect(HydratedUseRestPower.reasonCannotUse(state, 'p1', OBEDIENCE, restPower(OBEDIENCE), [bank(Suit.Hearth)])).toBeUndefined()
    })
})
