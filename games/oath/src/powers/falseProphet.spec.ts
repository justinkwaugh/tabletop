import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedAnswerQuestion, AnswerQuestion } from '../actions/answerQuestion.js'
import { type OfferCitizenship } from '../actions/offerCitizenship.js'
import { type ResolveCitizenshipOffer } from '../actions/resolveCitizenshipOffer.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { OathRuntime } from '../definition/runtime.js'
import { OathTestEngine } from '../testing/engine.js'
import { Banner, PlayerStatus, Region } from '../model/oathEnums.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import { testBanners, testPlayer, testState, testVaultWithRelics, openTurn } from '../testing/fixture.js'
import { legalChoices, type PowerChoice } from '../util/powerChoice.js'
import { becomeCitizen } from '../util/citizenship.js'
import { meetsRevealedVisionGoal, revealedVisionIdsOf } from '../util/oathkeeper.js'
import { warExhaustionWinner, wakePhaseWin } from '../util/victory.js'
import { expectWarbandsConserved } from '../testing/census.js'
import { hasEffect } from './registry.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { testGame } from '../testing/game.js'
import { card } from '../testing/choices.js'
import { answerQuestion } from '../testing/steps.js'
import { FILLER } from '../testing/cards.js'

/** R-7.2.2 — the card is locked, so the "it" that is discarded is the Vision. */
const PROPHET = 'denizen.discord.false-prophet'
const FAITH = 'vision.faith'
const CONQUEST = 'vision.conquest'
const REBELLION = 'vision.rebellion'

const ME = 'me'
const FOE = 'foe'
const CHAN = 'chan'
const RED: Color = Color.Red
const BLUE: Color = Color.Blue

const POWER = powersWithTiming(PROPHET, PowerTiming.WhenPlayed)[0]

/** R-3.2 — three Visions have been drawn. */
function board(over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}, turn = ME) {
    const s = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', favor: 4, secrets: 2, supply: 6, handIds: [PROPHET], warbandsOnBoard: { [RED]: 2 }, warbandsInPersonalBank: { [RED]: 6 }, ...over[ME] }),
            testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'p1', favor: 4, secrets: 2, supply: 6, revealedVisionId: FAITH, warbandsOnBoard: { [BLUE]: 2 }, warbandsInPersonalBank: { [BLUE]: 6 }, ...over[FOE] }),
            testPlayer({ playerId: CHAN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 4, secrets: 2, supply: 6, warbandsOnBoard: { purple: 3 }, warbandsInPersonalBank: { purple: 8 }, ...over[CHAN] })
        ],
        { chancellorPlayerId: CHAN, visionsDrawn: 3, machineState: MachineState.Searching, ...state }
    )
    openTurn(s, turn)
    s.activePlayerIds = [turn]
    return s
}
type Board = ReturnType<typeof board>

const playIt = (choices?: PowerChoice[]) => ({ keptCardId: PROPHET, discardOrder: [], play: SearchPlay.Adviser, faceUp: true, choices })
function play(s: Board, choices?: PowerChoice[]) {
    const action = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: ME, ...playIt(choices) }))
    action.apply(s)
    return action
}
function prophesied(over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}, turn = FOE) {
    return board(
        { ...over, [ME]: { handIds: [], advisers: [{ cardId: PROPHET, faceUp: true }], warbandsInPersonalBank: { [RED]: 5 }, ...over[ME] } },
        { warbandsOnCards: { [FAITH]: { [RED]: 1 } }, ...state },
        turn
    )
}
function revealAnother(s: Board, cardId: string) {
    s.getPlayerState(FOE).setHand([cardId])
    const action = new HydratedSearchResolve(buildAction(SearchResolve, { playerId: FOE, keptCardId: cardId, discardOrder: [], play: SearchPlay.RevealedVision }))
    action.apply(s)
    return action
}
const playTo = (to: SearchPlay, discardedAdviserCardId?: string): QuestionAnswer => ({ kind: PowerQuestionKind.PlayOrDiscardVision, play: to, discardedAdviserCardId })

describe('False Prophet — registered', () => {
    it('its When Played power has an effect', () => {
        expect(hasEffect(POWER)).toBe(true)
    })
})

