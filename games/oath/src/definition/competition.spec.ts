import { describe, expect, it } from 'vitest'
import { required } from '../testing/required.js'
import {
    ActionSource,
    GameResult,
    assert,
    createAction,
    validateGameResult,
    type Game,
    type GameConfig
} from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { waitingGame } from '../testing/game.js'
import { OathGameInitializer } from './initializer.js'
import { OathRuntime, OathVisibility } from './runtime.js'
import { MachineState } from './states.js'
import { Banner, OathType, PlayerStatus } from '../model/oathEnums.js'
import {
    HydratedOathGameState,
    OathGameStateValidator,
    type OathProjectedState
} from '../model/gameState.js'
import { SetupChoice } from '../actions/setupChoice.js'
import { ResolveWake, type WakeFavorStep } from '../actions/resolveWake.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { CompleteRest } from '../actions/completeRest.js'
import { RollEndDie } from '../actions/rollEndDie.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import {
    applyPeoplesFavorStep,
    availablePeoplesFavorOptions,
    banksWithLeastFavor,
    peoplesFavorStepCount
} from '../util/wake.js'
import { OathImperialColor } from './colors.js'

const MASTER_SEED = '0123456789abcdef0123456789abcdef'

/** The master seed numbered `n`, for setups drawn across seeds. */
function masterSeed(n: number): string {
    return n.toString(16).padStart(32, '0')
}

/** Enough seeds to draw each of the four Oaths at every player count. */
const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1)

/** A game the tournament provisions: the platform names its table before setup. */
function tournamentGame(count: number, config: GameConfig = {}): Game {
    return {
        ...waitingGame(count, config),
        tournament: { tournamentId: 'spring-cup', stageId: 'main', tableId: '1', scheduleId: 's' }
    }
}

/**
 * A new game has no options, so its config is empty, and a tournament game's Oath is drawn at
 * random; a stored or provisioned config may still name its Oath. The Oath changes setup: who
 * holds a banner.
 */
const CONFIGS: { oathType?: OathType }[] = [
    {},
    ...Object.values(OathType).map((oathType) => ({ oathType }))
]
const CONFIG_CASES = CONFIGS.map((config) => [config.oathType ?? 'no options', config] as const)

/** R-1.13 — the banner the Chancellor starts with, if the Oath gives one. */
const OATH_BANNER: Partial<Record<OathType, Banner>> = {
    [OathType.Devotion]: Banner.DarkestSecret,
    [OathType.ThePeople]: Banner.PeoplesFavor
}

function rotations(ids: readonly string[]): string[][] {
    return ids.map((_, start) => [...ids.slice(start), ...ids.slice(0, start)])
}

function start(game: Game, order?: string[], seed = MASTER_SEED): OathProjectedState {
    return engine.startGame(game, {
        masterSeed: seed,
        ...(order ? { startingPositions: { playerIds: order } } : {})
    }).initialState
}

/** R-1.23 — each seat keeps an adviser and places its pawn, in turn order. */
function playSetup(game: Game, initial: OathProjectedState) {
    let state = initial
    const actors: string[] = []
    while (state.machineState === MachineState.Setup) {
        const hydrated = new HydratedOathGameState(state)
        const [playerId] = state.activePlayerIds
        const hand = hydrated.getPlayerState(playerId).knownHand()
        const siteId =
            playerId === state.chancellorPlayerId ? TOP_CRADLE_SLOT : hydrated.faceupSiteIds()[1]
        const action = createAction(SetupChoice, {
            id: `setup-${state.actionCount}`,
            gameId: state.gameId,
            source: ActionSource.User,
            index: state.actionCount,
            playerId,
            siteId,
            adviserCardId: hand[0],
            discardOrder: hand.slice(1)
        })
        state = engine.run(action, state, game).updatedState
        actors.push(playerId)
    }
    return { state, actors }
}

