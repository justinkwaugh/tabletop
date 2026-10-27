import { describe, expect, it, vi } from 'vitest'
import { Color, GameResult, assertExists, type GameAction } from '@tabletop/common'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { RollEndDie, isRollEndDie } from '../actions/rollEndDie.js'
import { AnswerQuestion, isAnswerQuestion } from '../actions/answerQuestion.js'
import { PowerTiming } from '../data/cardPowers.js'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { Banner, OathType, PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind, type ExchangeTerms } from '../model/question.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { ChronicleStep } from '../model/chronicle.js'
import { CHRONICLE_STEPS } from '../util/chronicle.js'
import { buildAction } from '../testing/actions.js'
import {
    DANA,
    FESTIVAL_DISTRICT,
    PLAINS_SLOT,
    RHYS,
    edificeTable,
    placeEdifice
} from '../testing/edifices.js'
import { engine } from '../testing/engine.js'
import { testBanners, testPlayer, testState } from '../testing/fixture.js'
import { testGame } from '../testing/game.js'
import { served, spectator } from '../testing/projection.js'
import { answerQuestion } from '../testing/steps.js'
import { PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { legalPowers, reasonCannotUsePower } from '../util/powerDoorway.js'
import { currentQuestion } from '../util/questions.js'
import { endDieAdjuster } from '../util/persistent.js'
import { rulersOfSite } from '../util/rule.js'
import { CURRENT_OATH_REVISION } from '../util/revision.js'
import './index.js'

const INTACT = 0
const TENTS = 'denizen.nomad.tents'
const ELDERS = 'denizen.nomad.elders'
const FAITHFUL_FRIEND = 'denizen.nomad.faithful-friend'
const CUP = 'relic.cup-of-plenty'
const BANDIT_CROWN = 'relic.bandit-crown'

function exchange(withPlayerId: string, terms: ExchangeTerms): PowerChoice {
    return { kind: PowerChoiceKind.Exchange, withPlayerId, terms }
}

function festival(s: HydratedOathGameState, choice: PowerChoice, playerId = DANA) {
    const action = new HydratedUseActionPower(
        buildAction(UseActionPower, {
            playerId,
            cardId: FESTIVAL_DISTRICT,
            powerIndex: INTACT,
            choices: [choice]
        })
    )
    action.apply(s)
    return action
}

/** Dana at the Plains with Festival District and Tents faceup; Rhys with Elders facedown. */
function festivalTable(ruined = false): HydratedOathGameState {
    return edificeTable(
        {
            [DANA]: { advisers: [{ cardId: TENTS, faceUp: true }] },
            [RHYS]: { advisers: [{ faceUp: false }], adviserIds: [ELDERS], relicIds: [CUP] }
        },
        {},
        { plains: FESTIVAL_DISTRICT, ruined }
    )
}

const advisersForAdviser: ExchangeTerms = {
    fromProposer: { adviserRows: [0] },
    fromCounterparty: { adviserRows: [0] }
}

describe('Festival District — "Action: Negotiate a binding exchange of [favor], [secret], and advisers with any player"', () => {
    it('is offered as an Action power, and its exchange waits on the other player (R-7.6.3)', () => {
        const s = festivalTable()
        expect(
            legalPowers(s, DANA, PowerTiming.Action).some(
                (use) => use.cardId === FESTIVAL_DISTRICT && use.powerIndex === INTACT
            )
        ).toBe(true)
        const action = festival(s, exchange(RHYS, advisersForAdviser))
        expect(action.metadata?.summary).toBe(`proposed a binding exchange to ${RHYS}`)
        expect(currentQuestion(s)).toMatchObject({
            kind: PowerQuestionKind.Exchange,
            cardId: FESTIVAL_DISTRICT,
            askedPlayerId: RHYS,
            proposerPlayerId: DANA
        })
    })

    it('trades advisers by row as The Gathering does: the facedown one is handed over unseen by the table (R-X.3)', () => {
        const s = festivalTable()
        festival(s, exchange(RHYS, advisersForAdviser))
        answerQuestion(s, RHYS, { kind: PowerQuestionKind.Exchange, accept: true })
        expect(s.getPlayerState(DANA).knownAdviserIds()).toEqual([ELDERS])
        expect(s.getPlayerState(RHYS).faceupAdviserIds()).toEqual([TENTS])
        expect(JSON.stringify(served(s, spectator))).not.toContain(ELDERS)
    })

    it('carries favor and secrets, never a relic', () => {
        const s = festivalTable()
        expect(
            reasonCannotUsePower(s, DANA, FESTIVAL_DISTRICT, INTACT, PowerTiming.Action, [
                exchange(RHYS, { fromProposer: { favor: 1 }, fromCounterparty: { secrets: 1 } })
            ])
        ).toBeUndefined()
        expect(
            reasonCannotUsePower(s, DANA, FESTIVAL_DISTRICT, INTACT, PowerTiming.Action, [
                exchange(RHYS, { fromCounterparty: { relicCardIds: [CUP] } })
            ])
        ).toMatch(/relic/)
    })

    it('refuses a faceup locked adviser, as any exchange does (R-7.2.2)', () => {
        const s = festivalTable()
        s.oathRevision = CURRENT_OATH_REVISION
        s.getPlayerState(DANA).advisers = [{ cardId: FAITHFUL_FRIEND, faceUp: true }]
        expect(
            reasonCannotUsePower(s, DANA, FESTIVAL_DISTRICT, INTACT, PowerTiming.Action, [
                exchange(RHYS, { fromProposer: { adviserRows: [0] } })
            ])
        ).toBe(`${FAITHFUL_FRIEND} is locked`)
    })

    it('with any player, wherever their pawn is', () => {
        const s = festivalTable()
        s.getPlayerState(RHYS).siteId = 'h1'
        festival(s, exchange(RHYS, { fromProposer: { favor: 1 } }))
        answerQuestion(s, RHYS, { kind: PowerQuestionKind.Exchange, accept: true })
        expect(s.getPlayerState(RHYS).favor).toBe(5)
    })

    it('at a site the bandits rule, a player whose pawn is there may use it (R-7.1.1)', () => {
        const s = festivalTable()
        s.warbandsBySite = {}
        festival(s, exchange(RHYS, { fromProposer: { favor: 1 } }))
        expect(currentQuestion(s)?.askedPlayerId).toBe(RHYS)
    })

    it('Squalid District has no Action: Festival District is face down', () => {
        const s = festivalTable(true)
        expect(
            reasonCannotUsePower(s, DANA, FESTIVAL_DISTRICT, INTACT, PowerTiming.Action, [
                exchange(RHYS, { fromProposer: { favor: 1 } })
            ])
        ).toBe('Festival District: that side of the card is face down')
    })
})

// Squalid District: "Whenever the [endDie] is rolled to end the game, Squalid District's ruler may
// increase or decrease this roll by one. Citizens cannot use this power."
interface RoundOptions {
    round?: number
    seed?: number
    /** Where Squalid District lies: Dana's Imperial c1, Rhys's c2, or p1, which no one holds. */
    at?: 'c1' | 'c2' | 'p1'
    ruined?: boolean
    rhys?: Record<string, unknown>
    warbands?: OathProjectedState['warbandsBySite']
    state?: Partial<OathProjectedState>
}

/** Dana, the Chancellor and Oathkeeper, at c1 with Imperial warbands; Rhys, an Exile, closes the round at c2. */
function roundEnd({
    round = 6,
    seed = 1,
    at = 'c2',
    ruined = true,
    rhys = {},
    warbands,
    state = {}
}: RoundOptions = {}): OathProjectedState {
    const s = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 }
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c2',
                warbandsInPersonalBank: { [RHYS]: 4 },
                ...rhys
            })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: DANA,
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: DANA,
            warbandsBySite: warbands ?? { c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [RHYS]: 1 } },
            denizensBySite: { c1: [], c2: [], p1: [] },
            round,
            oathRevision: CURRENT_OATH_REVISION,
            // A game started at this revision carries its table record, which R-8's record reads.
            table: {
                name: 'Thursday table',
                date: '2026-10-22',
                seatNames: { [DANA]: 'Dana', [RHYS]: 'Rhys' }
            },
            prng: { seed, invocations: 0 },
            ...state
        }
    )
    placeEdifice(s, at, FESTIVAL_DISTRICT, { ruined })
    const raw = s.dehydrate()
    raw.turnManager = {
        series: [{ type: 'turn', playerId: RHYS, start: 0 }],
        turnOrder: [DANA, RHYS],
        turnCounts: { [DANA]: 1, [RHYS]: 0 }
    }
    raw.activePlayerIds = [RHYS]
    const waiting = run(buildAction(EndActPhase, { playerId: RHYS }), raw).updatedState
    expect(waiting.machineState).toBe(MachineState.EndOfRound)
    return waiting
}