describe('False Prophet — "When played, if you\'re an Exile, gain one warband and put it on any revealed Vision"', () => {
    it('gain one warband and put it on the Vision named: out of the personal bank (R-10.10), onto the card, for no cost', () => {
        const s = board()
        let whenPlayed: string | undefined
        expectWarbandsConserved(s, () => {
            whenPlayed = play(s, [card(FAITH)]).metadata?.whenPlayed
        })
        expect(s.warbandsOnCard(FAITH)).toEqual({ [RED]: 1 })
        expect(s.getPlayerState(ME).warbandsInPersonalBank[RED]).toBe(5)
        expect(s.getPlayerState(ME).warbandsOnBoard[RED]).toBe(2)
        expect(s.getPlayerState(ME)).toMatchObject({ favor: 4, secrets: 2 })
        expect(s.getPlayerState(ME).advisers).toEqual([{ cardId: PROPHET, faceUp: true }])
        expect(whenPlayed).toBe(`False Prophet: gained a warband and put it on ${FAITH}, which me now also has revealed`)
        expect(s.getPlayerState(FOE).revealedVisionId).toBe(FAITH)
    })

    it('any revealed Vision: every player’s, the player’s own among them; one nobody has revealed is refused', () => {
        const s = board({ [ME]: { revealedVisionId: CONQUEST } })
        expect(legalChoices(s, ME, POWER)[0].options).toEqual([card(CONQUEST), card(FAITH)])
        expect(HydratedSearchResolve.reasonCannotResolve(s, ME, playIt([card(REBELLION)]))).toMatch(/vision.rebellion is not among the options for a revealed Vision/)
        expect(HydratedSearchResolve.reasonCannotResolve(s, ME, playIt([card(FAITH), card(CONQUEST)]))).toMatch(/at most 1/)
        play(s, [card(CONQUEST)])
        expect(s.warbandsOnCard(CONQUEST)).toEqual({ [RED]: 1 })
    })

    it('a required pick missing is refused: the text has no "may" (R-7.1.3)', () => {
        expect(HydratedSearchResolve.reasonCannotResolve(board(), ME, playIt())).toBe('choose the revealed Vision the warband goes on')
        expect(HydratedSearchResolve.reasonCannotResolve(board(), ME, playIt([card(FAITH)]))).toBeUndefined()
    })

    it('with no Vision revealed, the gained warband returns to the bank, so nothing changes', () => {
        const s = board({ [FOE]: { revealedVisionId: undefined } })
        const bank = s.getPlayerState(ME).warbandsInPersonalBank[RED]
        expect(legalChoices(s, ME, POWER)[0].options).toEqual([])
        expectWarbandsConserved(s, () => play(s))
        expect(s.getPlayerState(ME).warbandsOnBoard[RED]).toBe(2)
        expect(s.getPlayerState(ME).warbandsInPersonalBank[RED]).toBe(bank)
        expect(s.warbandsOnCards ?? {}).toEqual({})
    })

    it('with an empty bank nothing is gained (R-9.3), so no warband marks a Vision and none need be named', () => {
        const s = board({ [ME]: { warbandsInPersonalBank: { [RED]: 0 } } })
        expect(HydratedSearchResolve.reasonCannotResolve(s, ME, playIt())).toBeUndefined()
        play(s, [card(FAITH)])
        expect(s.warbandsOnCard(FAITH)).toEqual({})
        expect(revealedVisionIdsOf(s, ME)).toEqual([])
    })

    it('a Citizen who plays it gains nothing, and is offered no Vision', () => {
        const s = board({ [ME]: { status: PlayerStatus.Citizen } })
        expect(legalChoices(s, ME, POWER)[0].options).toEqual([])
        expect(HydratedSearchResolve.reasonCannotResolve(s, ME, playIt([card(FAITH)]))).toMatch(/not among the options/)
        const whenPlayed = play(s).metadata?.whenPlayed
        expect(whenPlayed).toBe('False Prophet: a citizen gains nothing from it')
        expect(s.getPlayerState(ME).warbandsInPersonalBank[RED]).toBe(6)
        expect(s.getPlayerState(ME).advisers).toEqual([{ cardId: PROPHET, faceUp: true }])
        expect(s.warbandsOnCards ?? {}).toEqual({})
    })

    it('played facedown it does nothing (R-7.3.3)', () => {
        const s = board()
        new HydratedSearchResolve(buildAction(SearchResolve, { playerId: ME, keptCardId: PROPHET, discardOrder: [], play: SearchPlay.Adviser, faceUp: false })).apply(s)
        expect(s.warbandsOnCards ?? {}).toEqual({})
        expect(s.getPlayerState(ME).warbandsInPersonalBank[RED]).toBe(6)
    })
})

