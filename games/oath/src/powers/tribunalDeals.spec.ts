import { describe, expect, it } from 'vitest'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { HydratedOathGameState, OathGameStateValidator } from '../model/gameState.js'
import { PowerQuestionKind, type ExchangeTerms, type OpenDeal } from '../model/question.js'
import { PowerTiming, TRIBUNAL_ID, powerIndexOf } from '../data/cardPowers.js'
import { PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import { actionPowerUse } from '../testing/choices.js'
import { answerQuestion } from '../testing/steps.js'
import { rulerTable } from '../testing/tables.js'
import '../powers/index.js'

// R-7.6.3-H1 — from revision 28 the Tribunal's exchange may carry a written promise for each side.
const TINKERS_FAIR = 'denizen.hearth.tinkers-fair'
const AT = OathRevision.EngineFixes24
const BEFORE = OathRevision.EngineFixes23
const PROMISE = 'I will not campaign against you next round.'
const REPLY = 'Nor I against you.'
const TRIBUNAL_SITES = { siteCards: { c1: TRIBUNAL_ID, c2: 'site.river', p1: 'site.plains', h1: 'site.wastes' } }

const exchange = (withPlayerId: string, terms: ExchangeTerms): PowerChoice => ({ kind: PowerChoiceKind.Exchange, withPlayerId, terms })
const table = (oathRevision: OathRevision = AT, cards: string[] = []) => rulerTable(cards, [], {}, { oathRevision, ...TRIBUNAL_SITES })
const probe = (s: HydratedOathGameState, terms: ExchangeTerms, cardId = TRIBUNAL_ID, withPlayerId = 'other') =>
    HydratedUseActionPower.reasonCannotUse(s, 'ruler', cardId, powerIndexOf(cardId, PowerTiming.Action), [exchange(withPlayerId, terms)])
const offer = (s: HydratedOathGameState, terms: ExchangeTerms) => actionPowerUse('ruler', TRIBUNAL_ID, [exchange('other', terms)]).apply(s)
const deal = (id: string, proposerPlayerId: string, counterpartyPlayerId: string): OpenDeal => ({
    id,
    proposerPlayerId,
    counterpartyPlayerId,
    proposerPromise: 'An earlier promise.',
    round: 1
})
const dealsOf = (playerId: string, count: number, other = 'away') =>
    Array.from({ length: count }, (_, i) => (i % 2 === 0 ? deal(`d${i}`, playerId, other) : deal(`d${i}`, other, playerId)))

describe('R-7.6.3-H1 — the Tribunal’s promises', () => {
    it('from revision 28 an offer carries a promise for each side, and a promise alone is an exchange', () => {
        expect(probe(table(), { fromProposer: { favor: 1 }, promises: { fromProposer: PROMISE, fromCounterparty: REPLY } })).toBeUndefined()
        expect(probe(table(), { promises: { fromCounterparty: REPLY } })).toBeUndefined()
        expect(probe(table(), {})).toBe('the exchange is empty')
        const s = table()
        offer(s, { promises: { fromProposer: PROMISE } })
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.Exchange,
            proposerPlayerId: 'ruler',
            askedPlayerId: 'other',
            terms: { promises: { fromProposer: PROMISE } }
        })
    })

    it('before revision 28 the Tribunal refuses a promise, as it did, and other cards refuse one at every revision', () => {
        expect(probe(table(BEFORE), { fromProposer: { favor: 1 }, promises: { fromProposer: PROMISE } })).toBe('this exchange cannot include promises')
        expect(probe(table(BEFORE), { promises: { fromProposer: PROMISE } })).toBe('this exchange cannot include promises')
        expect(probe(table(BEFORE), { fromProposer: { favor: 1 } })).toBeUndefined()
        expect(probe(table(AT, [TINKERS_FAIR]), { fromProposer: { favor: 1 }, promises: { fromProposer: PROMISE } }, TINKERS_FAIR)).toBe(
            'this exchange cannot include promises'
        )
    })

    it('a promise is its words, trimmed, of 1 to 200 characters, with line breaks and no other control characters', () => {
        expect(probe(table(), { fromProposer: { favor: 1 }, promises: {} })).toBe('a promise needs its words')
        expect(probe(table(), { promises: { fromProposer: ' I will. ' } })).toBe('a promise cannot start or end with a space')
        expect(probe(table(), { promises: { fromCounterparty: 'I will.\n' } })).toBe('a promise cannot start or end with a space')
        expect(probe(table(), { promises: { fromProposer: 'I will\tnot.' } })).toBe('a promise holds only text and line breaks')
        expect(probe(table(), { promises: { fromProposer: 'First, this.\nThen, that.' } })).toBeUndefined()
        expect(probe(table(), { promises: { fromProposer: 'x'.repeat(200) } })).toBeUndefined()
        expect(() => actionPowerUse('ruler', TRIBUNAL_ID, [exchange('other', { promises: { fromProposer: 'x'.repeat(201) } })])).toThrow()
        expect(() => actionPowerUse('ruler', TRIBUNAL_ID, [exchange('other', { promises: { fromProposer: '' } })])).toThrow()
    })

    it('a promise is at most 200 UTF-16 units, however few characters the schema counts in it', () => {
        const combining = 'a' + '\u0301'.repeat(200)
        expect(combining.length).toBe(201)
        expect(probe(table(), { promises: { fromProposer: combining } })).toBe('a promise is at most 200 characters')
        expect(probe(table(), { promises: { fromCounterparty: combining } })).toBe('a promise is at most 200 characters')
        const withSurrogatePair = '\u{1F600}' + 'x'.repeat(198)
        expect(withSurrogatePair.length).toBe(200)
        expect(probe(table(), { promises: { fromProposer: withSurrogatePair } })).toBeUndefined()
    })
})

