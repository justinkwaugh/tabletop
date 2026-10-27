import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    ActionSource,
    Color,
    GameResult,
    GameStatus,
    assertExists,
    createCallGameAction,
    createStalledGameAction,
    latestPlayerUndoTarget,
    type Game,
    type GameAction
} from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction, machineContext } from '../testing/actions.js'
import { testBanners, testPlayer, testState } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { served, spectator } from '../testing/projection.js'
import { MachineState } from '../definition/states.js'
import { OathStateHandlers } from '../definition/stateHandlers.js'
import { Banner, OathType, PlayerStatus } from '../model/oathEnums.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { ChronicleMark, ChronicleStep, type TableRecord } from '../model/chronicle.js'
import { WinKind } from '../model/ending.js'
import { ResolveWake } from '../actions/resolveWake.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { FINAL_ROUND } from '../actions/completeRest.js'
import { RollEndDie, isRollEndDie } from '../actions/rollEndDie.js'
import { Travel } from '../actions/travel.js'
import { TransferOathkeeper } from '../actions/transferOathkeeper.js'
import { CHRONICLE_STEPS, stateAfterWin, tableRecordOf } from '../util/chronicle.js'
import { OathRevision } from '../util/revision.js'

/** The revision before the chronicle: a game recorded under it ends exactly as it always has. */
const BEFORE = OathRevision.EngineFixes25
const AT = OathRevision.Chronicle

const SEAT_NAMES = { p1: 'Dana', p2: 'Rhys', p3: 'Ann' }
const TABLE: TableRecord = { name: 'Thursday table', date: '2026-10-22', seatNames: SEAT_NAMES }

const FAITH = 'vision.faith'
const SANCTUARY = 'vision.sanctuary'

function chancellor(): OathPlayerState {
    return testPlayer({
        playerId: 'p1',
        color: Color.Purple,
        status: PlayerStatus.Chancellor,
        siteId: 'c1',
        warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 }
    })
}

function exile(playerId: string, color: Color, overrides: Partial<OathPlayerState> = {}) {
    return testPlayer({
        playerId,
        color,
        status: PlayerStatus.Exile,
        siteId: 'c2',
        warbandsInPersonalBank: { [playerId]: 4 },
        ...overrides
    })
}

/** A table at `revision` with `turnOf`'s turn open; from the chronicle revision it was started with its table record. */
function table(
    revision: OathRevision,
    players: OathPlayerState[],
    turnOf: string,
    overrides: Partial<OathProjectedState>
): OathProjectedState {
    const state = testState(players, {
        chancellorPlayerId: 'p1',
        warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 } },
        oathRevision: revision,
        ...(revision >= AT ? { table: TABLE } : {}),
        ...overrides
    }).dehydrate()
    const turnOrder = players.map((player) => player.playerId)
    state.turnManager = {
        series: [{ type: 'turn', playerId: turnOf, start: 0 }],
        turnOrder,
        turnCounts: Object.fromEntries(
            turnOrder.map((id) => [id, turnOrder.indexOf(id) < turnOrder.indexOf(turnOf) ? 1 : 0])
        )
    }
    state.activePlayerIds = [turnOf]
    return state
}

type Played = { game: Game; final: OathProjectedState; actions: GameAction[] }

function play(game: Game, state: OathProjectedState, steps: GameAction[]): Played {
    let current = state
    const actions: GameAction[] = []
    for (const step of steps) {
        const result = engine.runNext(step, current, game)
        actions.push(...result.processedActions)
        current = result.updatedState
    }
    return { game, final: current, actions }
}

/** R-3.1 — Rhys wakes as the Usurper of Devotion, holding the Darkest Secret their revealed Faith asks for too. */
function usurperWake(revision: OathRevision, overrides: Partial<OathProjectedState> = {}) {
    const state = table(
        revision,
        [chancellor(), exile('p2', Color.Red, { revealedVisionId: FAITH })],
        'p2',
        {
            machineState: MachineState.WakePhase,
            oathType: OathType.Devotion,
            oathkeeperPlayerId: 'p2',
            oathkeeperIsUsurper: true,
            banners: testBanners({ [Banner.DarkestSecret]: 'p2' }),
            visionsDrawn: 3,
            ...overrides
        }
    )
    return play(testGame(['p1', 'p2']), state, [
        buildAction(ResolveWake, { playerId: 'p2', favorSteps: [] })
    ])
}