describe('False Prophet — "You now also have it revealed"', () => {
    it('you now also have it revealed: meeting its goal wins at the Wake (R-3.2), and its holder keeps it too', () => {
        const s = prophesied({}, { banners: testBanners({ [Banner.DarkestSecret]: ME }) })
        expect(revealedVisionIdsOf(s, ME)).toEqual([FAITH])
        expect(revealedVisionIdsOf(s, FOE)).toEqual([FAITH])
        expect(wakePhaseWin(s, ME)).toMatchObject({ winnerPlayerId: ME, rule: 'R-3.2' })
        expect(wakePhaseWin(s, FOE)).toBeUndefined()
        const t = prophesied({}, { banners: testBanners({ [Banner.DarkestSecret]: FOE }) })
        expect(wakePhaseWin(t, FOE)).toMatchObject({ winnerPlayerId: FOE, rule: 'R-3.2' })
        expect(wakePhaseWin(t, ME)).toBeUndefined()
    })

    it('you now also have it revealed: beside a Vision of their own (R-2.2.1), either goal met is a win', () => {
        const s = prophesied({ [ME]: { revealedVisionId: CONQUEST } }, { banners: testBanners({ [Banner.DarkestSecret]: ME }) })
        expect(revealedVisionIdsOf(s, ME)).toEqual([CONQUEST, FAITH])
        expect(meetsRevealedVisionGoal(s, ME)).toBe(true)
    })

    it('only the player whose warband it is has it revealed', () => {
        const s = prophesied()
        expect(revealedVisionIdsOf(s, CHAN)).toEqual([])
        expect(revealedVisionIdsOf(board(), ME)).toEqual([])
    })

    it('R-3.4.3 ranks a Visionary by the Vision they met, the one they share included', () => {
        const s = prophesied({}, { banners: testBanners({ [Banner.DarkestSecret]: ME }) })
        expect(warExhaustionWinner(s)).toMatchObject({ winnerPlayerId: ME, rule: 'R-3.4.3' })
        // foe meets Rebellion and me the Faith a third Exile holds; Rebellion outranks Faith.
        const t = prophesied(
            {
                [FOE]: { revealedVisionId: REBELLION },
                [CHAN]: { status: PlayerStatus.Exile, color: Color.Yellow, revealedVisionId: FAITH, warbandsOnBoard: {}, warbandsInPersonalBank: {} }
            },
            { chancellorPlayerId: undefined, banners: testBanners({ [Banner.PeoplesFavor]: FOE, [Banner.DarkestSecret]: ME }) }
        )
        expect(meetsRevealedVisionGoal(t, ME)).toBe(true)
        expect(warExhaustionWinner(t)).toMatchObject({ winnerPlayerId: FOE, rule: 'R-3.4.3' })
    })

    it('a Citizen keeps it revealed but cannot win by it until an Exile again (R-3.2)', () => {
        const s = prophesied({ [ME]: { status: PlayerStatus.Citizen } }, { banners: testBanners({ [Banner.DarkestSecret]: ME }) })
        expect(revealedVisionIdsOf(s, ME)).toEqual([FAITH])
        expect(wakePhaseWin(s, ME)).toBeUndefined()
        s.getPlayerState(ME).status = PlayerStatus.Exile
        expect(wakePhaseWin(s, ME)).toMatchObject({ rule: 'R-3.2' })
    })
})

