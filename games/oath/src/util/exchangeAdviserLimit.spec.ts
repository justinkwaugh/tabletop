import { describe, expect, it } from 'vitest'
import { SearchPlay } from '../actions/searchResolve.js'
import { HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PowerQuestionKind, type ExchangeTerms, type QuestionAnswer } from '../model/question.js'
import '../powers/index.js'
import { served, servedJson } from '../testing/projection.js'
import { answerQuestion, playDrawnCard } from '../testing/steps.js'
import { adviser, rulerTable } from '../testing/tables.js'
import { FILLER as WRESTLERS, TENTS } from '../testing/cards.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { adviserLimitDiscardCount, adviserLimitDiscards } from './adviserLimit.js'
import { advisersTowardLimit, effectiveAdviserLimit } from './continuous.js'
import { reasonExchangeInvalid } from './exchange.js'
import { currentQuestion } from './questions.js'
import { settleQueue } from './questionAnswers.js'
import { OathRevision } from './revision.js'

const GATHERING = 'denizen.nomad.the-gathering'
const WAGON = 'denizen.nomad.family-wagon'
const PIPER = 'denizen.beast.pied-piper'
const WOLVES = 'denizen.beast.wolves'
const SCOUTS = 'denizen.order.scouts'
const RANGERS = 'denizen.beast.rangers'
const LONGBOWS = 'denizen.order.longbows'
const HERALD = 'denizen.hearth.herald'
const ELDERS = 'denizen.nomad.elders'
const STEED = 'denizen.nomad.a-fast-steed'
const CUP = 'relic.cup-of-plenty'

/** 'ruler' and 'other' stand at c1 with these advisers, 'away' is the Chancellor; the game keeps the rules of `revision`. */
function table(
    ruler: string[],
    other: string[],
    revision: OathRevision = OathRevision.EngineFixes7,
    over: Record<string, Record<string, unknown>> = {}
) {
    return rulerTable(
        [],
        ruler,
        {
            ...over,
            other: { advisers: other.map((cardId) => adviser(cardId)), ...over['other'] },
            away: { status: PlayerStatus.Chancellor }
        },
        { oathRevision: revision }
    )
}

/** The Gathering's round: 'ruler' proposes `terms` to 'other', who accepts. */
function exchangeAtGathering(s: HydratedOathGameState, terms: ExchangeTerms): void {
    playDrawnCard(s, GATHERING, SearchPlay.Site)
    answerQuestion(s, 'away', { kind: PowerQuestionKind.JoinSite, join: false })
    settleQueue(s, {})
    answerQuestion(s, 'ruler', {
        kind: PowerQuestionKind.GatheringFloor,
        proposal: { withPlayerId: 'other', terms }
    })
    answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })
}

function discards(...discardedAdviserCardIds: string[]): QuestionAnswer {
    return { kind: PowerQuestionKind.DiscardAdvisers, discardedAdviserCardIds }
}

function withinLimit(s: HydratedOathGameState, playerId: string): boolean {
    return advisersTowardLimit(s, playerId) <= effectiveAdviserLimit(s, playerId)
}

function view(s: HydratedOathGameState, playerId: string): HydratedOathGameState {
    return new HydratedOathGameState(served(s, { kind: 'player', playerId }))
}

const queue = (s: HydratedOathGameState) =>
    s.pendingQuestions?.queue.map((question) => [question.kind, question.askedPlayerId])

const oneForOne: ExchangeTerms = {
    fromProposer: { adviserRows: [0] },
    fromCounterparty: { adviserRows: [0] }
}