/** R-3.2, R-3.2-H2 — Rhys, Oathkeeper of Protection but not yet its Usurper, wakes meeting their own Faith and, through False Prophet, Ann's Sanctuary. */
function visionaryWake(revision: OathRevision) {
    const state = table(
        revision,
        [
            chancellor(),
            exile('p2', Color.Red, { revealedVisionId: FAITH }),
            exile('p3', Color.Blue, { revealedVisionId: SANCTUARY, siteId: 'h1' })
        ],
        'p2',
        {
            machineState: MachineState.WakePhase,
            oathType: OathType.Protection,
            oathkeeperPlayerId: 'p2',
            banners: testBanners({ [Banner.DarkestSecret]: 'p2' }),
            warbandsOnCards: { [SANCTUARY]: { p2: 1 } },
            visionsDrawn: 3
        }
    )
    return play(testGame(['p1', 'p2', 'p3']), state, [
        buildAction(ResolveWake, { playerId: 'p2', favorSteps: [] })
    ])
}

/** R-3.3, R-3.3.1 — Ann, a Citizen and the Oathkeeper of The People, holds the Darkest Secret too and takes the Chancellor's roll. */
function stableRegimeSuccessor(revision: OathRevision, seed: number) {
    const state = table(
        revision,
        [
            chancellor(),
            exile('p2', Color.Red),
            exile('p3', Color.Blue, { status: PlayerStatus.Citizen, siteId: 'c1' })
        ],
        'p3',
        {
            machineState: MachineState.ActPhase,
            oathType: OathType.ThePeople,
            oathkeeperPlayerId: 'p3',
            banners: testBanners({ [Banner.PeoplesFavor]: 'p3', [Banner.DarkestSecret]: 'p3' }),
            round: 7,
            prng: { seed, invocations: 0 }
        }
    )
    return play(testGame(['p1', 'p2', 'p3']), state, [
        buildAction(EndActPhase, { playerId: 'p3' }),
        buildAction(RollEndDie, { playerId: 'p1' })
    ])
}

/** R-3.4, R-3.4.1 — the eighth round closes with the Empire holding the title. */
function warExhaustion(revision: OathRevision) {
    const state = table(revision, [chancellor(), exile('p2', Color.Red)], 'p2', {
        machineState: MachineState.ActPhase,
        oathkeeperPlayerId: 'p1',
        round: FINAL_ROUND
    })
    return play(testGame(['p1', 'p2']), state, [buildAction(EndActPhase, { playerId: 'p2' })])
}

/** R-3.3 at the end of round 7 needs a 3 or more. */
const WINNING_SEED = (() => {
    for (let seed = 1; seed < 100; seed++) {
        const { actions } = stableRegimeSuccessor(BEFORE, seed)
        const roll = actions.find(isRollEndDie)?.metadata?.roll
        if (roll !== undefined && roll >= 3) return seed
    }
    throw Error('no seed below 100 rolls a 3 or more')
})()

const ENDINGS: Record<string, (revision: OathRevision) => Played> = {
    'a Usurper in Wake': (revision) => usurperWake(revision),
    'a Visionary in Wake': (revision) => visionaryWake(revision),
    'a Successor on the end die': (revision) => stableRegimeSuccessor(revision, WINNING_SEED),
    'War Exhaustion after round 8': (revision) => warExhaustion(revision)
}

function stringsIn(value: unknown): string[] {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.flatMap(stringsIn)
    if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn)
    return []
}