describe.each(CONFIG_CASES)('Oath tournaments, %s', (_name, config) => {
    describe.each([2, 3, 4, 5, 6])('with %i players', (count) => {
        it('R-1.7 — position zero is the Chancellor, and every seat keeps its assigned place through setup', () => {
            const game = tournamentGame(count, config)
            expect(new OathGameInitializer().supportsStartingPositions).toBe(true)
            const unassigned = start(game)
            if (config.oathType) expect(unassigned.oathType).toBe(config.oathType)
            const banner = OATH_BANNER[unassigned.oathType]
            for (const order of rotations(game.players.map((player) => player.id))) {
                const initial = start(game, order)
                expect(initial.turnManager.turnOrder).toEqual(order)
                expect(initial.players.map((player) => player.playerId)).toEqual(order)
                expect(initial.chancellorPlayerId).toBe(order[0])
                expect(initial.oathType).toBe(unassigned.oathType)
                expect(initial.players[0]).toMatchObject({
                    status: PlayerStatus.Chancellor,
                    color: OathImperialColor
                })
                expect(initial.oathkeeperPlayerId).toBe(order[0])
                if (banner) expect(initial.banners[banner].holderPlayerId).toBe(order[0])
                expect(initial.machineState).toBe(MachineState.Setup)
                expect(initial.vault).toEqual(unassigned.vault)
                expect(initial.map).toEqual(unassigned.map)
                expect(initial.siteCards).toEqual(unassigned.siteCards)

                const { state, actors } = playSetup(game, initial)
                expect(actors).toEqual(order)
                expect(state.turnManager.series.at(-1)?.playerId).toBe(order[0])
                expect(state.activePlayerIds).toEqual([order[0]])
            }
        })

        it('an assignment moves no seeded draw: the deal and the colour each seat takes stay as an unassigned game deals them', () => {
            const game = tournamentGame(count, config)
            const uninitialized = engine.generateUninitializedState(game)
            const initialize = (order?: string[]) =>
                new OathGameInitializer()
                    .initializeGameState(
                        game,
                        structuredClone(uninitialized),
                        order ? { playerIds: order } : undefined
                    )
                    .dehydrate()
            const normal = initialize()
            expect(initialize(normal.turnManager.turnOrder)).toEqual(normal)

            const seatColors = (state: OathProjectedState) =>
                state.players.map((player) => player.color)
            for (const order of rotations([...normal.turnManager.turnOrder].reverse())) {
                const assigned = initialize(order)
                expect(initialize(order)).toEqual(assigned)
                expect(seatColors(assigned)).toEqual(seatColors(normal))
                expect(assigned.vault).toEqual(normal.vault)
                expect(assigned.map).toEqual(normal.map)
                expect(assigned.siteCards).toEqual(normal.siteCards)
            }
        })
    })
})

/** R-4.1.1 — the holder places favor while they have it, and otherwise returns it to a bank with the least. */
function peoplesFavorSteps(state: OathProjectedState, playerId: string): WakeFavorStep[] {
    if (state.banners[Banner.PeoplesFavor].holderPlayerId !== playerId) return []
    const rehearsal = new HydratedOathGameState(structuredClone(state))
    const steps: WakeFavorStep[] = []
    while (steps.length < peoplesFavorStepCount(rehearsal)) {
        const [kind] = availablePeoplesFavorOptions(rehearsal, playerId)
        if (kind === undefined) break
        const step: WakeFavorStep =
            kind === 'place' ? { kind } : { kind, toSuit: banksWithLeastFavor(rehearsal)[0] }
        applyPeoplesFavorStep(rehearsal, playerId, step)
        steps.push(step)
    }
    return steps
}

/** R-4.1 to R-4.3 — the active seat's Wake, a turn of no actions, and its Rest; a Wake that wins ends there. R-3.3 — the Chancellor's end die between rounds. */
function playTurn(game: Game, state: OathProjectedState): OathProjectedState {
    const [playerId] = state.activePlayerIds
    if (state.machineState === MachineState.EndOfRound) {
        return engine.runNext(buildAction(RollEndDie, { playerId }), state, game).updatedState
    }
    let next = state
    if (next.machineState === MachineState.WakePhase) {
        next = engine.runNext(
            buildAction(ResolveWake, {
                playerId,
                favorSteps: peoplesFavorSteps(next, playerId)
            }),
            next,
            game
        ).updatedState
    }
    if (next.winningPlayerIds.length > 0) return next
    next = engine.runNext(buildAction(EndActPhase, { playerId }), next, game).updatedState
    // R-4.3.5 — the Rest waits on the seat only while it holds a Rest power it can use.
    return next.machineState === MachineState.RestPhase
        ? engine.runNext(buildAction(CompleteRest, { playerId }), next, game).updatedState
        : next
}

/** Turns until one wins; the result must come with that win, so a game held open stops here too. */
function playUntilTheEnd(game: Game, initial: OathProjectedState): OathProjectedState {
    let state = initial
    while (state.winningPlayerIds.length === 0) state = playTurn(game, state)
    return state
}

/** Setup under a reversed assignment; `seed` fixes R-3.3's end die, which is the only protected draw after setup. */
function assignedGame(count: number, config: GameConfig, seed?: number) {
    const game = tournamentGame(count, config)
    const order = game.players.map((player) => player.id).reverse()
    const initial = start(game, order)
    if (seed !== undefined) initial.protectedPrng = { seed, invocations: 0 }
    return { game, order, state: playSetup(game, initial).state }
}