// Law 10.8: "You may Give to the prompted player and vice versa": both gives are one exchange,
// judged on its result.
describe('an adviser exchange is judged on the advisers each player holds after it', () => {
    it('The Gathering: a one-for-one exchange between two players at the limit is accepted, and each keeps three', () => {
        for (const revision of [OathRevision.EngineFixes7, OathRevision.EngineFixes6]) {
            const s = table([WOLVES, WRESTLERS, SCOUTS], [RANGERS, LONGBOWS, HERALD], revision)
            expect(
                reasonExchangeInvalid(s, 'ruler', 'other', oneForOne),
                `revision ${revision}`
            ).toBeUndefined()
            exchangeAtGathering(s, oneForOne)
            expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([
                WRESTLERS,
                SCOUTS,
                RANGERS
            ])
            expect(s.getPlayerState('other').knownAdviserIds()).toEqual([LONGBOWS, HERALD, WOLVES])
            expect(currentQuestion(s)?.kind).toBe(PowerQuestionKind.GatheringFloor)
        }
    })

    it('giving away Family Wagon for a non-Nomad is accepted: the giver ends with two advisers under a limit of three', () => {
        for (const revision of [OathRevision.EngineFixes7, OathRevision.EngineFixes6]) {
            const s = table([WAGON, WOLVES], [SCOUTS], revision)
            expect(
                reasonExchangeInvalid(s, 'ruler', 'other', oneForOne),
                `revision ${revision}`
            ).toBeUndefined()
            exchangeAtGathering(s, oneForOne)
            expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([WOLVES, SCOUTS])
            expect(withinLimit(s, 'ruler')).toBe(true)
            expect(withinLimit(s, 'other')).toBe(true)
            expect(currentQuestion(s)?.kind).toBe(PowerQuestionKind.GatheringFloor)
        }
    })

    it('an exchange under the limit is unchanged and asks nothing', () => {
        const s = table([WOLVES], [RANGERS])
        expect(reasonExchangeInvalid(s, 'ruler', 'other', oneForOne)).toBeUndefined()
        exchangeAtGathering(s, oneForOne)
        expect(currentQuestion(s)?.kind).toBe(PowerQuestionKind.GatheringFloor)
    })

    it('relics and favor in the same exchange move as before, beside the advisers', () => {
        const s = table(
            [WOLVES, WRESTLERS, SCOUTS],
            [RANGERS, LONGBOWS, HERALD],
            OathRevision.EngineFixes7,
            {
                ruler: { relicIds: [CUP] }
            }
        )
        const terms: ExchangeTerms = {
            fromProposer: { adviserRows: [0], relicCardIds: [CUP], favor: 1 },
            fromCounterparty: { adviserRows: [2], secrets: 1 }
        }
        expect(reasonExchangeInvalid(s, 'ruler', 'other', terms)).toBeUndefined()
        exchangeAtGathering(s, terms)
        expect(s.getPlayerState('other').relicIds).toContain(CUP)
        expect(s.getPlayerState('other')).toMatchObject({ favor: 3, secrets: 1 })
        expect(s.getPlayerState('ruler').knownAdviserIds()).toEqual([WRESTLERS, SCOUTS, HERALD])
        expect(currentQuestion(s)?.kind).toBe(PowerQuestionKind.GatheringFloor)
    })
})

