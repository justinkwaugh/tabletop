import { describe, expect, it } from 'vitest'
import {
    Color,
    GameResult,
    createCallGameAction,
    createStalledGameAction,
    validateGameResult,
    type Game,
    type GameAction
} from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { wholeWorld } from '../testing/chronicleWorld.js'
import { buildAction } from '../testing/actions.js'
import { testBanners, testPlayer, testState } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { FESTIVAL_DISTRICT, placeEdifice } from '../testing/edifices.js'
import { required } from '../testing/required.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { OathRuntime } from '../definition/runtime.js'
import { Banner, OathType, PlayerStatus } from '../model/oathEnums.js'
import type { OathProjectedState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { PowerQuestionKind } from '../model/question.js'
import { ResolveWake } from '../actions/resolveWake.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { FINAL_ROUND } from '../actions/completeRest.js'
import { RollEndDie, isRollEndDie } from '../actions/rollEndDie.js'
import { AnswerQuestion } from '../actions/answerQuestion.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

/**
 * A tournament game records its result at the win and never enters the Chronicle: the Chronicle's
 * waits would hold a tournament's result, and a tournament game is never continued.
 */

const BEFORE = OathRevision.EngineFixes25
const AT = OathRevision.Chronicle

type Kind = 'tournament' | 'ordinary' | 'before'

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

/** `turnOf`'s turn open, started as a tournament game, an ordinary one, or one below the chronicle revision. */
function table(
    kind: Kind,
    players: OathPlayerState[],
    turnOf: string,
    overrides: Partial<OathProjectedState>,
    edificeAt?: string
): OathProjectedState {
    const fixture = testState(players, {
        chancellorPlayerId: 'p1',
        warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 } },
        oathRevision: kind === 'before' ? BEFORE : AT,
        ...(kind === 'before'
            ? {}
            : {
                  table: {
                      name: 'Thursday table',
                      date: '2026-10-22',
                      seatNames: { p1: 'Dana', p2: 'Rhys', p3: 'Ann' }
                  }
              }),
        ...(kind === 'tournament' ? { tournamentGame: true } : {}),
        ...overrides
    })
    // An ordinary game's win runs the chronicle's steps, which deal with every card of the game.
    const state = wholeWorld(fixture)
    if (edificeAt) placeEdifice(state, edificeAt, FESTIVAL_DISTRICT, { ruined: true })
    const raw = state.dehydrate()
    const turnOrder = players.map((player) => player.playerId)
    raw.turnManager = {
        series: [{ type: 'turn', playerId: turnOf, start: 0 }],
        turnOrder,
        turnCounts: Object.fromEntries(
            turnOrder.map((id) => [id, turnOrder.indexOf(id) < turnOrder.indexOf(turnOf) ? 1 : 0])
        )
    }
    raw.activePlayerIds = [turnOf]
    return raw
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

/** Wake, R-3.1 — Rhys wakes as the Usurper of Devotion. */
function usurperWake(kind: Kind): Played {
    const state = table(kind, [chancellor(), exile('p2', Color.Red)], 'p2', {
        machineState: MachineState.WakePhase,
        oathType: OathType.Devotion,
        oathkeeperPlayerId: 'p2',
        oathkeeperIsUsurper: true,
        banners: testBanners({ [Banner.DarkestSecret]: 'p2' })
    })
    return play(testGame(['p1', 'p2']), state, [
        buildAction(ResolveWake, { playerId: 'p2', favorSteps: [] })
    ])
}

