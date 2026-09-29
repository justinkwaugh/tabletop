import { OathTestEngine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { describe, expect, it } from 'vitest'
import { OathGameStateValidator } from '../model/gameState.js'
import { Color, assert } from '@tabletop/common'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { AnswerQuestion, HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { OathRuntime } from '../definition/runtime.js'
import { Suit, PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind, type ExchangeTerms } from '../model/question.js'
import { choiceSpecsFor, exchangeAllowanceOf, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { cardPowers, PowerTiming, TRIBUNAL_ID, powerIndexOf } from '../data/cardPowers.js'
import { afterCampaignPersistent } from '../util/persistent.js'
import { settleQueue } from '../util/questions.js'
import { DEED_WRITER_ALLOWS, TINKERS_FAIR_ALLOWS } from '../util/exchange.js'
import { warbandsAt } from '../util/rule.js'
import '../powers/index.js'
import { actionPowerUse, card } from '../testing/choices.js'
import { testGame } from '../testing/game.js'
import { rulerTable } from '../testing/tables.js'
import { playDrawnCard, answerQuestion } from '../testing/steps.js'
import { TENTS, FILLER } from '../testing/cards.js'

const REVELATION = 'denizen.arcane.revelation'
const BLACKMAIL = 'denizen.discord.blackmail'
const HERALD = 'denizen.hearth.herald'
const BOOK_BINDERS = 'denizen.hearth.book-binders'
const TINKERS_FAIR = 'denizen.hearth.tinkers-fair'
const DEED_WRITER = 'denizen.hearth.deed-writer'
const GATHERING = 'denizen.nomad.the-gathering'
const CUP = 'relic.cup'

const exchange = (withPlayerId: string, terms: ExchangeTerms): PowerChoice => ({ kind: PowerChoiceKind.Exchange, withPlayerId, terms })

const head = (s: ReturnType<typeof rulerTable>) => s.pendingQuestions?.queue[0]

describe('Revelation — a round of burns in turn order', () => {
    it('asks every player who has favor, from the player of the card round the table', () => {
        const s = rulerTable([])
        playDrawnCard(s, REVELATION, SearchPlay.Adviser)
        expect(s.pendingQuestions?.queue.map((q) => q.askedPlayerId)).toEqual(['ruler', 'other', 'away'])
        expect(head(s)?.kind).toBe(PowerQuestionKind.BurnFavorForSecrets)
    })

    it('a player with no favor is not asked — there is nothing to decide', () => {
        const s = rulerTable([], [], { other: { favor: 0 } })
        const a = playDrawnCard(s, REVELATION, SearchPlay.Adviser)
        expect(s.pendingQuestions?.queue.map((q) => q.askedPlayerId)).toEqual(['ruler', 'away'])
        expect(a.metadata?.whenPlayed).toMatch(/other has no favor/)
    })

    it('burning moves favor to the supply and mints the same number of secrets; more than held is refused', () => {
        const s = rulerTable([])
        playDrawnCard(s, REVELATION, SearchPlay.Adviser)
        const supply = s.favorSupply
        expect(() => answerQuestion(s, 'ruler', { kind: PowerQuestionKind.BurnFavorForSecrets, favor: 4 })).toThrow(/have 3 favor/)
        expect(() => answerQuestion(s, 'other', { kind: PowerQuestionKind.BurnFavorForSecrets, favor: 1 })).toThrow(/ruler's to answer/)
        expect(() => answerQuestion(s, 'ruler', { kind: PowerQuestionKind.JoinSite, join: true })).toThrow(/not joinSite/)
        const a = answerQuestion(s, 'ruler', { kind: PowerQuestionKind.BurnFavorForSecrets, favor: 2 })
        expect(s.getPlayerState('ruler').favor).toBe(1)
        expect(s.getPlayerState('ruler').secrets).toBe(5)
        expect(s.favorSupply).toBe(supply + 2)
        expect(a.metadata?.summary).toBe('burned 2 favor for 2 secrets')
        expect(a.revealsInfo).toBe(false)
        expect(head(s)?.askedPlayerId).toBe('other')
        answerQuestion(s, 'other', { kind: PowerQuestionKind.BurnFavorForSecrets, favor: 0 })
        answerQuestion(s, 'away', { kind: PowerQuestionKind.BurnFavorForSecrets, favor: 1 })
        expect(settleQueue(s)).toBe(true)
    })
})

describe('Blackmail — pay or lose the relic', () => {
    it('asks the holder when they can pay; paying keeps the relic and the favor changes hands', () => {
        const s = rulerTable([], [], { other: { relicIds: [CUP], favor: 3 } })
        playDrawnCard(s, BLACKMAIL, SearchPlay.Adviser, [card(CUP)])
        expect(head(s)).toMatchObject({ kind: PowerQuestionKind.PayOrLoseRelic, askedPlayerId: 'other', takerPlayerId: 'ruler', relicCardId: CUP, price: 3 })
        answerQuestion(s, 'other', { kind: PowerQuestionKind.PayOrLoseRelic, pay: true })
        expect(s.getPlayerState('other').favor).toBe(0)
        expect(s.getPlayerState('ruler').favor).toBe(6)
        expect(s.getPlayerState('other').relicIds).toEqual([CUP])
    })

    it('refusing hands the relic over', () => {
        const s = rulerTable([], [], { other: { relicIds: [CUP], favor: 3 } })
        playDrawnCard(s, BLACKMAIL, SearchPlay.Adviser, [card(CUP)])
        answerQuestion(s, 'other', { kind: PowerQuestionKind.PayOrLoseRelic, pay: false })
        expect(s.getPlayerState('other').relicIds).toEqual([])
        expect(s.getPlayerState('ruler').relicIds).toContain(CUP)
    })

    it('a holder who cannot pay is not asked: the relic is simply taken', () => {
        const s = rulerTable([], [], { other: { relicIds: [CUP], favor: 2 } })
        const a = playDrawnCard(s, BLACKMAIL, SearchPlay.Adviser, [card(CUP)])
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.getPlayerState('ruler').relicIds).toContain(CUP)
        expect(a.metadata?.whenPlayed).toMatch(/could not pay/)
    })

    it('must choose a relic while one is there; a relic held elsewhere is not a target', () => {
        const s = rulerTable([], [], { other: { relicIds: [CUP], favor: 3 } })
        expect(() => playDrawnCard(s, BLACKMAIL, SearchPlay.Adviser)).toThrow(/must choose a relic/)
        const far = rulerTable([], [], { away: { relicIds: [CUP], favor: 3 } })
        expect(() => playDrawnCard(far, BLACKMAIL, SearchPlay.Adviser, [card(CUP)])).toThrow(/not among the options/)
        const none = rulerTable([])
        const a = playDrawnCard(none, BLACKMAIL, SearchPlay.Adviser)
        expect(a.metadata?.whenPlayed).toMatch(/nobody at your site holds a relic/)
    })
})

describe('Herald and Book Binders — a bank pick for a player who is not acting', () => {
    it("Herald asks its holder after another player's Campaign against a player, not against bandits", () => {
        const s = rulerTable([], [], { away: { advisers: [{ cardId: HERALD, faceUp: true }] } })
        expect(afterCampaignPersistent(s, 'ruler', undefined)).toEqual([])
        expect(s.pendingQuestions).toBeUndefined()
        const notes = afterCampaignPersistent(s, 'ruler', 'other')
        expect(notes[0]).toMatch(/Herald: away gains a favor/)
        expect(head(s)).toMatchObject({ kind: PowerQuestionKind.PickFavorBank, askedPlayerId: 'away', amount: 1 })
        expect(() => answerQuestion(s, 'away', { kind: PowerQuestionKind.PickFavorBank, suit: Suit.Beast })).not.toThrow()
        expect(s.getPlayerState('away').favor).toBe(2)
        expect(s.favorBank[Suit.Beast]).toBe(2)
    })

    it("Herald's holder attacking is not 'another player'; one bank with favor is no choice", () => {
        const s = rulerTable([], [HERALD])
        expect(afterCampaignPersistent(s, 'ruler', 'other')).toEqual([])
        const one = rulerTable([], [], { away: { advisers: [{ cardId: HERALD, faceUp: true }] } }, { favorBank: { [Suit.Order]: 2, [Suit.Hearth]: 0, [Suit.Beast]: 0, [Suit.Nomad]: 0, [Suit.Arcane]: 0, [Suit.Discord]: 0 } })
        const notes = afterCampaignPersistent(one, 'ruler', 'other')
        expect(notes[0]).toMatch(/only one with favor/)
        expect(one.pendingQuestions).toBeUndefined()
        expect(one.getPlayerState('away').favor).toBe(2)
        const empty = rulerTable([], [], { away: { advisers: [{ cardId: HERALD, faceUp: true }] } }, { favorBank: { [Suit.Order]: 0, [Suit.Hearth]: 0, [Suit.Beast]: 0, [Suit.Nomad]: 0, [Suit.Arcane]: 0, [Suit.Discord]: 0 } })
        expect(afterCampaignPersistent(empty, 'ruler', 'other')[0]).toMatch(/no favor bank has any/)
    })

    it('Book Binders asks after another player plays a Vision faceup, for two favor from one bank', () => {
        const s = rulerTable([], [], { other: { advisers: [{ cardId: BOOK_BINDERS, faceUp: true }] } })
        const a = playDrawnCard(s, 'vision.conquest', SearchPlay.RevealedVision)
        expect(a.metadata?.triggered?.[0]).toMatch(/Book Binders: other gains 2 favor/)
        expect(head(s)).toMatchObject({ kind: PowerQuestionKind.PickFavorBank, askedPlayerId: 'other', amount: 2 })
        expect(() => answerQuestion(s, 'other', { kind: PowerQuestionKind.PickFavorBank, suit: Suit.Arcane })).not.toThrow()
        expect(s.getPlayerState('other').favor).toBe(4)
        expect(s.favorBank[Suit.Arcane]).toBe(1)
    })
})

describe('R-11.9 — The Tribunal: favor and secrets with any player, by its ruler or whoever stands there', () => {
    it('is in reach at the site, not elsewhere, and asks the other side', () => {
        const s = rulerTable([], [], {}, { siteCards: { c1: TRIBUNAL_ID, c2: 'site.river', p1: 'site.plains', h1: 'site.wastes' } })
        expect(HydratedUseActionPower.legalActionPowers(s, 'ruler').map((p) => p.cardId)).toContain(TRIBUNAL_ID)
        expect(HydratedUseActionPower.reasonCannotUse(s, 'ruler', TRIBUNAL_ID, 0, [exchange('other', { fromProposer: { relicCardIds: [CUP] } })])).toMatch(/cannot include relics/)
        actionPowerUse('ruler', TRIBUNAL_ID, [exchange('other', { fromProposer: { favor: 1 }, fromCounterparty: { secrets: 1 } })]).apply(s)
        expect(head(s)).toMatchObject({ kind: PowerQuestionKind.Exchange, askedPlayerId: 'other', proposerPlayerId: 'ruler' })

        const away = rulerTable([], [], {}, { siteCards: { c1: 'site.plains', c2: 'site.river', p1: TRIBUNAL_ID, h1: 'site.wastes' } })
        expect(HydratedUseActionPower.legalActionPowers(away, 'ruler').map((p) => p.cardId)).not.toContain(TRIBUNAL_ID)
    })
})

describe("Tinker's Fair and Deed Writer — a binding exchange the other side must accept", () => {
    it('each declares the terms its card prints on its Exchange choice, for any caller to read', () => {
        const specOf = (cardId: string) => choiceSpecsFor(cardPowers(cardId)[powerIndexOf(cardId, PowerTiming.Action)])[0]
        expect(exchangeAllowanceOf(specOf(TINKERS_FAIR))).toEqual(TINKERS_FAIR_ALLOWS)
        expect(exchangeAllowanceOf(specOf(DEED_WRITER))).toEqual(DEED_WRITER_ALLOWS)
        expect(() => exchangeAllowanceOf({ kind: PowerChoiceKind.Player, min: 1, max: 1 })).toThrow(/declares no exchange allowance/)
    })

    it("Tinker's Fair: favor, secrets and relics; the counterparty's yes moves both sides at once", () => {
        const s = rulerTable([TINKERS_FAIR], [], { ruler: { relicIds: [CUP] } })
        const a = actionPowerUse('ruler', TINKERS_FAIR, [exchange('other', { fromProposer: { favor: 1, relicCardIds: [CUP] }, fromCounterparty: { secrets: 2 } })])
        a.apply(s)
        expect(a.metadata?.summary).toMatch(/proposed a binding exchange to other/)
        expect(head(s)).toMatchObject({ kind: PowerQuestionKind.Exchange, askedPlayerId: 'other', proposerPlayerId: 'ruler' })
        expect(s.getPlayerState('ruler').relicIds).toEqual([CUP])
        answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })
        expect(s.getPlayerState('ruler')).toMatchObject({ favor: 2, secrets: 5, relicIds: [] })
        expect(s.getPlayerState('other')).toMatchObject({ favor: 3, secrets: 0, relicIds: [CUP] })
    })

    it('refusing moves nothing; terms outside the card or beyond the holdings are refused up front', () => {
        const s = rulerTable([TINKERS_FAIR])
        actionPowerUse('ruler', TINKERS_FAIR, [exchange('other', { fromProposer: { favor: 1 } })]).apply(s)
        answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: false })
        expect(s.getPlayerState('ruler').favor).toBe(3)
        expect(HydratedUseActionPower.reasonCannotUse(rulerTable([TINKERS_FAIR]), 'ruler', TINKERS_FAIR, powerIndexOf(TINKERS_FAIR, PowerTiming.Action), [exchange('other', { fromProposer: { sites: [{ siteId: 'c2', warbands: 1 }] } })])).toMatch(/cannot include sites/)
        expect(HydratedUseActionPower.reasonCannotUse(rulerTable([TINKERS_FAIR]), 'ruler', TINKERS_FAIR, powerIndexOf(TINKERS_FAIR, PowerTiming.Action), [exchange('other', { fromCounterparty: { favor: 5 } })])).toMatch(/promised 5 favor but has 2/)
        expect(HydratedUseActionPower.reasonCannotUse(rulerTable([TINKERS_FAIR]), 'ruler', TINKERS_FAIR, powerIndexOf(TINKERS_FAIR, PowerTiming.Action), [exchange('other', {})])).toMatch(/exchange is empty/)
        expect(HydratedUseActionPower.reasonCannotUse(rulerTable([TINKERS_FAIR]), 'ruler', TINKERS_FAIR, powerIndexOf(TINKERS_FAIR, PowerTiming.Action), [exchange('ruler', { fromProposer: { favor: 1 } })])).toMatch(/not among the options/)
    })

    it('an accepted exchange is re-checked at answer time against what the board now holds', () => {
        const s = rulerTable([TINKERS_FAIR])
        actionPowerUse('ruler', TINKERS_FAIR, [exchange('other', { fromProposer: { favor: 3 } })]).apply(s)
        s.getPlayerState('ruler').favor = 1
        expect(() => answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })).toThrow(/promised 3 favor but has 1/)
    })

    it('Deed Writer: the old ruler pulls every warband off the site and the new ruler moves in their own count', () => {
        const s = rulerTable([DEED_WRITER])
        actionPowerUse('ruler', DEED_WRITER, [exchange('other', { fromProposer: { sites: [{ siteId: 'c2', warbands: 1 }] }, fromCounterparty: { favor: 1 } })]).apply(s)
        answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })
        expect(warbandsAt(s, 'c2')[Color.Blue]).toBe(1)
        expect(warbandsAt(s, 'c2')[Color.Red] ?? 0).toBe(0)
        expect(s.getPlayerState('ruler').warbandsOnBoard[Color.Red]).toBe(6)
        expect(s.getPlayerState('other').warbandsOnBoard[Color.Blue]).toBe(1)
        expect(s.getPlayerState('ruler').favor).toBe(4)
    })

    it('Deed Writer refuses a site the giver does not rule, a move of nothing, and more warbands than the board holds', () => {
        const probe = (terms: ExchangeTerms) => HydratedUseActionPower.reasonCannotUse(rulerTable([DEED_WRITER]), 'ruler', DEED_WRITER, powerIndexOf(DEED_WRITER, PowerTiming.Action), [exchange('other', terms)])
        expect(probe({ fromProposer: { sites: [{ siteId: 'p1', warbands: 1 }] } })).toMatch(/do not rule/)
        expect(probe({ fromProposer: { sites: [{ siteId: 'c2', warbands: 0 }] } })).toMatch(/at least one warband/)
        expect(probe({ fromProposer: { sites: [{ siteId: 'c2', warbands: 3 }] } })).toMatch(/fewer than 3 warbands/)
        expect(probe({ fromProposer: { relicCardIds: [CUP] } })).toMatch(/cannot include relics/)
    })
})