// As Law 5.1.4.II rules a play and the Enchantress Q&A a move: an exchange that ends over the limit
// forces a discard, never of a card just received.
describe('from revision 11 an exchange that ends over the adviser limit asks a discard', () => {
    const getTwoGiveOne: ExchangeTerms = {
        fromProposer: { adviserRows: [0, 1] },
        fromCounterparty: { adviserRows: [0] }
    }

    it('getting two and giving one at the limit is accepted, and the receiver discards one they kept', () => {
        const s = table([WOLVES, WRESTLERS, SCOUTS], [RANGERS, LONGBOWS, HERALD])
        expect(reasonExchangeInvalid(s, 'ruler', 'other', getTwoGiveOne)).toBeUndefined()
        exchangeAtGathering(s, getTwoGiveOne)
        expect(currentQuestion(s)).toMatchObject({
            kind: PowerQuestionKind.DiscardAdvisers,
            cardId: GATHERING,
            askedPlayerId: 'other',
            actingPlayerId: 'other',
            count: 1,
            receivedCardIds: [WOLVES, WRESTLERS]
        })
        expect(adviserLimitDiscards(s, 'other')).toEqual([LONGBOWS, HERALD])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'other', discards(WOLVES))).toMatch(
            /just received/
        )
        answerQuestion(s, 'other', discards(HERALD))
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([LONGBOWS, WOLVES, WRESTLERS])
        expect(currentQuestion(s)?.kind).toBe(PowerQuestionKind.GatheringFloor)
    })

    it('before revision 11 the same exchange is refused, as it was recorded', () => {
        const s = table(
            [WOLVES, WRESTLERS, SCOUTS],
            [RANGERS, LONGBOWS, HERALD],
            OathRevision.EngineFixes6
        )
        expect(reasonExchangeInvalid(s, 'ruler', 'other', getTwoGiveOne)).toBe(
            'other cannot hold 2 more advisers'
        )
    })

    it('receiving Family Wagon while holding two non-Nomads asks a discard down to one, never the Wagon', () => {
        const s = table([WAGON], [SCOUTS, WOLVES])
        const terms: ExchangeTerms = { fromProposer: { adviserRows: [0] } }
        expect(reasonExchangeInvalid(s, 'ruler', 'other', terms)).toBeUndefined()
        exchangeAtGathering(s, terms)
        expect(currentQuestion(s)).toMatchObject({
            askedPlayerId: 'other',
            count: 1,
            receivedCardIds: [WAGON]
        })
        expect(adviserLimitDiscards(s, 'other')).toEqual([SCOUTS, WOLVES])
        answerQuestion(s, 'other', discards(WOLVES))
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([SCOUTS, WAGON])
        expect(withinLimit(s, 'other')).toBe(true)
    })

    it('before revision 11 receiving Family Wagon over two non-Nomads is accepted with no discard, as it was recorded', () => {
        const s = table([WAGON], [SCOUTS, WOLVES], OathRevision.EngineFixes6)
        const terms: ExchangeTerms = { fromProposer: { adviserRows: [0] } }
        expect(reasonExchangeInvalid(s, 'ruler', 'other', terms)).toBeUndefined()
        exchangeAtGathering(s, terms)
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([SCOUTS, WOLVES, WAGON])
        expect(currentQuestion(s)?.kind).toBe(PowerQuestionKind.GatheringFloor)
    })

    it('giving Family Wagon away makes the giver’s Nomads count, so the giver discards down', () => {
        const s = table([WAGON, WOLVES, ELDERS, STEED, TENTS], [])
        const terms: ExchangeTerms = {
            fromProposer: { adviserRows: [0] },
            fromCounterparty: { favor: 1 }
        }
        expect(reasonExchangeInvalid(s, 'ruler', 'other', terms)).toBeUndefined()
        exchangeAtGathering(s, terms)
        expect(currentQuestion(s)).toMatchObject({
            askedPlayerId: 'ruler',
            count: 1,
            receivedCardIds: []
        })
        answerQuestion(s, 'ruler', discards(ELDERS))
        expect(withinLimit(s, 'ruler')).toBe(true)
        expect(currentQuestion(s)?.kind).toBe(PowerQuestionKind.GatheringFloor)
    })

    it('both players over: each is asked in turn order from the proposer, before the next proposal', () => {
        const s = table([WAGON, WOLVES, ELDERS, STEED, TENTS], [SCOUTS, RANGERS])
        const terms: ExchangeTerms = { fromProposer: { adviserRows: [0] } }
        exchangeAtGathering(s, terms)
        expect(queue(s)).toEqual([
            [PowerQuestionKind.DiscardAdvisers, 'ruler'],
            [PowerQuestionKind.DiscardAdvisers, 'other'],
            [PowerQuestionKind.GatheringFloor, 'other']
        ])
        answerQuestion(s, 'ruler', discards(TENTS))
        answerQuestion(s, 'other', discards(RANGERS))
        expect(withinLimit(s, 'ruler')).toBe(true)
        expect(withinLimit(s, 'other')).toBe(true)
    })
})