function expectOneScoredWinner(game: Game, finished: OathProjectedState, winnerId: string) {
    assert(OathGameStateValidator.Check(finished), 'A finished game is canonical')
    expect(finished.machineState).toBe(MachineState.EndOfGame)
    expect(finished.result).toBe(GameResult.Win)
    expect(finished.winningPlayerIds).toEqual([winnerId])
    // No Chronicle: the result comes at the win, and a tournament game is never continued.
    expect(finished.canContinue).toBeUndefined()
    expect(Object.keys(finished)).not.toContain('chronicle')
    expect(Object.keys(finished)).not.toContain('chronicleRecord')
    expect(() => validateGameResult(finished)).not.toThrow()

    const scoring = required(OathRuntime.scoring, 'Oath declares its final scores')
    const finalScores = scoring.finalScores(finished)
    expect(finalScores).toEqual(
        Object.fromEntries(
            game.players.map((player) => [player.id, player.id === winnerId ? 1 : 0])
        )
    )
    const spectatorView = OathVisibility.state.project(
        finished,
        { kind: 'spectator' },
        { config: game.config }
    )
    expect(scoring.finalScores(spectatorView)).toEqual(finalScores)
}

/** R-3.3 ends a passive game in rounds five to seven, R-3.4 at the end of the eighth; the first seed ending in `rounds`. */
function finishedWithin(count: number, rounds: (round: number) => boolean) {
    for (let seed = 1; seed < 100; seed++) {
        const { game, order, state } = assignedGame(count, {}, seed)
        const finished = playUntilTheEnd(game, state)
        if (rounds(finished.round)) return { game, order, finished }
    }
    throw Error('no seed below 100 ends in the rounds asked for')
}

describe('Oath tournament results', () => {
    it('R-3.1 — a Usurper Wake victory passes validateGameResult and scores its one winner', () => {
        const { game, order, state } = assignedGame(3, { oathType: OathType.ThePeople })
        // The People's Favor passes to seat one after setup, as a won Campaign would hand it over.
        state.banners[Banner.PeoplesFavor].holderPlayerId = order[1]

        const finished = playUntilTheEnd(game, state)
        expect(finished.round).toBe(2)
        expectOneScoredWinner(game, finished, order[1])
    })

    it('R-3.3 — a Stable Regime victory by the Chancellor’s end die passes validateGameResult and scores its one winner', () => {
        const { game, order, finished } = finishedWithin(3, (round) => round < 8)
        expectOneScoredWinner(game, finished, order[0])
    })

    it('R-3.4 — a War Exhaustion victory at the automatic Rest passes validateGameResult and scores its one winner', () => {
        const { game, order, finished } = finishedWithin(3, (round) => round === 8)
        expectOneScoredWinner(game, finished, order[0])
    })
})

describe.each([2, 3, 4, 5, 6])('Oath tournament results with %i players', (count) => {
    it('a game with no options records its result at the win, with no Chronicle, and scores its one winner', () => {
        const { game, order, finished } = finishedWithin(count, () => true)
        expect(game.config).toEqual({})
        expectOneScoredWinner(game, finished, order[0])
    })

    it('its Oath is drawn from all four across seeds; an ordinary game’s is Supremacy on every one', () => {
        const drawn = new Set<OathType>()
        for (const n of SEEDS) {
            const tournament = start(tournamentGame(count), undefined, masterSeed(n))
            expect(tournament.tournamentGame).toBe(true)
            drawn.add(tournament.oathType)
            const ordinary = start(waitingGame(count), undefined, masterSeed(n))
            expect(ordinary.oathType).toBe(OathType.Supremacy)
            expect(Object.keys(ordinary)).not.toContain('tournamentGame')
        }
        expect([...drawn].sort()).toEqual(Object.values(OathType).sort())
    })

    it.each(Object.values(OathType))(
        'drawn as %s, it sets up under that Oath and plays its first round',
        (oathType) => {
            const game = tournamentGame(count)
            const order = game.players.map((player) => player.id)
            const n = SEEDS.find(
                (seed) => start(game, order, masterSeed(seed)).oathType === oathType
            )
            assert(n !== undefined, `no seed up to ${SEEDS.length} draws ${oathType}`)
            const initial = start(game, order, masterSeed(n))
            // R-1.13, R-1.14 — the Chancellor holds the Oath's banner, if it gives one, and the title.
            const banner = OATH_BANNER[oathType]
            if (banner) expect(initial.banners[banner].holderPlayerId).toBe(order[0])
            for (const other of Object.values(Banner).filter((b) => b !== banner)) {
                expect(initial.banners[other].holderPlayerId).toBeUndefined()
            }
            expect(initial.oathkeeperPlayerId).toBe(order[0])

            let state = playSetup(game, initial).state
            const turns: string[] = []
            while (state.round === 1) {
                turns.push(state.activePlayerIds[0])
                state = playTurn(game, state)
            }
            expect(turns).toEqual(order)
            expect(state.round).toBe(2)
            expect(state.oathType).toBe(oathType)
            // R-1.7 — the second round opens with the Chancellor's turn.
            expect(state.activePlayerIds).toEqual([order[0]])
            expect(state.winningPlayerIds).toEqual([])
        }
    )
})