/** The end die, R-3.3.1 — Ann, a Citizen and the Oathkeeper of The People, takes the Chancellor's roll. */
function successorOnTheEndDie(kind: Kind, seed: number): Played {
    const state = table(
        kind,
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

/** The Rest, R-3.4.1 — the eighth round closes with the Empire holding the title. */
function warExhaustionAtTheRest(kind: Kind): Played {
    const state = table(kind, [chancellor(), exile('p2', Color.Red)], 'p2', {
        machineState: MachineState.ActPhase,
        oathkeeperPlayerId: 'p1',
        round: FINAL_ROUND
    })
    return play(testGame(['p1', 'p2']), state, [buildAction(EndActPhase, { playerId: 'p2' })])
}

/**
 * An answered question, R-3.3 — Squalid District's ruler, Rhys, raises the Chancellor's 4 to a 5
 * in round six, which ends the game for the Chancellor.
 */
function squalidAnswer(kind: Kind, seed: number, answered = true): Played {
    const state = table(
        kind,
        [chancellor(), exile('p2', Color.Red)],
        'p2',
        {
            machineState: MachineState.ActPhase,
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'p1',
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { p2: 1 } },
            denizensBySite: { c1: [], c2: [], p1: [] },
            round: 6,
            prng: { seed, invocations: 0 }
        },
        'c2'
    )
    return play(testGame(['p1', 'p2']), state, [
        buildAction(EndActPhase, { playerId: 'p2' }),
        buildAction(RollEndDie, { playerId: 'p1' }),
        ...(answered
            ? [
                  buildAction(AnswerQuestion, {
                      playerId: 'p2',
                      answer: { kind: PowerQuestionKind.AdjustEndDie, by: 1 }
                  })
              ]
            : [])
    ])
}

function rolled(played: Played): number | undefined {
    return played.actions.find(isRollEndDie)?.metadata?.roll
}

/** R-3.3 at the end of round 7 needs a 3 or more. */
const SUCCESSOR_SEED = (() => {
    for (let seed = 1; seed < 100; seed++) {
        const roll = rolled(successorOnTheEndDie('before', seed))
        if (roll !== undefined && roll >= 3) return seed
    }
    throw Error('no seed below 100 rolls a 3 or more')
})()

/** A 4 in round six, one short of the 5 that ends the game. */
const SQUALID_SEED = (() => {
    for (let seed = 1; seed < 500; seed++) {
        if (rolled(squalidAnswer('before', seed, false)) === 4) return seed
    }
    throw Error('no seed below 500 rolls a 4')
})()

const ENDINGS: Record<string, (kind: Kind) => Played> = {
    'the Wake: a Usurper (R-3.1)': usurperWake,
    'the end die: a Successor (R-3.3.1)': (kind) => successorOnTheEndDie(kind, SUCCESSOR_SEED),
    'the Rest: War Exhaustion after round 8 (R-3.4.1)': warExhaustionAtTheRest,
    'an answered question: Squalid District raises the end die (R-3.3)': (kind) =>
        squalidAnswer(kind, SQUALID_SEED)
}

const CHRONICLE_ACTIONS: ReadonlySet<string> = new Set([
    ActionType.ChronicleStart,
    ActionType.ChronicleFlipCitizens,
    ActionType.ChronicleDispossess,
    ActionType.ChronicleRelics,
    ActionType.ChronicleRebuild
])

describe('a tournament game records its result at the win and skips the Chronicle', () => {
    for (const [name, ending] of Object.entries(ENDINGS)) {
        describe(name, () => {
            it('ends at the win with its one winner, no Chronicle and no continuation', () => {
                const { game, final, actions } = ending('tournament')
                expect(final.machineState).toBe(MachineState.EndOfGame)
                expect(final.result).toBe(GameResult.Win)
                expect(final.winningPlayerIds).toHaveLength(1)
                expect(final.activePlayerIds).toEqual([])
                expect(final.canContinue).toBeUndefined()
                expect(Object.keys(final)).not.toContain('chronicle')
                expect(Object.keys(final)).not.toContain('chronicleRecord')
                expect(actions.filter((action) => CHRONICLE_ACTIONS.has(action.type))).toEqual([])
                expect(() => validateGameResult(final)).not.toThrow()
                const scoring = required(OathRuntime.scoring, 'Oath declares its final scores')
                expect(scoring.finalScores(final)).toEqual(
                    Object.fromEntries(
                        game.players.map((player) => [
                            player.id,
                            final.winningPlayerIds.includes(player.id) ? 1 : 0
                        ])
                    )
                )
            })

            it('wins as a game below the chronicle revision does: the same winner and the same actions', () => {
                const before = ending('before')
                const tournament = ending('tournament')
                const record = (action: GameAction) => [
                    action.type,
                    action.source,
                    action.revealsInfo
                ]
                expect(tournament.final.winningPlayerIds).toEqual(before.final.winningPlayerIds)
                expect(tournament.final.round).toBe(before.final.round)
                expect(tournament.actions.map(record)).toEqual(before.actions.map(record))
            })

            it('the same win in an ordinary game still waits on its Chronicle', () => {
                const { final } = ending('ordinary')
                expect(final.machineState).toBe(MachineState.Chronicle)
                expect(final.result).toBeUndefined()
            })

            it('offers no seat any action once won', () => {
                const { game, final } = ending('tournament')
                for (const player of final.players) {
                    expect(
                        engine.getValidActionTypesForPlayer(game, final, player.playerId)
                    ).toEqual([])
                }
            })
        })
    }
})

describe('a tournament game: Call, Concede and a stall end it as they always have', () => {
    function beforeTheWin() {
        return table(
            'tournament',
            [chancellor(), exile('p2', Color.Red), exile('p3', Color.Blue)],
            'p2',
            { machineState: MachineState.ActPhase }
        )
    }
    const game = testGame(['p1', 'p2', 'p3'])

    it('a call', () => {
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
        const called = engine.runNext(call, beforeTheWin(), game).updatedState
        expect(called.result).toBe(GameResult.Win)
        expect(called.winningPlayerIds).toEqual(['p3'])
        expect(called.canContinue).toBeUndefined()
        expect(called.chronicle).toBeUndefined()
    })

    it('a concession', () => {
        const conceded = createCallGameAction({
            gameId: 'game-1',
            ballot: {
                initiatorPlayerId: 'p2',
                declaredWinnerId: 'p1',
                approvingPlayerIds: ['p2'],
                decliningPlayerIds: []
            },
            players: [{}, {}, {}]
        })
        const after = engine.runNext(conceded, beforeTheWin(), game).updatedState
        expect(after.result).toBe(GameResult.Win)
        expect(after.winningPlayerIds).toEqual(['p1'])
        expect(after.canContinue).toBeUndefined()
    })

    it('a stalled table', () => {
        const stalled = createStalledGameAction({ gameId: 'game-1' })
        const after = engine.runNext(stalled, beforeTheWin(), game).updatedState
        expect(after.result).toBe(GameResult.Abandoned)
        expect(after.canContinue).toBeUndefined()
    })
})