/** A choice not yet built, made to wait on its choosers as a built one will. */
function waitAt(step: ChronicleStep) {
    const rule = CHRONICLE_STEPS.find((candidate) => candidate.step === step)
    if (rule?.kind !== 'choice') throw Error(`${step} is not a choice`)
    return vi.spyOn(rule, 'applies').mockReturnValue(true)
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('the chronicle gate: a game below the chronicle revision ends as it always has', () => {
    for (const [name, ending] of Object.entries(ENDINGS)) {
        it(`${name}: the result in the winning action, no chronicle, no record, no continuation`, () => {
            const { final } = ending(BEFORE)
            expect(final.machineState).toBe(MachineState.EndOfGame)
            expect(final.result).toBe(GameResult.Win)
            expect(final.canContinue).toBeUndefined()
            expect(final.activePlayerIds).toEqual([])
            expect(Object.keys(final)).not.toContain('chronicle')
            expect(Object.keys(final)).not.toContain('chronicleRecord')
            expect(Object.keys(final)).not.toContain('table')
        })
    }
})

describe('R-8 — at the chronicle revision a win writes its chronicle before the result', () => {
    for (const [name, ending] of Object.entries(ENDINGS)) {
        it(`${name}: runs every step in the winning action, then sets the result and the continuation together`, () => {
            const before = ending(BEFORE)
            const { final, actions } = ending(AT)
            expect(final.machineState).toBe(MachineState.EndOfGame)
            expect(final.result).toBe(GameResult.Win)
            expect(final.canContinue).toBe(true)
            expect(final.activePlayerIds).toEqual([])
            expect(final.winningPlayerIds).toEqual(before.final.winningPlayerIds)
            expect(final.chronicle?.step).toBeUndefined()
            expect(final.chronicleRecord).toHaveLength(1)
            // The same actions, recorded alike: the chronicle adds nothing to the History yet.
            expect(
                actions.map((action) => [action.type, action.source, action.revealsInfo])
            ).toEqual(
                before.actions.map((action) => [action.type, action.source, action.revealsInfo])
            )
        })
    }

    it('consults all twelve steps, in the Law’s order, inside the winning action', () => {
        expect(CHRONICLE_STEPS.map((rule) => rule.step)).toEqual(Object.values(ChronicleStep))
        const consulted = CHRONICLE_STEPS.map((rule) => vi.spyOn(rule, 'applies'))
        warExhaustion(AT)
        expect(consulted.map((spy) => spy.mock.calls.length)).toEqual(CHRONICLE_STEPS.map(() => 1))
    })

    it('R-3.1 with a revealed Vision met: the ending records both ways (R-8.1 reads every way)', () => {
        expect(usurperWake(AT).final.chronicle?.ending).toEqual({
            winnerPlayerId: 'p2',
            kind: WinKind.Usurper,
            rule: 'R-3.1',
            mark: ChronicleMark.Oathkeeper,
            waysMet: { usurper: true, visionIds: [FAITH], empire: false }
        })
    })

    it('R-3.2-H2 — a Visionary meeting a second, shared Vision records both Visions', () => {
        expect(visionaryWake(AT).final.chronicle?.ending).toEqual({
            winnerPlayerId: 'p2',
            kind: WinKind.Visionary,
            rule: 'R-3.2',
            mark: ChronicleMark.Visionary,
            waysMet: { usurper: false, visionIds: [FAITH, SANCTUARY], empire: false }
        })
    })

    it('R-3.3.1 — the Successor is marked S and won through the Empire', () => {
        expect(stableRegimeSuccessor(AT, WINNING_SEED).final.chronicle?.ending).toEqual({
            winnerPlayerId: 'p3',
            kind: WinKind.Successor,
            rule: 'R-3.3.1',
            mark: ChronicleMark.Successor,
            waysMet: { usurper: false, visionIds: [], empire: true }
        })
    })

    it('R-3.4.1 — the Chancellor’s War Exhaustion win is marked O', () => {
        expect(warExhaustion(AT).final.chronicle?.ending).toEqual({
            winnerPlayerId: 'p1',
            kind: WinKind.WarExhaustion,
            rule: 'R-3.4.1',
            mark: ChronicleMark.Oathkeeper,
            waysMet: { usurper: false, visionIds: [], empire: true }
        })
    })
})

describe('the chronicle record', () => {
    it('one entry for the first game: its table, its Oath, how it was won and the winner by name and colour', () => {
        expect(stableRegimeSuccessor(AT, WINNING_SEED).final.chronicleRecord).toEqual([
            {
                gameNumber: 1,
                sessionName: 'Thursday table',
                date: '2026-10-22',
                startingOath: OathType.ThePeople,
                mark: ChronicleMark.Successor,
                kind: WinKind.Successor,
                rule: 'R-3.3.1',
                winner: { name: 'Ann', color: Color.Blue }
            }
        ])
    })

    it('holds no player id: ids change between games', () => {
        for (const ending of Object.values(ENDINGS)) {
            const { final } = ending(AT)
            const ids = final.players.map((player) => player.playerId)
            const strings = stringsIn(final.chronicleRecord)
            expect(strings.length).toBeGreaterThan(0)
            for (const id of ids) expect(strings).not.toContain(id)
        }
    })

    it('numbers the game after the earlier entries and keeps them first, unchanged', () => {
        const earlier = {
            gameNumber: 1,
            sessionName: 'Thursday table',
            date: '2026-10-15',
            startingOath: OathType.Supremacy,
            mark: ChronicleMark.Visionary,
            kind: WinKind.Visionary,
            rule: 'R-3.2' as const,
            winner: { name: 'Bea', color: Color.Yellow },
            nextOath: OathType.Devotion,
            story: 'The Hidden Place fell.'
        }
        const { final } = usurperWake(AT, { chronicleRecord: [earlier] })
        expect(final.chronicleRecord?.map((entry) => entry.gameNumber)).toEqual([1, 2])
        expect(final.chronicleRecord?.[0]).toEqual(earlier)
        expect(final.chronicleRecord?.[1]).toMatchObject({
            startingOath: OathType.Devotion,
            winner: { name: 'Rhys', color: Color.Red }
        })
    })

    it('is public: every seat and the spectator are served the same chronicle, record and table', () => {
        const { final } = visionaryWake(AT)
        const view = (perspective: Parameters<typeof served>[1]) => {
            const { chronicle, chronicleRecord, table } = served(final, perspective)
            return { chronicle, chronicleRecord, table }
        }
        const canonical = {
            chronicle: final.chronicle,
            chronicleRecord: final.chronicleRecord,
            table: final.table
        }
        expect(view(spectator)).toEqual(canonical)
        for (const player of final.players) {
            expect(view({ kind: 'player', playerId: player.playerId })).toEqual(canonical)
        }
    })
})

describe('the table record at the start', () => {
    it('stores the game’s name, the day it started (UTC) and each seat’s name', () => {
        const game = testGame(['p1', 'p2'], {
            name: 'Thursday table',
            createdAt: new Date('2026-10-20T23:30:00Z'),
            startedAt: new Date('2026-10-21T01:15:00-05:00')
        })
        game.players[0].name = 'Dana'
        game.players[1].name = 'Rhys'
        expect(tableRecordOf(game)).toEqual({
            name: 'Thursday table',
            date: '2026-10-21',
            seatNames: { p1: 'Dana', p2: 'Rhys' }
        })
        expect(tableRecordOf({ ...game, startedAt: undefined }).date).toBe('2026-10-20')
    })

    it('a game started at the chronicle revision carries it, served alike to every seat', () => {
        const names: Record<string, string> = SEAT_NAMES
        const game = testGame(['p1', 'p2', 'p3'], {
            name: 'Thursday table',
            status: GameStatus.WaitingToStart
        })
        game.players = game.players.map((player) => ({ ...player, name: names[player.id] }))
        const { initialState } = engine.startGame(game, {
            masterSeed: '0000000000000000000000000000beef'
        })
        expect(initialState.oathRevision).toBe(AT)
        expect(initialState.table).toEqual(tableRecordOf(game))
        for (const player of initialState.players) {
            expect(
                served(initialState, { kind: 'player', playerId: player.playerId }).table
            ).toEqual(initialState.table)
        }
    })
})

describe('the Chronicle phase while a step waits', () => {
    function waiting() {
        waitAt(ChronicleStep.Vow)
        return usurperWake(AT)
    }

    it('enters Chronicle with the chooser on the clock, and no result or continuation yet', () => {
        const { final } = waiting()
        expect(final.machineState).toBe(MachineState.Chronicle)
        expect(final.chronicle?.step).toBe(ChronicleStep.Vow)
        expect(final.activePlayerIds).toEqual(['p2'])
        expect(final.winningPlayerIds).toEqual(['p2'])
        expect(final.result).toBeUndefined()
        expect(final.canContinue).toBeUndefined()
        expect(final.chronicleRecord).toBeUndefined()
    })

    it('offers nothing on any seat’s own view: the losers never act', () => {
        const { game, final } = waiting()
        for (const player of final.players) {
            const own = served(final, { kind: 'player', playerId: player.playerId })
            expect(engine.getValidActionTypesForPlayer(game, own, player.playerId)).toEqual([])
        }
    })

    it('refuses every other action in plain words, the title’s included', () => {
        const { game, final } = waiting()
        expect(() =>
            engine.runNext(buildAction(Travel, { playerId: 'p2', siteId: 'c1' }), final, game)
        ).toThrow('The game is over; the chronicle is being written')
        expect(() =>
            engine.runNext(
                buildAction(TransferOathkeeper, {
                    source: ActionSource.System,
                    fromPlayerId: 'p1',
                    toPlayerId: 'p2'
                }),
                final,
                game
            )
        ).toThrow('The game is over; the chronicle is being written')
    })

    it('a call during the phase ends the game with no continuation', () => {
        const { game, final } = waiting()
        const call = createCallGameAction({
            gameId: 'game-1',
            ballot: {
                initiatorPlayerId: 'p1',
                declaredWinnerId: 'p2',
                approvingPlayerIds: ['p1', 'p2'],
                decliningPlayerIds: []
            },
            players: [{}, {}, {}]
        })
        const called = engine.runNext(call, final, game).updatedState
        expect(called.result).toBe(GameResult.Win)
        expect(called.canContinue).toBeUndefined()
    })

    it('the chronicle starts with nothing of the game left open', () => {
        const state = new HydratedOathGameState(usurperWake(AT).final)
        state.pendingOathkeeperChoice = {
            holderPlayerId: 'p1',
            candidates: ['p2'],
            resumeMachineState: MachineState.WakePhase
        }
        expect(() => stateAfterWin(state)).toThrow(/nothing of the game left open/)
    })
})

describe('called, conceded and stalled games never set the continuation', () => {
    function beforeTheWin() {
        const state = table(
            AT,
            [chancellor(), exile('p2', Color.Red), exile('p3', Color.Blue)],
            'p2',
            {
                machineState: MachineState.ActPhase
            }
        )
        return state
    }

    it('a call before the win', () => {
        const call = createCallGameAction({
            gameId: 'game-1',
            ballot: {
                initiatorPlayerId: 'p1',
                declaredWinnerId: 'p3',
                approvingPlayerIds: ['p1', 'p2', 'p3'],
                decliningPlayerIds: []
            },
            players: [{}, {}, {}]
        })
        const called = engine.runNext(
            call,
            beforeTheWin(),
            testGame(['p1', 'p2', 'p3'])
        ).updatedState
        expect(called.result).toBe(GameResult.Win)
        expect(called.canContinue).toBeUndefined()
        expect(called.chronicleRecord).toBeUndefined()
    })

    it('a concession', () => {
        const state = table(AT, [chancellor(), exile('p2', Color.Red)], 'p2', {
            machineState: MachineState.ActPhase
        })
        const conceded = createCallGameAction({
            gameId: 'game-1',
            ballot: {
                initiatorPlayerId: 'p2',
                declaredWinnerId: 'p1',
                approvingPlayerIds: ['p2'],
                decliningPlayerIds: []
            },
            players: [{}, {}]
        })
        const after = engine.runNext(conceded, state, testGame(['p1', 'p2'])).updatedState
        expect(after.result).toBe(GameResult.Win)
        expect(after.canContinue).toBeUndefined()
    })

    it('a stalled game', () => {
        const stalled = createStalledGameAction({ gameId: 'game-1' })
        const after = engine.runNext(
            stalled,
            beforeTheWin(),
            testGame(['p1', 'p2', 'p3'])
        ).updatedState
        expect(after.result).toBe(GameResult.Abandoned)
        expect(after.canContinue).toBeUndefined()
    })
})

describe('R-X.3 — entering the chronicle reveals nothing, so a win’s undo is today’s', () => {
    for (const [name, ending] of Object.entries(ENDINGS)) {
        it(`${name}: the same undo target before and at the chronicle revision`, () => {
            const before = ending(BEFORE)
            const at = ending(AT)
            for (const player of at.final.players) {
                expect(latestPlayerUndoTarget(at.actions, player.playerId)?.index).toBe(
                    latestPlayerUndoTarget(before.actions, player.playerId)?.index
                )
            }
        })
    }
})

describe('the Chronicle machine state', () => {
    it('waits on the choosers of the step being written', () => {
        const handler = OathStateHandlers[MachineState.Chronicle]
        const state = new HydratedOathGameState(usurperWake(AT).final)
        const chronicle = state.chronicle
        assertExists(chronicle, 'the win stored its ending')
        state.machineState = MachineState.Chronicle
        chronicle.step = ChronicleStep.Story
        handler.enter(machineContext(state))
        expect(state.activePlayerIds).toEqual(['p2'])
    })
})