describe('False Prophet — "If it is ever discarded, kill the warband and play or discard the Vision as if you had searched"', () => {
    it('if it is ever discarded by a new Vision (R-5.1.4.III): kill the warband, and the Vision is kept out of the pile for its False Prophet to answer for', () => {
        const s = prophesied()
        let resolve: HydratedSearchResolve | undefined
        expectWarbandsConserved(s, () => {
            resolve = revealAnother(s, REBELLION)
        })
        expect(s.getPlayerState(FOE).revealedVisionId).toBe(REBELLION)
        // R-10.13 — a killed warband goes back to its player's bank.
        expect(s.warbandsOnCard(FAITH)).toEqual({ [RED]: 0 })
        expect(s.getPlayerState(ME).warbandsInPersonalBank[RED]).toBe(6)
        expect(resolve?.metadata?.discardedCardIds).toEqual([])
        expect(s.discardPileCounts).toEqual({ [Region.Cradle]: 0, [Region.Provinces]: 0, [Region.Hinterland]: 0 })
        expect(s.pendingQuestions?.queue).toEqual([{ kind: PowerQuestionKind.PlayOrDiscardVision, cardId: PROPHET, askedPlayerId: ME, visionCardId: FAITH }])
        expect(revealedVisionIdsOf(s, ME)).toEqual([])
    })

    it('if it is ever discarded by Citizenship (R-6.6.2): the same, and the conversion reports no discard for the vault', () => {
        const s = prophesied()
        const conversion = becomeCitizen(s, FOE)
        expect(conversion.discardedVisionId).toBeUndefined()
        expect(conversion.discardPileRegion).toBeUndefined()
        expect(s.getPlayerState(FOE).revealedVisionId).toBeUndefined()
        expect(s.getPlayerState(ME).warbandsInPersonalBank[RED]).toBe(6)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.PlayOrDiscardVision, askedPlayerId: ME, visionCardId: FAITH })
    })

    it('a Vision with no warband on it is discarded as ever, and nobody is asked', () => {
        const s = board({ [ME]: { handIds: [] } }, {}, FOE)
        const resolve = revealAnother(s, REBELLION)
        expect(resolve.metadata?.discardedCardIds).toEqual([FAITH])
        expect(s.discardPileCounts[Region.Hinterland]).toBe(1)
        expect(s.pendingQuestions).toBeUndefined()
        const t = board({ [ME]: { handIds: [] } }, {}, FOE)
        expect(becomeCitizen(t, FOE)).toMatchObject({ discardedVisionId: FAITH, discardPileRegion: Region.Hinterland })
    })

    it('play … the Vision: faceup to their own Revealed Vision space, discarding the Vision already there (R-5.1.4.III)', () => {
        const s = prophesied({ [ME]: { revealedVisionId: CONQUEST } })
        revealAnother(s, REBELLION)
        const reply = answerQuestion(s, ME, playTo(SearchPlay.RevealedVision))
        expect(s.getPlayerState(ME).revealedVisionId).toBe(FAITH)
        expect(s.pendingQuestions?.queue).toEqual([])
        // R-10.5 — me stands in the Cradle, so the old Vision goes to the Provinces pile.
        expect(reply.metadata).toMatchObject({ discardedCardIds: [CONQUEST], discardPileRegion: Region.Provinces, summary: `played ${FAITH} (revealedVision)` })
        expect(s.discardPileCounts[Region.Provinces]).toBe(1)
        expect(reply.revealsInfo).toBe(true)
    })

    it('play … the Vision: or facedown as an adviser, under the adviser limit (R-5.1.4.II)', () => {
        const s = prophesied()
        revealAnother(s, REBELLION)
        answerQuestion(s, ME, playTo(SearchPlay.Adviser))
        expect(s.getPlayerState(ME).knownAdvisers()).toEqual([{ cardId: PROPHET, faceUp: true }, { cardId: FAITH, faceUp: false }])
        const full = prophesied({ [ME]: { handIds: [], advisers: [{ cardId: PROPHET, faceUp: true }, { cardId: FILLER, faceUp: true }, { cardId: 'denizen.hearth.wayside-inn', faceUp: true }] } })
        revealAnother(full, REBELLION)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(full, ME, playTo(SearchPlay.Adviser))).toMatch(/already at the adviser limit of 3/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(full, ME, playTo(SearchPlay.Adviser, PROPHET))).toMatch(/is locked and cannot be discarded/)
        answerQuestion(full, ME, playTo(SearchPlay.Adviser, FILLER))
        expect(full.getPlayerState(ME).knownAdviserIds()).toEqual([PROPHET, 'denizen.hearth.wayside-inn', FAITH])
    })

    it('… or discard the Vision: to the pile a Search of theirs would discard to (R-10.5)', () => {
        const s = prophesied()
        revealAnother(s, REBELLION)
        const reply = answerQuestion(s, ME, playTo(SearchPlay.Discard))
        expect(reply.metadata).toMatchObject({ discardedCardIds: [FAITH], discardPileRegion: Region.Provinces, summary: `discarded ${FAITH}` })
        expect(s.discardPileCounts[Region.Provinces]).toBe(1)
        expect(s.getPlayerState(ME).revealedVisionId).toBeUndefined()
    })

    it('as if you had searched: the plays a Search refuses are refused, and only the False Prophet’s player answers', () => {
        const s = prophesied()
        revealAnother(s, REBELLION)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, playTo(SearchPlay.Site))).toBe('Visions cannot be played to a site')
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, playTo(SearchPlay.Conspiracy))).toMatch(/is not the Conspiracy/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, FOE, playTo(SearchPlay.Discard))).toMatch(/the question is me's to answer/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, { kind: PowerQuestionKind.KeepOrBottomRelic, keep: true })).toMatch(/the question is playOrDiscardVision/)
        // R-5.1.4.III — a Citizen cannot play a Vision faceup.
        const citizen = prophesied({ [ME]: { status: PlayerStatus.Citizen } })
        revealAnother(citizen, REBELLION)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(citizen, ME, playTo(SearchPlay.RevealedVision))).toMatch(/cannot play a Vision faceup/)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(citizen, ME, playTo(SearchPlay.Discard))).toBeUndefined()
    })

    it('their own Vision under their own warband: discarding it asks them, and playing it back discards the newcomer', () => {
        const s = board({ [ME]: { handIds: [REBELLION], revealedVisionId: CONQUEST, advisers: [{ cardId: PROPHET, faceUp: true }], warbandsInPersonalBank: { [RED]: 5 } } }, { warbandsOnCards: { [CONQUEST]: { [RED]: 1 } } })
        new HydratedSearchResolve(buildAction(SearchResolve, { playerId: ME, keptCardId: REBELLION, discardOrder: [], play: SearchPlay.RevealedVision })).apply(s)
        expect(s.getPlayerState(ME).revealedVisionId).toBe(REBELLION)
        const reply = answerQuestion(s, ME, playTo(SearchPlay.RevealedVision))
        expect(s.getPlayerState(ME).revealedVisionId).toBe(CONQUEST)
        expect(reply.metadata?.discardedCardIds).toEqual([REBELLION])
    })
})