// Pied Piper: "This card ignores the adviser limit." Its Q&A: it "does not prompt a discard when you
// play it, but it still counts toward your total number of advisers". Law 9.2 (its example is this
// card): a card that names a rule supersedes it, so its arrival by any move prompts no discard.
describe('Pied Piper in an exchange', () => {
    it('given to a player with three advisers, it prompts no discard on its arrival, and counts once held', () => {
        const s = table([PIPER], [RANGERS, LONGBOWS, HERALD])
        const terms: ExchangeTerms = { fromProposer: { adviserRows: [0] } }
        expect(reasonExchangeInvalid(s, 'ruler', 'other', terms)).toBeUndefined()
        exchangeAtGathering(s, terms)
        expect(currentQuestion(s)?.kind).toBe(PowerQuestionKind.GatheringFloor)
        expect(advisersTowardLimit(s, 'other')).toBe(4)
    })

    it('given with another adviser to a player at three, the other one prompts a discard, and neither received card goes', () => {
        const s = table([PIPER, WOLVES], [RANGERS, LONGBOWS, HERALD])
        exchangeAtGathering(s, { fromProposer: { adviserRows: [0, 1] } })
        expect(currentQuestion(s)).toMatchObject({
            askedPlayerId: 'other',
            count: 1,
            receivedCardIds: [PIPER, WOLVES]
        })
        expect(adviserLimitDiscards(s, 'other')).toEqual([RANGERS, LONGBOWS, HERALD])
    })

    it('a holder of Pied Piper and two advisers who takes a fourth discards one, the Piper among the choices', () => {
        const s = table([SCOUTS], [PIPER, WOLVES, WRESTLERS])
        const terms: ExchangeTerms = { fromProposer: { adviserRows: [0] } }
        expect(reasonExchangeInvalid(s, 'ruler', 'other', terms)).toBeUndefined()
        exchangeAtGathering(s, terms)
        expect(currentQuestion(s)).toMatchObject({
            askedPlayerId: 'other',
            count: 1,
            receivedCardIds: [SCOUTS]
        })
        expect(adviserLimitDiscards(s, 'other')).toEqual([PIPER, WOLVES, WRESTLERS])
        answerQuestion(s, 'other', discards(PIPER))
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([WOLVES, WRESTLERS, SCOUTS])
    })
})

describe('a facedown adviser received in an exchange', () => {
    function facedownTable() {
        return table([], [RANGERS, LONGBOWS, HERALD], OathRevision.EngineFixes7, {
            ruler: { advisers: [adviser(WOLVES, false)] }
        })
    }
    const terms: ExchangeTerms = { fromProposer: { adviserRows: [0] } }

    it('is not discarded to meet the limit, and only its holder learns which card the question keeps', () => {
        const s = facedownTable()
        exchangeAtGathering(s, terms)
        const question = currentQuestion(s)
        expect(question).toMatchObject({ askedPlayerId: 'other', count: 1, receivedCardIds: [] })
        expect(adviserLimitDiscards(s, 'other')).toEqual([RANGERS, LONGBOWS, HERALD])
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, 'other', discards(WOLVES))).toMatch(
            /just received/
        )
        // R-9.4 — the asked player's view keeps it out the same way; the table never sees it named.
        const own = view(s, 'other')
        expect(adviserLimitDiscards(own, 'other')).toEqual([RANGERS, LONGBOWS, HERALD])
        expect(adviserLimitDiscardCount(own, 'other')).toBe(1)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(own, 'other', discards(WOLVES))).toMatch(
            /just received/
        )
        expect(
            HydratedAnswerQuestion.reasonCannotAnswer(own, 'other', discards(HERALD))
        ).toBeUndefined()
        expect(servedJson(s)).not.toContain(WOLVES)
        expect(servedJson(s, { kind: 'player', playerId: 'away' })).not.toContain(WOLVES)
        answerQuestion(s, 'other', discards(HERALD))
        expect(s.getPlayerState('other').knownAdviserIds()).toEqual([RANGERS, LONGBOWS, WOLVES])
    })
})

describe("safe on a player's view: the exchange check reads only what is public", () => {
    it('every view judges the terms as the server does', () => {
        const scenes = [
            table([WOLVES, WRESTLERS, SCOUTS], [RANGERS, LONGBOWS, HERALD]),
            table(
                [WOLVES, WRESTLERS, SCOUTS],
                [RANGERS, LONGBOWS, HERALD],
                OathRevision.EngineFixes6
            ),
            table([WAGON], [SCOUTS, WOLVES], OathRevision.EngineFixes6),
            table([], [RANGERS, LONGBOWS, HERALD], OathRevision.EngineFixes6, {
                ruler: { advisers: [adviser(WOLVES, false), adviser(SCOUTS, false)] }
            })
        ]
        const termsList: ExchangeTerms[] = [
            oneForOne,
            { fromProposer: { adviserRows: [0, 1] } },
            { fromProposer: { adviserRows: [0, 1] }, fromCounterparty: { adviserRows: [0] } },
            { fromProposer: { adviserRows: [0] } }
        ]
        for (const s of scenes) {
            for (const terms of termsList) {
                const expected = reasonExchangeInvalid(s, 'ruler', 'other', terms)
                for (const playerId of ['ruler', 'other', 'away']) {
                    expect(reasonExchangeInvalid(view(s, playerId), 'ruler', 'other', terms)).toBe(
                        expected
                    )
                }
            }
        }
    })
})