const game = testGame([DANA, RHYS])

function run(action: GameAction, state: OathProjectedState) {
    return engine.runNext(action, state, game)
}

function roll(state: OathProjectedState) {
    return run(buildAction(RollEndDie, { playerId: DANA }), state)
}

/** A seed whose end die rolls `wanted` from the table `options` sets up. */
function seedRolling(wanted: number, options: RoundOptions = {}): number {
    for (let seed = 1; seed < 500; seed++) {
        const rolled = roll(roundEnd({ ...options, seed, ruined: false }))
        if (rolled.processedActions.find(isRollEndDie)?.metadata?.roll === wanted) return seed
    }
    throw Error(`no seed below 500 rolls a ${wanted}`)
}

function adjust(state: OathProjectedState, by: number, playerId = RHYS) {
    return run(
        buildAction(AnswerQuestion, {
            playerId,
            answer: { kind: PowerQuestionKind.AdjustEndDie, by }
        }),
        state
    )
}

describe('Squalid District — its ruler may raise or lower the end die by one, after the roll', () => {
    it('asks its ruler once the Chancellor has rolled; nothing is decided until they answer', () => {
        const options = { round: 6 }
        const seed = seedRolling(5, options)
        const rolled = roll(roundEnd({ ...options, seed }))
        expect(rolled.processedActions.find(isRollEndDie)?.metadata).toEqual({
            roll: 5,
            round: 6,
            threshold: 5,
            adjustedBy: RHYS
        })
        expect(rolled.processedActions[0].revealsInfo).toBe(true)
        const state = rolled.updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual([RHYS])
        expect(state.round).toBe(6)
        expect(state.winningPlayerIds).toEqual([])
        expect(state.pendingQuestions?.queue).toEqual([
            {
                kind: PowerQuestionKind.AdjustEndDie,
                cardId: FESTIVAL_DISTRICT,
                askedPlayerId: RHYS,
                roll: 5,
                round: 6,
                threshold: 5
            }
        ])
        expect(engine.getValidActionTypesForPlayer(game, state, DANA)).toEqual([])
    })

    it('a 5 lowered to 4 in round six: play goes on to round seven, with the Chancellor’s Wake', () => {
        const options = { round: 6 }
        const rolled = roll(roundEnd({ ...options, seed: seedRolling(5, options) }))
        const answered = adjust(rolled.updatedState, -1)
        const answer = answered.processedActions.find(isAnswerQuestion)
        expect(answer?.metadata?.summary).toBe('lowered the end die to 4')
        expect(answer?.metadata?.endDie).toEqual({ rolled: 5, roll: 4, round: 6, threshold: 5 })
        expect(answered.updatedState.round).toBe(7)
        expect(answered.updatedState.winningPlayerIds).toEqual([])
        expect(answered.updatedState.activePlayerIds).toEqual([DANA])
        expect(answered.updatedState.turnManager.series.at(-1)).toMatchObject({ playerId: DANA })
    })

    it('a 4 raised to 5 in round six ends the game for the Chancellor', () => {
        const options = { round: 6 }
        const rolled = roll(roundEnd({ ...options, seed: seedRolling(4, options) }))
        const answered = adjust(rolled.updatedState, 1)
        expect(answered.processedActions.find(isAnswerQuestion)?.metadata?.endDie).toEqual({
            rolled: 4,
            roll: 5,
            round: 6,
            threshold: 5,
            wonBy: 'R-3.3'
        })
        expect(answered.updatedState.machineState).toBe(MachineState.EndOfGame)
        expect(answered.updatedState.winningPlayerIds).toEqual([DANA])
    })

    it('the win its answer makes is chronicled before the result (R-8)', () => {
        const options = { round: 6 }
        const rolled = roll(roundEnd({ ...options, seed: seedRolling(4, options) }))
        const ended = adjust(rolled.updatedState, 1).updatedState
        expect(ended.result).toBe(GameResult.Win)
        expect(ended.canContinue).toBe(true)
        expect(ended.chronicleRecord?.map((entry) => [entry.rule, entry.winner])).toEqual([
            ['R-3.3', { name: 'Dana', color: Color.Purple }]
        ])

        // With a step waiting, the answer leaves the game in the Chronicle phase, and says so.
        const vow = CHRONICLE_STEPS.find((rule) => rule.step === ChronicleStep.Vow)
        assertExists(vow, 'the Vow is a step')
        const waits = vi.spyOn(vow, 'applies').mockReturnValue(true)
        const answered = adjust(rolled.updatedState, 1)
        waits.mockRestore()
        expect(answered.updatedState.machineState).toBe(MachineState.Chronicle)
        expect(answered.updatedState.pendingQuestions).toBeUndefined()
        expect(answered.updatedState.activePlayerIds).toEqual([DANA])
        expect(answered.updatedState.result).toBeUndefined()
        expect(answered.processedActions.find(isAnswerQuestion)?.metadata?.resumeMachineState).toBe(
            MachineState.Chronicle
        )
    })

    it('a 6 raised in round five still ends the game (its Q&A)', () => {
        const options = { round: 5 }
        const rolled = roll(roundEnd({ ...options, seed: seedRolling(6, options) }))
        const answered = adjust(rolled.updatedState, 1)
        expect(answered.processedActions.find(isAnswerQuestion)?.metadata?.summary).toBe(
            'raised the end die to 7'
        )
        expect(answered.updatedState.winningPlayerIds).toEqual([DANA])
    })

    it('a 3 lowered to 2 in round seven ends nothing; a 1 lowered to 0 neither', () => {
        for (const [wanted, after] of [
            [3, 2],
            [1, 0]
        ]) {
            const options = { round: 7 }
            const rolled = roll(roundEnd({ ...options, seed: seedRolling(wanted, options) }))
            const answered = adjust(rolled.updatedState, -1)
            expect(answered.processedActions.find(isAnswerQuestion)?.metadata?.endDie).toEqual({
                rolled: wanted,
                roll: after,
                round: 7,
                threshold: 3
            })
            expect(answered.updatedState.round).toBe(8)
            expect(answered.updatedState.winningPlayerIds).toEqual([])
        }
    })

    it('left as rolled, the roll decides as it would have', () => {
        const options = { round: 6 }
        const rolled = roll(roundEnd({ ...options, seed: seedRolling(5, options) }))
        const answered = adjust(rolled.updatedState, 0)
        expect(answered.processedActions.find(isAnswerQuestion)?.metadata?.summary).toBe(
            'left the end die at 5'
        )
        expect(answered.updatedState.winningPlayerIds).toEqual([DANA])
    })

    it('only its ruler answers, by one at most', () => {
        const rolled = roll(roundEnd({ seed: seedRolling(5) }))
        expect(() => adjust(rolled.updatedState, 1, DANA)).toThrow()
        expect(() => adjust(rolled.updatedState, 2)).toThrow()
    })

    it('at an Imperial site the Chancellor is asked, never a Citizen (6.6.3): the roller answers too', () => {
        const rolled = roll(
            roundEnd({
                at: 'c1',
                rhys: { status: PlayerStatus.Citizen, color: Color.Red },
                seed: seedRolling(5, { at: 'c1' })
            })
        )
        expect(rolled.processedActions.find(isRollEndDie)?.metadata?.adjustedBy).toBe(DANA)
        expect(rolled.updatedState.activePlayerIds).toEqual([DANA])
    })

    it('of a Chancellor and an Exile who both rule its site, the Chancellor is asked', () => {
        const rolled = roll(
            roundEnd({
                warbands: {
                    c1: { [IMPERIAL_WARBANDS]: 1 },
                    c2: { [RHYS]: 1, [IMPERIAL_WARBANDS]: 1 }
                }
            })
        )
        expect(rolled.processedActions.find(isRollEndDie)?.metadata?.adjustedBy).toBe(DANA)
    })

    it('the bandits ask nobody: the roll is read at once (R-X.1)', () => {
        const options = { at: 'p1' as const }
        const rolled = roll(roundEnd({ ...options, seed: seedRolling(4, options) }))
        expect(rolled.processedActions.find(isRollEndDie)?.metadata).toEqual({
            roll: 4,
            round: 6,
            threshold: 5
        })
        expect(rolled.updatedState.round).toBe(7)
        expect(rolled.updatedState.pendingQuestions).toBeUndefined()
    })

    it('the Bandit Crown’s holder rules a bandit site, so they are asked (R-7.6.5-H1)', () => {
        // Devotion's title, the Darkest Secret, stays Dana's though the Crown gives Rhys the empty sites.
        const rolled = roll(
            roundEnd({
                at: 'p1',
                rhys: { relicIds: [BANDIT_CROWN] },
                state: {
                    oathType: OathType.Devotion,
                    banners: testBanners({ [Banner.DarkestSecret]: DANA })
                }
            })
        )
        expect(rolled.processedActions.find(isRollEndDie)?.metadata?.adjustedBy).toBe(RHYS)
    })

    it('a Citizen holding the Bandit Crown: its bandits are the Empire’s, so the Chancellor is asked', () => {
        const rolled = roll(
            roundEnd({ at: 'p1', rhys: { relicIds: [BANDIT_CROWN], status: PlayerStatus.Citizen } })
        )
        expect(rolled.processedActions.find(isRollEndDie)?.metadata?.adjustedBy).toBe(DANA)
    })

    it('a Citizen who alone rules it is never the one asked: "Citizens cannot use this power"', () => {
        // Before the Crown's bandits were the Empire's (R-X.4), they served its Citizen holder alone.
        const s = edificeTable(
            { [RHYS]: { relicIds: [BANDIT_CROWN], status: PlayerStatus.Citizen } },
            {},
            { plains: FESTIVAL_DISTRICT, ruined: true }
        )
        s.warbandsBySite = {}
        expect(rulersOfSite(s, PLAINS_SLOT)).toEqual([RHYS])
        expect(endDieAdjuster(s)).toBeUndefined()
        s.getPlayerState(RHYS).status = PlayerStatus.Exile
        expect(endDieAdjuster(s)).toEqual({ cardId: FESTIVAL_DISTRICT, playerId: RHYS })
    })

    it('Festival District, its intact side, asks nobody', () => {
        const options = { ruined: false }
        const rolled = roll(roundEnd({ ...options, seed: seedRolling(4, options) }))
        expect(rolled.processedActions.find(isRollEndDie)?.metadata).toEqual({
            roll: 4,
            round: 6,
            threshold: 5
        })
        expect(rolled.updatedState.round).toBe(7)
        expect(rolled.updatedState.pendingQuestions).toBeUndefined()
    })

    it('the question is the asked player’s on each seat’s own view', () => {
        const rolled = roll(roundEnd({ seed: seedRolling(5) }))
        const state = rolled.updatedState
        for (const playerId of [DANA, RHYS]) {
            const view = served(new HydratedOathGameState(state), { kind: 'player', playerId })
            expect(
                engine.getValidActionTypesForPlayer(game, view, playerId, {
                    perspective: { kind: 'player', playerId }
                })
            ).toEqual(engine.getValidActionTypesForPlayer(game, state, playerId))
        }
    })
})
