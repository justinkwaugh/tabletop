import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Banner, PlayerStatus, SearchPlay, Suit } from '../model/oathEnums.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedResolveWake, ResolveWake, requiredFavorSteps, type WakeFavorStep } from '../actions/resolveWake.js'
import { HydratedAnswerQuestion, AnswerQuestion } from '../actions/answerQuestion.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { SearchResolve } from '../actions/searchResolve.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { availablePeoplesFavorOptions, forcedPeoplesFavorOptions, peoplesFavorStepIsOptional } from '../util/wake.js'
import { currentQuestion } from '../util/questions.js'
import { sitesRuledBy } from '../util/rule.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { OathRevision } from '../util/revision.js'
import { testBanners, testPlayer, testState, openTurn } from '../testing/fixture.js'
import { rulerTable, adviser } from '../testing/tables.js'
import { actionPowerUse } from '../testing/choices.js'
import { answerQuestion, playDrawnCard } from '../testing/steps.js'
import { buildAction } from '../testing/actions.js'
import { engine, OathTestEngine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { expectFavorConserved } from '../testing/census.js'
import { OathRuntime } from '../definition/runtime.js'
import { FILLER, TENTS } from '../testing/cards.js'
import '../powers/index.js'

/**
 * Vow of Kinship's Q&A — "You can use Nomad favor as if it is on your board, but you are not forced
 * to" (R-10.10-H1). From revision 18 a must-if-able step or payment counts only the board's favor.
 */
const VOW = 'denizen.nomad.vow-of-kinship'
const PLAGUE = 'denizen.arcane.plague-engines'
const DISSENT = 'denizen.discord.dissent'
const WOLVES = 'denizen.beast.wolves'

const NOW = OathRevision.EngineFixes14
const BEFORE = OathRevision.EngineFixes13

const DANA = 'dana'
const BEA = 'bea'

describe("the People's Favor Wake with the Vow of Kinship's bank (R-4.1.1.I)", () => {
    /** Dana holds the People's Favor and the Vow, with nothing on their board and three in the Nomad bank. */
    function wake(revision: OathRevision, value: number, { mob = false, nomad = 3, favor = 0 } = {}) {
        const s = testState(
            [
                testPlayer({ playerId: DANA, siteId: 'c1', favor, advisers: [adviser(VOW)] }),
                testPlayer({ playerId: BEA, color: Color.Blue, siteId: 'c2', status: PlayerStatus.Chancellor, advisers: [adviser(TENTS, false)] })
            ],
            { oathRevision: revision, machineState: MachineState.WakePhase, banners: testBanners({ [Banner.PeoplesFavor]: DANA }, value) }
        )
        s.favorBank[Suit.Nomad] = nomad
        s.banners[Banner.PeoplesFavor].mobSide = mob
        openTurn(s, DANA)
        return s
    }
    const reason = (s: HydratedOathGameState, steps: WakeFavorStep[]) => HydratedResolveWake.reasonCannotResolveWake(s, DANA, steps)
    const ret: WakeFavorStep = { kind: 'return', toSuit: Suit.Hearth }
    const place: WakeFavorStep = { kind: 'place' }
    // A place from the Nomad bank leaves it the one bank with the least favor.
    const retNomad: WakeFavorStep = { kind: 'return', toSuit: Suit.Nomad }

    it('at 1 with an empty board, placing is optional: none or one from the bank are both legal', () => {
        const s = wake(NOW, 1)
        expect(availablePeoplesFavorOptions(s, DANA)).toEqual(['place'])
        expect(forcedPeoplesFavorOptions(s, DANA)).toEqual([])
        expect(peoplesFavorStepIsOptional(s, DANA)).toBe(true)
        expect(requiredFavorSteps(s, DANA)).toBe(0)
        expect(reason(s, [])).toBeUndefined()
        expect(reason(s, [place])).toBeUndefined()
        // An optional place is still the holder's to decide: the Wake is not skipped.
        expect(HydratedResolveWake.nothingToDecide(s, DANA)).toBe(false)

        new HydratedResolveWake(buildAction(ResolveWake, { playerId: DANA, favorSteps: [place] })).apply(s)
        expect(s.favorBank[Suit.Nomad]).toBe(2)
        expect(s.banners[Banner.PeoplesFavor].value).toBe(2)
    })

    it('placing none leaves the bank and the banner as they were', () => {
        const s = wake(NOW, 1)
        new HydratedResolveWake(buildAction(ResolveWake, { playerId: DANA, favorSteps: [] })).apply(s)
        expect(s.favorBank[Suit.Nomad]).toBe(3)
        expect(s.banners[Banner.PeoplesFavor].value).toBe(1)
    })

    it('with nothing in the bank either, there is still nothing to decide', () => {
        const s = wake(NOW, 1, { nomad: 0 })
        expect(availablePeoplesFavorOptions(s, DANA)).toEqual([])
        expect(peoplesFavorStepIsOptional(s, DANA)).toBe(false)
        expect(HydratedResolveWake.nothingToDecide(s, DANA)).toBe(true)
    })

    it('board favor still forces the place', () => {
        const s = wake(NOW, 1, { favor: 1 })
        expect(forcedPeoplesFavorOptions(s, DANA)).toEqual(['place'])
        expect(reason(s, [])).toMatch(/must/)
    })

    it('at 2 the step is forced as today: Place from the bank or Return, never none', () => {
        const s = wake(NOW, 2)
        expect(peoplesFavorStepIsOptional(s, DANA)).toBe(false)
        expect(requiredFavorSteps(s, DANA)).toBe(1)
        expect(reason(s, [])).toMatch(/must/)
        expect(reason(s, [place])).toBeUndefined()
        expect(reason(s, [ret])).toBeUndefined()
    })

    it('on the Mob side each step is judged alone: after a Return to 1 the second place is optional', () => {
        const s = wake(NOW, 2, { mob: true })
        expect(requiredFavorSteps(s, DANA)).toBe(1)
        expect(reason(s, [ret])).toBeUndefined()
        expect(reason(s, [ret, place])).toBeUndefined()
        // A place takes the banner to 3, so the second step can Return and must.
        expect(reason(s, [place])).toMatch(/must/)
        expect(reason(s, [place, retNomad])).toBeUndefined()
        expect(reason(s, [])).toMatch(/must/)
    })

    it('on the Mob side at 1, an optional first place makes the second step a must', () => {
        const s = wake(NOW, 1, { mob: true })
        expect(requiredFavorSteps(s, DANA)).toBe(0)
        expect(reason(s, [])).toBeUndefined()
        expect(reason(s, [place])).toMatch(/must/)
        expect(reason(s, [place, retNomad])).toBeUndefined()
        expect(reason(s, [place, place])).toBeUndefined()
    })

    it('before revision 18 the bank forces the place, as recorded', () => {
        const s = wake(BEFORE, 1)
        expect(forcedPeoplesFavorOptions(s, DANA)).toEqual(['place'])
        expect(peoplesFavorStepIsOptional(s, DANA)).toBe(false)
        expect(requiredFavorSteps(s, DANA)).toBe(1)
        expect(reason(s, [])).toMatch(/must/)
        expect(reason(s, [place])).toBeUndefined()
        const mob = wake(BEFORE, 2, { mob: true })
        expect(reason(mob, [ret])).toMatch(/must/)
    })

    // Safe on a player's view: the Wake's domain on Dana's own served state matches the server's.
    it.each([
        [1, false],
        [2, false],
        [2, true],
        [1, true]
    ])("at %i (Mob %s), Dana's own view judges every submission as the server does", (value, mob) => {
        const s = wake(NOW, value, { mob })
        const dana = { kind: 'player', playerId: DANA } as const
        const own = new HydratedOathGameState(served(s, dana))
        expect(forcedPeoplesFavorOptions(own, DANA)).toEqual(forcedPeoplesFavorOptions(s, DANA))
        expect(availablePeoplesFavorOptions(own, DANA)).toEqual(availablePeoplesFavorOptions(s, DANA))
        expect(peoplesFavorStepIsOptional(own, DANA)).toEqual(peoplesFavorStepIsOptional(s, DANA))
        expect(requiredFavorSteps(own, DANA)).toEqual(requiredFavorSteps(s, DANA))
        expect(HydratedResolveWake.nothingToDecide(own, DANA)).toEqual(HydratedResolveWake.nothingToDecide(s, DANA))
        const steps: WakeFavorStep[] = [place, ret]
        const submissions: WakeFavorStep[][] = [[], ...steps.map((a) => [a]), ...steps.flatMap((a) => steps.map((b) => [a, b]))]
        for (const favorSteps of submissions) {
            expect(reason(own, favorSteps), JSON.stringify(favorSteps)).toEqual(reason(s, favorSteps))
        }
        const game = { ...testGame([DANA, BEA]), hotseat: false, protectedInformation: true as const }
        expect(engine.getValidActionTypesForPlayer(game, served(s, dana), DANA, { perspective: dana })).toEqual(
            engine.getValidActionTypesForPlayer(game, s.dehydrate(), DANA)
        )
    })
})

/**
 * 'ruler' uses Plague Engines at c1 and rules c1 and c2 (owes 2); 'other' holds the Vow with nothing on
 * their board and rules p1 and h1 (owes 2); 'away', the Chancellor, rules nothing. Banks hold three each.
 */
function plagueTable(
    revision: OathRevision,
    {
        otherFavor = 0,
        nomad = 3,
        otherAdvisers = [VOW, TENTS],
        ruler = {},
        otherWarbands = { p1: 3, h1: 1 }
    }: { otherFavor?: number; nomad?: number; otherAdvisers?: string[]; ruler?: Record<string, unknown>; otherWarbands?: { p1: number; h1: number } } = {}
) {
    const s = rulerTable(
        [PLAGUE],
        [],
        { ruler, other: { favor: otherFavor, advisers: otherAdvisers.map((id) => adviser(id)) }, away: { status: PlayerStatus.Chancellor } },
        {
            oathRevision: revision,
            denizensBySite: { c1: [PLAGUE], c2: [], p1: [WOLVES], h1: [] },
            warbandsBySite: { c1: { ruler: 1 }, c2: { ruler: 2 }, p1: { other: otherWarbands.p1 }, h1: { other: otherWarbands.h1 } }
        }
    )
    s.favorBank[Suit.Nomad] = nomad
    return s
}
const pay = (favor: number): QuestionAnswer => ({ kind: PowerQuestionKind.PayFromHomeBank, favor })

describe('Plague Engines with the Vow of Kinship (revision 18)', () => {
    it("takes only board favor; the holder is asked for the rest, and the power's row counts the boards", () => {
        const s = plagueTable(NOW)
        const arcane = s.favorBank[Suit.Arcane]
        const use = actionPowerUse('ruler', PLAGUE)
        use.apply(s)
        expect(s.favorBank[Suit.Nomad]).toBe(3)
        expect(s.favorBank[Suit.Arcane]).toBe(arcane + 2)
        expect(use.metadata?.summary).toBe('Plague Engines: 2 favor placed into the arcane bank')
        expect(s.pendingQuestions?.queue).toEqual([
            { kind: PowerQuestionKind.PayFromHomeBank, cardId: PLAGUE, askedPlayerId: 'other', owed: 2, toBank: Suit.Arcane }
        ])
        expect(s.pendingQuestions?.askingPlayerId).toBe('ruler')
    })

    it.each([
        [0, 3, 'paid no favor'],
        [1, 2, 'paid 1 favor from the nomad bank into the arcane bank'],
        [2, 1, 'paid 2 favor from the nomad bank into the arcane bank']
    ])('an answer of %i pays that many from the Nomad bank into the arcane bank', (favor, nomadAfter, summary) => {
        const s = plagueTable(NOW)
        actionPowerUse('ruler', PLAGUE).apply(s)
        const arcane = s.favorBank[Suit.Arcane]
        expectFavorConserved(s, () => {
            const answered = answerQuestion(s, 'other', pay(favor))
            expect(answered.metadata?.summary).toBe(summary)
        })
        expect(s.favorBank[Suit.Nomad]).toBe(nomadAfter)
        expect(s.favorBank[Suit.Arcane]).toBe(arcane + favor)
        expect(s.pendingQuestions?.queue).toEqual([])
    })

    it('refuses more than is owed, more than the bank holds, or a part favor', () => {
        const s = plagueTable(NOW, { nomad: 1 })
        actionPowerUse('ruler', PLAGUE).apply(s)
        expect(currentQuestion(s)).toMatchObject({ askedPlayerId: 'other', owed: 2 })
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'other', pay(2))).toMatch(/holds 1/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'other', pay(1))).toBeUndefined()
        const t = plagueTable(NOW)
        actionPowerUse('ruler', PLAGUE).apply(t)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(t, 'other', pay(3))).toMatch(/owe 2/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(t, 'other', pay(0.5))).toMatch(/whole number/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(t, 'ruler', pay(0))).toBeDefined()
    })

    it('board favor is forced first, and only the rest is asked', () => {
        const s = plagueTable(NOW, { otherFavor: 1 })
        actionPowerUse('ruler', PLAGUE).apply(s)
        expect(s.getPlayerState('other').favor).toBe(0)
        expect(currentQuestion(s)).toMatchObject({ askedPlayerId: 'other', owed: 1 })
    })

    it('asks nothing when the bank is empty, when the board paid it all, or when nothing is owed', () => {
        const empty = plagueTable(NOW, { nomad: 0 })
        actionPowerUse('ruler', PLAGUE).apply(empty)
        expect(empty.pendingQuestions).toBeUndefined()
        const paid = plagueTable(NOW, { otherFavor: 2 })
        actionPowerUse('ruler', PLAGUE).apply(paid)
        expect(paid.pendingQuestions).toBeUndefined()
        expect(paid.favorBank[Suit.Nomad]).toBe(3)
        const none = plagueTable(NOW, { otherWarbands: { p1: 0, h1: 0 } })
        actionPowerUse('ruler', PLAGUE).apply(none)
        expect(none.pendingQuestions).toBeUndefined()
        expect(none.favorBank[Suit.Nomad]).toBe(3)
    })

    it('without the Vow nobody is asked, and a board pays as much as it holds, as before', () => {
        const s = plagueTable(NOW, { otherFavor: 1, otherAdvisers: [TENTS] })
        actionPowerUse('ruler', PLAGUE).apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('other').favor).toBe(0)
        expect(s.favorBank[Suit.Nomad]).toBe(3)
    })

    it('"even you": its user holding the Vow is asked too', () => {
        const s = plagueTable(NOW, { otherAdvisers: [TENTS], otherFavor: 2, ruler: { favor: 0, advisers: [adviser(VOW)] } })
        actionPowerUse('ruler', PLAGUE).apply(s)
        expect(s.pendingQuestions?.queue).toEqual([
            { kind: PowerQuestionKind.PayFromHomeBank, cardId: PLAGUE, askedPlayerId: 'ruler', owed: 2, toBank: Suit.Arcane }
        ])
    })

    it('a Citizen holding the Vow is asked about the Nomad bank; the Chancellor, their Imperial ally, never uses it', () => {
        const s = plagueTable(NOW)
        s.getPlayerState('other').status = PlayerStatus.Citizen
        // The Chancellor rules h1 with the Empire's warbands, and owes with nothing on their board.
        s.warbandsBySite['h1'] = { [IMPERIAL_WARBANDS]: 1 }
        s.getPlayerState('away').favor = 0
        expect(sitesRuledBy(s, 'away')).toContain('h1')
        actionPowerUse('ruler', PLAGUE).apply(s)
        expect(s.pendingQuestions?.queue.map((q) => q.askedPlayerId)).toEqual(['other'])
        answerQuestion(s, 'other', pay(2))
        expect(s.favorBank[Suit.Nomad]).toBe(1)
    })

    it('before revision 18 the Nomad bank pays unasked, as recorded', () => {
        const s = plagueTable(BEFORE)
        const arcane = s.favorBank[Suit.Arcane]
        actionPowerUse('ruler', PLAGUE).apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.favorBank[Suit.Nomad]).toBe(1)
        expect(s.favorBank[Suit.Arcane]).toBe(arcane + 4)
    })

    it('from an Action power the question holds the turn for the holder alone, and the answer gives it back', () => {
        const game = testGame(['ruler', 'other', 'away'])
        const testEngine = new OathTestEngine(OathRuntime)
        let state = plagueTable(NOW).dehydrate()
        state.machineState = MachineState.ActPhase
        state.turnManager = { series: [{ type: 'turn', playerId: 'ruler', start: 0 }], turnOrder: ['ruler', 'other', 'away'], turnCounts: { ruler: 1, other: 0, away: 0 } }
        state.activePlayerIds = ['ruler']
        state = testEngine.runNext(buildAction(UseActionPower, { playerId: 'ruler', cardId: PLAGUE, powerIndex: powerIndexOf(PLAGUE, PowerTiming.Action) }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual(['other'])
        expect(testEngine.getValidActionTypesForPlayer(game, state, 'other')).toEqual([ActionType.AnswerQuestion])
        expect(testEngine.getValidActionTypesForPlayer(game, state, 'ruler')).toEqual([])

        // Safe on a player's view: the question's domain on the holder's own served state matches.
        const other = { kind: 'player', playerId: 'other' } as const
        const own = new HydratedOathGameState(served(state, other))
        const host = new HydratedOathGameState(state)
        for (const favor of [0, 1, 2, 3]) {
            expect(HydratedAnswerQuestion.reasonCannotAnswer(own, 'other', pay(favor))).toEqual(
                HydratedAnswerQuestion.reasonCannotAnswer(host, 'other', pay(favor))
            )
        }
        const protectedGame = { ...game, hotseat: false, protectedInformation: true as const }
        expect(testEngine.getValidActionTypesForPlayer(protectedGame, served(state, other), 'other', { perspective: other })).toEqual([
            ActionType.AnswerQuestion
        ])

        state = testEngine.runNext(buildAction(AnswerQuestion, { playerId: 'other', answer: pay(1) }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['ruler'])
        expect(state.favorBank[Suit.Nomad]).toBe(2)
    })
})

describe('Dissent with the Vow of Kinship (revision 18)', () => {
    /** 'other' holds the Vow and Tents (nomad) and rules p1 with Wolves (beast): owes two suits. */
    function dissentTable(revision: OathRevision, { nomad = 3, holder }: { nomad?: number; holder?: string } = {}) {
        const s = plagueTable(revision, { nomad, otherWarbands: { p1: 3, h1: 0 } })
        s.denizensBySite['c1'] = []
        if (holder) s.banners[Banner.PeoplesFavor].holderPlayerId = holder
        return s
    }

    it('puts only board favor on the card; the holder is asked for the rest, paid onto it', () => {
        const s = dissentTable(NOW)
        playDrawnCard(s, DISSENT, SearchPlay.Adviser)
        expect(s.favorBank[Suit.Nomad]).toBe(3)
        expect(currentQuestion(s)).toEqual({ kind: PowerQuestionKind.PayFromHomeBank, cardId: DISSENT, askedPlayerId: 'other', owed: 2 })
        const onCard = s.tokensOn(DISSENT).favor
        const answered = answerQuestion(s, 'other', pay(1))
        expect(answered.metadata?.summary).toBe('paid 1 favor from the nomad bank onto it')
        expect(s.tokensOn(DISSENT).favor).toBe(onCard + 1)
        expect(s.favorBank[Suit.Nomad]).toBe(2)
    })

    it('never asks the holder of the People’s Favor', () => {
        const s = dissentTable(NOW, { holder: 'other' })
        playDrawnCard(s, DISSENT, SearchPlay.Adviser)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.favorBank[Suit.Nomad]).toBe(3)
    })

    it('asks nothing with an empty bank', () => {
        const s = dissentTable(NOW, { nomad: 0 })
        playDrawnCard(s, DISSENT, SearchPlay.Adviser)
        expect(s.pendingQuestions).toBeUndefined()
    })

    it('before revision 18 the Nomad bank pays unasked, as recorded', () => {
        const s = dissentTable(BEFORE)
        playDrawnCard(s, DISSENT, SearchPlay.Adviser)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.favorBank[Suit.Nomad]).toBe(1)
    })

    it('from a When Played the question holds the Search for the holder, then resumes it', () => {
        const game = testGame(['ruler', 'other', 'away'])
        const testEngine = new OathTestEngine(OathRuntime)
        const hydrated = dissentTable(NOW)
        hydrated.getPlayerState('ruler').handIds = [DISSENT, FILLER]
        let state = hydrated.dehydrate()
        state.machineState = MachineState.Searching
        state.turnManager = { series: [{ type: 'turn', playerId: 'ruler', start: 0 }], turnOrder: ['ruler', 'other', 'away'], turnCounts: { ruler: 1, other: 0, away: 0 } }
        state.activePlayerIds = ['ruler']
        state = testEngine.runNext(
            buildAction(SearchResolve, { playerId: 'ruler', keptCardId: DISSENT, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true }),
            state,
            game
        ).updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual(['other'])
        state = testEngine.runNext(buildAction(AnswerQuestion, { playerId: 'other', answer: pay(0) }), state, game).updatedState
        expect(state.machineState).not.toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual(['ruler'])
        expect(state.favorBank[Suit.Nomad]).toBe(3)
    })
})