describe('The Gathering — a round of pawns, then a round of proposals', () => {
    it('R-7.6.3-H2 — asks the absent players to come, then gives each present player one proposal in turn order', () => {
        const s = rulerTable([])
        playDrawnCard(s, GATHERING, SearchPlay.Site)
        expect(s.pendingQuestions?.queue.map((q) => [q.kind, q.askedPlayerId])).toEqual([[PowerQuestionKind.JoinSite, 'away']])
        expect(s.pendingQuestions?.followUp?.siteId).toBe('c1')
        answerQuestion(s, 'away', { kind: PowerQuestionKind.JoinSite, join: true })
        expect(s.getPlayerState('away').siteId).toBe('c1')
        expect(settleQueue(s)).toBe(false)
        expect(s.pendingQuestions?.queue.map((q) => [q.kind, q.askedPlayerId])).toEqual([
            [PowerQuestionKind.GatheringFloor, 'ruler'],
            [PowerQuestionKind.GatheringFloor, 'other'],
            [PowerQuestionKind.GatheringFloor, 'away']
        ])
        answerQuestion(s, 'ruler', { kind: PowerQuestionKind.GatheringFloor, proposal: { withPlayerId: 'away', terms: { fromProposer: { favor: 1 }, fromCounterparty: { secrets: 1 } } } })
        expect(head(s)).toMatchObject({ kind: PowerQuestionKind.Exchange, askedPlayerId: 'away', proposerPlayerId: 'ruler' })
        answerQuestion(s, 'away', { kind: PowerQuestionKind.Exchange, accept: true })
        expect(s.getPlayerState('away')).toMatchObject({ favor: 2, secrets: 0 })
        expect(head(s)?.askedPlayerId).toBe('other')
        answerQuestion(s, 'other', { kind: PowerQuestionKind.GatheringFloor })
        answerQuestion(s, 'away', { kind: PowerQuestionKind.GatheringFloor })
        expect(settleQueue(s)).toBe(true)
    })

    it('advisers may change hands; sites may not; the counterparty must be present', () => {
        const s = rulerTable([])
        playDrawnCard(s, GATHERING, SearchPlay.Site)
        answerQuestion(s, 'away', { kind: PowerQuestionKind.JoinSite, join: false })
        settleQueue(s)
        expect(() => answerQuestion(s, 'ruler', { kind: PowerQuestionKind.GatheringFloor, proposal: { withPlayerId: 'away', terms: { fromProposer: { favor: 1 } } } })).toThrow(/not at c1/)
        expect(() => answerQuestion(s, 'ruler', { kind: PowerQuestionKind.GatheringFloor, proposal: { withPlayerId: 'other', terms: { fromProposer: { sites: [{ siteId: 'c2', warbands: 1 }] } } } })).toThrow(/cannot include sites/)
        answerQuestion(s, 'ruler', { kind: PowerQuestionKind.GatheringFloor, proposal: { withPlayerId: 'other', terms: { fromCounterparty: { adviserRows: [0] }, fromProposer: { favor: 1 } } } })
        answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })
        expect(s.getPlayerState('ruler').advisers.map((a) => a.cardId)).toEqual([TENTS])
        expect(s.getPlayerState('other').advisers).toEqual([])
    })

    const WOLVES = 'denizen.beast.wolves'
    const INN = 'denizen.hearth.wayside-inn'
    const spectator = { kind: 'spectator' } as const

    function floorWithFacedown(proposer: string[], counterparty: string) {
        const s = rulerTable([], [], {
            ruler: { advisers: proposer.map((cardId) => ({ cardId, faceUp: false })) },
            other: { advisers: [{ cardId: counterparty, faceUp: false }] }
        })
        playDrawnCard(s, GATHERING, SearchPlay.Site)
        answerQuestion(s, 'away', { kind: PowerQuestionKind.JoinSite, join: false })
        settleQueue(s)
        return s
    }

    function publicView(s: ReturnType<typeof rulerTable>): string {
        const state = s.dehydrate()
        assert(OathGameStateValidator.Check(state), 'the engine holds canonical state')
        return JSON.stringify(OathRuntime.visibility.state.project(state, spectator))
    }

    it("a counterparty's facedown adviser is asked for by row, and the answer is the same whatever the card is (R-9.4)", () => {
        const wanted = (s: ReturnType<typeof rulerTable>, row: number) =>
            HydratedAnswerQuestion.reasonCannotAnswer(s, 'ruler', { kind: PowerQuestionKind.GatheringFloor, proposal: { withPlayerId: 'other', terms: { fromCounterparty: { adviserRows: [row] }, fromProposer: { favor: 1 } } } })
        const withWolves = floorWithFacedown([], WOLVES)
        const withInn = floorWithFacedown([], INN)
        expect(wanted(withWolves, 0)).toBeUndefined()
        expect(wanted(withInn, 0)).toBeUndefined()
        expect(wanted(withWolves, 1)).toBe(wanted(withInn, 1))
        expect(wanted(withWolves, 1)).toMatch(/no adviser in row 2/)
    })

    it('a facedown adviser offered or taken is named in no public state or record, and its taker knows it only once accepted', () => {
        const s = floorWithFacedown([INN], WOLVES)
        const proposal = answerQuestion(s, 'ruler', { kind: PowerQuestionKind.GatheringFloor, proposal: { withPlayerId: 'other', terms: { fromProposer: { adviserRows: [0] }, fromCounterparty: { adviserRows: [0] } } } })
        expect(JSON.stringify(proposal)).not.toContain(INN)
        expect(publicView(s)).not.toContain(INN)
        expect(publicView(s)).not.toContain(WOLVES)
        const accepted = answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([WOLVES])
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([INN])
        expect(publicView(s)).not.toContain(WOLVES)
        expect(JSON.stringify(accepted)).not.toContain(WOLVES)
        // R-X.3(c) — each side now knows a card it had not seen, so the answer cannot be undone.
        expect(accepted.revealsInfo).toBe(true)
    })

    it('nobody else present means no floor at all', () => {
        const s = rulerTable([], [], { other: { siteId: 'p1' } })
        playDrawnCard(s, GATHERING, SearchPlay.Site)
        answerQuestion(s, 'other', { kind: PowerQuestionKind.JoinSite, join: false })
        answerQuestion(s, 'away', { kind: PowerQuestionKind.JoinSite, join: false })
        expect(settleQueue(s)).toBe(true)
    })
})