describe('R-7.6.3-H1 — an accepted promise opens a public deal', () => {
    it('the accept moves what changes hands and opens the deal with both promises, which makes the answer an Undo barrier', () => {
        const s = table()
        offer(s, { fromProposer: { favor: 1 }, promises: { fromProposer: PROMISE, fromCounterparty: REPLY } })
        const accepted = answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })
        const opened: OpenDeal = {
            id: `1.${s.actionCount}`,
            proposerPlayerId: 'ruler',
            counterpartyPlayerId: 'other',
            proposerPromise: PROMISE,
            counterpartyPromise: REPLY,
            round: 1
        }
        expect(s.openDeals).toEqual([opened])
        expect(s.getPlayerState('ruler').favor).toBe(2)
        expect(s.getPlayerState('other').favor).toBe(3)
        expect(accepted.revealsInfo).toBe(true)
        expect(accepted.metadata?.openedDeal).toEqual(opened)
        expect(accepted.metadata?.summary).toBe("accepted ruler's exchange")
    })

    it('an accepted exchange without a promise opens no deal and stays undoable; a refused offer opens none', () => {
        const plain = table()
        offer(plain, { fromProposer: { favor: 1 } })
        const accepted = answerQuestion(plain, 'other', { kind: PowerQuestionKind.Exchange, accept: true })
        expect(plain.openDeals).toBeUndefined()
        expect(accepted.revealsInfo).toBe(false)
        expect(accepted.metadata?.openedDeal).toBeUndefined()

        const refused = table()
        offer(refused, { promises: { fromProposer: PROMISE } })
        const no = answerQuestion(refused, 'other', { kind: PowerQuestionKind.Exchange, accept: false })
        expect(refused.openDeals).toBeUndefined()
        expect(no.revealsInfo).toBe(false)
        expect(no.metadata?.summary).not.toContain(PROMISE)
    })

    it('a second deal goes beside the first', () => {
        const s = table()
        s.openDeals = [deal('d0', 'other', 'away')]
        offer(s, { promises: { fromCounterparty: REPLY } })
        answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })
        expect(s.openDeals?.map((d) => d.id)).toEqual(['d0', `1.${s.actionCount}`])
        expect(s.openDeals?.[1]).not.toHaveProperty('proposerPromise')
        expect(s.openDeals?.[1]).toMatchObject({ counterpartyPromise: REPLY })
    })
})

describe('R-7.6.3-H1 — five open deals a player', () => {
    it('refuses an offer with a promise when either player is party to five open deals, on either side', () => {
        for (const full of ['ruler', 'other']) {
            const s = table()
            s.openDeals = dealsOf(full, 5)
            expect(probe(s, { promises: { fromProposer: PROMISE } })).toBe(`${full} already has five open deals`)
            // An exchange without a promise opens no deal, so the limit does not apply.
            expect(probe(s, { fromProposer: { favor: 1 } })).toBeUndefined()
        }
        const four = table()
        four.openDeals = [...dealsOf('ruler', 4), deal('x', 'other', 'away')]
        expect(probe(four, { promises: { fromProposer: PROMISE } })).toBeUndefined()
    })

    it('is checked again when the answer arrives: a limit reached meanwhile refuses the accept, and the refusal still answers', () => {
        const s = table()
        offer(s, { promises: { fromProposer: PROMISE } })
        s.openDeals = dealsOf('other', 5)
        expect(() => answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: true })).toThrow('other already has five open deals')
        answerQuestion(s, 'other', { kind: PowerQuestionKind.Exchange, accept: false })
        expect(s.openDeals).toHaveLength(5)
    })

    it('stores at most sixteen open deals, each with the turn it was last claimed in', () => {
        const stored = (openDeals: OpenDeal[]) => OathGameStateValidator.Check({ ...table().dehydrate(), openDeals })
        const claimed: OpenDeal = { ...deal('c', 'ruler', 'other'), lastClaimedTurn: { round: 2, playerId: 'ruler' } }
        expect(stored([claimed])).toBe(true)
        expect(stored(Array.from({ length: 16 }, (_, i) => deal(`d${i}`, 'ruler', 'other')))).toBe(true)
        expect(stored(Array.from({ length: 17 }, (_, i) => deal(`d${i}`, 'ruler', 'other')))).toBe(false)
    })
})