describe('False Prophet — the question is a turn, through the engine', () => {
    const engine = new OathTestEngine(OathRuntime)
    const game = testGame([ME, FOE, CHAN])
    let seq = 0
    const stamp = (index: number) => ({ id: `fp-${(seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index })
    function dehydrated(s: Board, turn: string) {
        const state = s.dehydrate()
        state.turnManager = { series: [{ type: 'turn', playerId: turn, start: 0 }], turnOrder: [ME, FOE, CHAN], turnCounts: { [ME]: 1, [FOE]: 1, [CHAN]: 1 } }
        state.activePlayerIds = [turn]
        return state
    }

    it('R-5.1.4.III through the engine: the Search holds, the False Prophet’s player is put on the clock, and the turn resumes', () => {
        const s = prophesied()
        s.getPlayerState(FOE).setHand([REBELLION])
        let state = dehydrated(s, FOE)
        const reveal: SearchResolve = { ...stamp(state.actionCount), type: ActionType.SearchResolve, playerId: FOE, keptCardId: REBELLION, discardOrder: [], play: SearchPlay.RevealedVision }
        state = engine.run(reveal, state, game).updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual([ME])
        expect(engine.getValidActionTypesForPlayer(game, state, ME)).toContain(ActionType.AnswerQuestion)
        expect(engine.getValidActionTypesForPlayer(game, state, FOE)).not.toContain(ActionType.AnswerQuestion)
        const reply: AnswerQuestion = { ...stamp(state.actionCount), type: ActionType.AnswerQuestion, playerId: ME, answer: playTo(SearchPlay.RevealedVision) }
        state = engine.run(reply, state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual([FOE])
        expect(state.players[0].revealedVisionId).toBe(FAITH)
        expect(state.pendingQuestions).toBeUndefined()
    })

    it('R-6.6.2 through the engine: a Citizenship accepted asks the False Prophet’s player before the offerer’s turn resumes', () => {
        const s = prophesied({ [CHAN]: { relicIds: ['relic.grand-scepter'], siteId: 'p1' } }, { machineState: MachineState.ActPhase, reliquary: [{ slotId: 'reliquary.0' }], vault: testVaultWithRelics({ 'reliquary.0': 'relic.cup' }) }, CHAN)
        let state = dehydrated(s, CHAN)
        const offer: OfferCitizenship = { ...stamp(state.actionCount), type: ActionType.OfferCitizenship, playerId: CHAN, exilePlayerId: FOE, reliquarySlotId: 'reliquary.0' }
        state = engine.run(offer, state, game).updatedState
        expect(state.machineState).toBe(MachineState.ConsentRequest)
        const accept: ResolveCitizenshipOffer = { ...stamp(state.actionCount), type: ActionType.ResolveCitizenshipOffer, playerId: FOE, granted: true }
        state = engine.run(accept, state, game).updatedState
        expect(state.players[1].status).toBe(PlayerStatus.Citizen)
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual([ME])
        const reply: AnswerQuestion = { ...stamp(state.actionCount), type: ActionType.AnswerQuestion, playerId: ME, answer: playTo(SearchPlay.Discard) }
        state = engine.run(reply, state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual([CHAN])
        expect(state.discardPileCounts[Region.Provinces]).toBe(1)
    })
})