describe('PowerQuestion — the turn is held and given back', () => {
    it('a proposal detours to PowerQuestion for the asked player alone, and the answer resumes the Act Phase', () => {
        const engine = new OathTestEngine(OathRuntime)
        const game = testGame(['ruler', 'other', 'away'])
        const hydrated = rulerTable([TINKERS_FAIR], [], { away: { status: PlayerStatus.Chancellor } }, { machineState: MachineState.ActPhase })
        let state = hydrated.dehydrate()
        state.turnManager = { series: [{ type: 'turn', playerId: 'ruler', start: 0 }], turnOrder: ['ruler', 'other', 'away'], turnCounts: { ruler: 1, other: 0, away: 0 } }
        state.activePlayerIds = ['ruler']

        state = engine.runNext(buildAction(UseActionPower, {
            playerId: 'ruler', cardId: TINKERS_FAIR, powerIndex: powerIndexOf(TINKERS_FAIR, PowerTiming.Action),
            choices: [exchange('other', { fromProposer: { favor: 1 }, fromCounterparty: { secrets: 1 } })]
        }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual(['other'])
        expect(state.pendingQuestions?.resumeMachineState).toBe(MachineState.ActPhase)
        expect(engine.getValidActionTypesForPlayer(game, state, 'other')).toEqual([ActionType.AnswerQuestion])
        expect(engine.getValidActionTypesForPlayer(game, state, 'ruler')).toEqual([])

        state = engine.runNext(buildAction(AnswerQuestion, { playerId: 'other', answer: { kind: PowerQuestionKind.Exchange, accept: true } }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['ruler'])
        expect(state.pendingQuestions).toBeUndefined()
        expect(state.players.find((p) => p.playerId === 'ruler')?.secrets).toBe(4)
    })

    it('a When Played round holds the machine for each player in turn, then resumes where the Search was going', () => {
        const engine = new OathTestEngine(OathRuntime)
        const game = testGame(['ruler', 'other', 'away'])
        const hydrated = rulerTable([], [], { ruler: { handIds: [REVELATION, FILLER] }, away: { status: PlayerStatus.Chancellor } }, { machineState: MachineState.Searching })
        let state = hydrated.dehydrate()
        state.turnManager = { series: [{ type: 'turn', playerId: 'ruler', start: 0 }], turnOrder: ['ruler', 'other', 'away'], turnCounts: { ruler: 1, other: 0, away: 0 } }
        state.activePlayerIds = ['ruler']

        state = engine.runNext(buildAction(SearchResolve, { playerId: 'ruler', keptCardId: REVELATION, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual(['ruler'])
        state = engine.runNext(buildAction(AnswerQuestion, { playerId: 'ruler', answer: { kind: PowerQuestionKind.BurnFavorForSecrets, favor: 1 } }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual(['other'])
        state = engine.runNext(buildAction(AnswerQuestion, { playerId: 'other', answer: { kind: PowerQuestionKind.BurnFavorForSecrets, favor: 0 } }), state, game).updatedState
        expect(state.activePlayerIds).toEqual(['away'])
        state = engine.runNext(buildAction(AnswerQuestion, { playerId: 'away', answer: { kind: PowerQuestionKind.BurnFavorForSecrets, favor: 1 } }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['ruler'])
    })
})
