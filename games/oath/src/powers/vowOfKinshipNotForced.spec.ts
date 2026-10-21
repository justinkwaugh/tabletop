import { describe, expect, it } from 'vitest'
import { ActionSource, Color, assertExists, latestPlayerUndoTarget, type GameAction } from '@tabletop/common'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { Banner, PlayerStatus, SearchPlay, Suit } from '../model/oathEnums.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedResolveWake, ResolveWake, requiredFavorSteps, type WakeFavorStep } from '../actions/resolveWake.js'
import { HydratedAnswerQuestion, AnswerQuestion } from '../actions/answerQuestion.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { HydratedSearch, Search, SearchSource } from '../actions/search.js'
import { HydratedSearchResolve, SearchResolve } from '../actions/searchResolve.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { availablePeoplesFavorOptions, forcedPeoplesFavorOptions, peoplesFavorStepIsOptional } from '../util/wake.js'
import { currentQuestion } from '../util/questions.js'
import { sitesRuledBy } from '../util/rule.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { CURRENT_OATH_REVISION, OathRevision } from '../util/revision.js'
import { isInPlay } from '../util/discard.js'
import { returnFavorFromCards } from '../util/rest.js'
import { testBanners, testPlayer, testState, openTurn } from '../testing/fixture.js'
import { rulerTable, adviser } from '../testing/tables.js'
import { actionPowerUse, modifierUse } from '../testing/choices.js'
import { answerQuestion, playDrawnCard } from '../testing/steps.js'
import { buildAction } from '../testing/actions.js'
import { engine, OathTestEngine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { expectFavorConserved, favorCensus } from '../testing/census.js'
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

describe('Dissent discarded by the second card of Land Warden before the Vow of Kinship holder pays (revision 18)', () => {
    const LAND_WARDEN = 'denizen.hearth.land-warden'
    const SALT = 'denizen.discord.salt-the-earth'
    const RIOTS = 'denizen.discord.riots'
    const RHYS = 'rhys'

    /** Dana holds Land Warden and Searches; Rhys holds the Vow and Wolves (owes two suits) with `board` favor; Bea is Chancellor with the People's Favor. */
    function landWardenTable(revision: OathRevision, { board = 0, second = SALT }: { board?: number; second?: string } = {}) {
        const s = testState(
            [
                testPlayer({ playerId: DANA, color: Color.Red, siteId: 'c1', favor: 3, secrets: 2, supply: 6, advisers: [adviser(LAND_WARDEN)] }),
                testPlayer({ playerId: RHYS, color: Color.Blue, siteId: 'c2', favor: board, secrets: 1, advisers: [adviser(VOW), adviser(WOLVES)] }),
                testPlayer({ playerId: BEA, color: Color.Purple, siteId: 'h3', status: PlayerStatus.Chancellor, warbandsInPersonalBank: {} })
            ],
            {
                oathRevision: revision,
                banners: testBanners({ [Banner.PeoplesFavor]: BEA }),
                denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
                siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' }
            }
        )
        s.favorBank[Suit.Nomad] = 3
        // Rhys's board favor comes from the Order bank, so the table still holds 40.
        s.favorBank[Suit.Order] -= board
        // Riots discards the most common suit on the map only from its Mob side.
        if (second === RIOTS) s.banners[Banner.PeoplesFavor].mobSide = true
        openTurn(s, DANA)
        s.requireVault().worldDeck = [DISSENT, second, FILLER]
        expectTableFavor(s)
        return s
    }
    /** R-1.4 — the table holds 40 favor before and after every step. */
    const expectTableFavor = (s: HydratedOathGameState) => expect(favorCensus(s)).toBe(40)
    const search = () => buildAction(Search, { playerId: DANA, drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers: [modifierUse(LAND_WARDEN)] })
    const resolveBody = (second = SALT) => ({
        playerId: DANA,
        keptCardId: DISSENT,
        discardOrder: [FILLER],
        play: SearchPlay.Site,
        secondPlay: second === RIOTS ? { cardId: RIOTS, play: SearchPlay.Adviser, faceUp: true } : { cardId: SALT, play: SearchPlay.Site }
    })
    /** Both plays resolve in one Search: the second has discarded Dissent and the question is still open. */
    function bothPlayed(revision: OathRevision, options: { board?: number; second?: string } = {}) {
        const s = landWardenTable(revision, options)
        new HydratedSearch(search()).apply(s)
        const body = resolveBody(options.second)
        expect(HydratedSearchResolve.reasonCannotResolve(s, DANA, body)).toBeUndefined()
        new HydratedSearchResolve(buildAction(SearchResolve, body)).apply(s)
        expect(isInPlay(s, DISSENT)).toBe(false)
        return s
    }

    it.each([NOW, CURRENT_OATH_REVISION])(
        "Salt the Earth second (revision %i): the holder's favor goes to the Discord bank, none on the discarded card (R-10.5)",
        (revision) => {
            const s = bothPlayed(revision)
            expect(currentQuestion(s)).toEqual({ kind: PowerQuestionKind.PayFromHomeBank, cardId: DISSENT, askedPlayerId: RHYS, owed: 2 })
            expect(s.denizensBySite['c1']).toEqual([SALT])
            expect(s.tokensOn(DISSENT).favor).toBe(0)
            const discord = s.favorBank[Suit.Discord]
            const answered = answerQuestion(s, RHYS, pay(2))
            expect(answered.metadata?.summary).toBe('paid 2 favor from the nomad bank into the discord bank')
            expect(s.favorBank[Suit.Nomad]).toBe(1)
            expect(s.favorBank[Suit.Discord]).toBe(discord + 2)
            // Drawn and played again before the Rest, it arrives with no favor on it.
            expect(s.cardTokens[DISSENT]).toBeUndefined()
            expectTableFavor(s)
            // The Rest has nothing left on Dissent to move: only the favor Land Warden's use put on it goes back.
            expect(s.cardTokens).toEqual({ [LAND_WARDEN]: { favor: 1, secrets: 0 } })
            expect(returnFavorFromCards(s)).toBe(1)
            expect(s.favorBank[Suit.Discord]).toBe(discord + 2)
        }
    )

    it('Riots second (Mob side): the same favor goes to the Discord bank, none on the discarded card', () => {
        const s = bothPlayed(NOW, { second: RIOTS })
        expect(s.denizensBySite['c1']).toEqual([])
        expect(currentQuestion(s)).toMatchObject({ kind: PowerQuestionKind.PayFromHomeBank, cardId: DISSENT, askedPlayerId: RHYS, owed: 2 })
        const discord = s.favorBank[Suit.Discord]
        const answered = answerQuestion(s, RHYS, pay(2))
        expect(answered.metadata?.summary).toBe('paid 2 favor from the nomad bank into the discord bank')
        expect(s.tokensOn(DISSENT).favor).toBe(0)
        expect(s.favorBank[Suit.Discord]).toBe(discord + 2)
        expectTableFavor(s)
    })

    it("the board's favor went onto Dissent and left with the discard; only the bank's share is asked about", () => {
        const none = bothPlayed(NOW)
        const s = bothPlayed(NOW, { board: 1 })
        expect(s.getPlayerState(RHYS).favor).toBe(0)
        expect(currentQuestion(s)).toMatchObject({ askedPlayerId: RHYS, owed: 1 })
        expect(s.tokensOn(DISSENT).favor).toBe(0)
        expect(s.favorBank[Suit.Discord]).toBe(none.favorBank[Suit.Discord] + 1)
        const discord = s.favorBank[Suit.Discord]
        answerQuestion(s, RHYS, pay(1))
        expect(s.favorBank[Suit.Discord]).toBe(discord + 1)
        expect(s.cardTokens[DISSENT]).toBeUndefined()
        expectTableFavor(s)
    })

    it('declining to pay from the Nomad bank moves nothing', () => {
        const s = bothPlayed(NOW)
        const banks = { ...s.favorBank }
        const answered = answerQuestion(s, RHYS, pay(0))
        expect(answered.metadata?.summary).toBe('paid no favor')
        expect(s.favorBank).toEqual(banks)
        expect(s.cardTokens[DISSENT]).toBeUndefined()
        expectTableFavor(s)
    })

    const game = testGame([DANA, RHYS, BEA])
    function searching(): OathProjectedState {
        const h = landWardenTable(NOW)
        new HydratedSearch(search()).apply(h)
        const state = h.dehydrate()
        state.machineState = MachineState.Searching
        state.turnManager = { series: [{ type: 'turn', playerId: DANA, start: 0 }], turnOrder: [DANA, RHYS, BEA], turnCounts: { dana: 1, rhys: 0, bea: 0 } }
        state.activePlayerIds = [DANA]
        return state
    }

    it('through the engine: the question waits on the holder after both plays; the answer pays the Discord bank and gives the turn back', () => {
        const testEngine = new OathTestEngine(OathRuntime)
        let state = testEngine.runNext(buildAction(SearchResolve, resolveBody()), searching(), game).updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual([RHYS])
        expect(state.denizensBySite['c1']).toEqual([SALT])
        const discord = state.favorBank[Suit.Discord]

        // Safe on a player's view: the question's domain on the holder's own served state matches the host's.
        const own = new HydratedOathGameState(served(state, { kind: 'player', playerId: RHYS }))
        const host = new HydratedOathGameState(state)
        for (const favor of [0, 1, 2, 3]) {
            expect(HydratedAnswerQuestion.reasonCannotAnswer(own, RHYS, pay(favor))).toEqual(HydratedAnswerQuestion.reasonCannotAnswer(host, RHYS, pay(favor)))
        }

        state = testEngine.runNext(buildAction(AnswerQuestion, { playerId: RHYS, answer: pay(2) }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual([DANA])
        expect(state.favorBank[Suit.Discord]).toBe(discord + 2)
        expect(state.cardTokens[DISSENT]).toBeUndefined()
        expectTableFavor(new HydratedOathGameState(state))
    })

    it('Undo of the answer after the discard takes the favor back out of the Discord bank and reopens the question', () => {
        let seq = 0
        const run = (state: OathProjectedState, fields: { type: ActionType; playerId: string } & Record<string, unknown>) =>
            engine.run({ id: `k-${(seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index: state.actionCount, ...fields } as GameAction, state, game)
        const history: GameAction[] = []
        const resolved = run(searching(), { type: ActionType.SearchResolve, ...resolveBody() })
        history.push(...resolved.processedActions)
        const asked = resolved.updatedState
        const answered = run(asked, { type: ActionType.AnswerQuestion, playerId: RHYS, answer: pay(2) })
        history.push(...answered.processedActions)
        expect(answered.updatedState.favorBank[Suit.Discord]).toBe(asked.favorBank[Suit.Discord] + 2)

        const target = latestPlayerUndoTarget(history, RHYS)
        assertExists(target, 'Undo is offered to Rhys')
        expect(target.type).toBe(ActionType.AnswerQuestion)
        let back = answered.updatedState
        for (const action of history.slice(history.indexOf(target)).toReversed()) back = engine.undoProcessedAction({ state: back, action })
        expect(back).toEqual(asked)
    })

    it('before revision 18 the Nomad bank pays unasked inside the play, so its favor reaches the Discord bank with the discard', () => {
        const s = bothPlayed(BEFORE)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.favorBank[Suit.Nomad]).toBe(1)
        expect(s.cardTokens[DISSENT]).toBeUndefined()
        expectTableFavor(s)
    })
})
