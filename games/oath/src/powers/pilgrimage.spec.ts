import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { HydratedAnswerQuestion, AnswerQuestion } from '../actions/answerQuestion.js'
import { PowerQuestionKind } from '../model/question.js'
import { CardKind, Region, Suit } from '../model/oathEnums.js'
import type { HiddenReveal } from '../model/hidden.js'
import { PowerTiming, powersWithTiming } from '../data/cardPowers.js'
import { expectFavorConserved } from '../testing/census.js'
import { legalChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { effectFor, hasEffect } from './registry.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { INN, FILLER } from '../testing/cards.js'

/** R-8.5, R-9.4 — the Dispossessed is in the vault. */
const PILGRIMAGE = 'denizen.nomad.pilgrimage'
const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const ELDERS = 'denizen.nomad.elders'
const FOREST_COUNCIL = 'denizen.beast.forest-council'
const BLOODLINE = 'denizen.nomad.ancient-bloodline'
const POOL = ['denizen.arcane.tutor', 'denizen.hearth.storyteller', 'denizen.discord.scryer', 'denizen.order.scouts']

const ME = 'me'
const FOE = 'foe'
const POWER = powersWithTiming(PILGRIMAGE, PowerTiming.WhenPlayed)[0]

/** `me` stands on c1 in the Cradle, which `foe` rules. */
function board(denizens: Record<string, string[]> = {}, over: Record<string, Record<string, unknown>> = {}, dispossessed: string[] = POOL) {
    const s = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', favor: 3, secrets: 2, warbandsOnBoard: { [Color.Red]: 2 }, ...over[ME] }),
            testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'p1', favor: 3, secrets: 2, warbandsOnBoard: { [Color.Blue]: 2 }, ...over[FOE] })
        ],
        {
            denizensBySite: { c1: [WOLVES, INN], c2: [TENTS], p1: [ELDERS], ...denizens },
            warbandsBySite: { c1: { [Color.Blue]: 1 }, c2: { [Color.Red]: 1 }, p1: { [Color.Blue]: 1 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes' }
        }
    )
    openTurn(s, ME)
    s.requireVault().dispossessed = [...dispossessed]
    return s
}

function play(s: ReturnType<typeof board>, fields: Record<string, unknown> = {}) {
    s.getPlayerState(ME).handIds = [PILGRIMAGE, FILLER]
    const a = new HydratedSearchResolve(
        buildAction(SearchResolve, { playerId: ME, keptCardId: PILGRIMAGE, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true, ...fields })
    )
    a.apply(s)
    return a
}

function stack(s: ReturnType<typeof board>, order: number[], playerId = ME) {
    const a = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId, answer: { kind: PowerQuestionKind.OrderDrawnCards, order } }))
    a.apply(s)
    return a
}

function peekedBy(a: { metadata?: { reveal?: HiddenReveal } }): string[] {
    const reveal = a.metadata?.reveal
    return reveal?.kind === 'peek' ? reveal.cardIds : []
}

describe('Pilgrimage — registered, adviser only, no choices', () => {
    it('is a built When Played power that declares no choice and refuses a stray one', () => {
        expect(hasEffect(POWER)).toBe(true)
        expect(legalChoices(board(), ME, POWER)).toEqual([])
        const stray: PowerChoice[] = [{ kind: PowerChoiceKind.Yes }]
        expect(() => play(board(), { choices: stray })).toThrow(/Cannot resolve search/)
    })

    it('cannot be played to a site (R-7.2.1), and does nothing played facedown (R-7.2)', () => {
        expect(() => play(board(), { play: SearchPlay.Site })).toThrow(/can only be played to your advisers/)
        const s = board()
        const a = play(s, { faceUp: false })
        expect(a.metadata?.whenPlayed).toBeUndefined()
        expect(s.denizensBySite['c1']).toEqual([WOLVES, INN])
        expect(s.requireVault().dispossessed).toEqual(POOL)
    })
})

describe('"move all denizens at your site to the Dispossessed"', () => {
    it('move ALL denizens at your site: every one leaves the map, and the cards are conserved in the vault', () => {
        const s = board()
        const a = play(s)
        expect(s.denizensBySite['c1']).toEqual([])
        const drawn = peekedBy(a)
        expect([...s.requireVault().dispossessed, ...drawn].sort()).toEqual([...POOL, WOLVES, INN].sort())
        expect(a.metadata?.whenPlayed).toMatch(/moved denizen\.beast\.wolves, denizen\.hearth\.wayside-inn from c1 to the Dispossessed/)
    })

    it('to the Dispossessed: into an empty pool the same cards go in and come out, so the draw is never short', () => {
        const s = board({}, {}, [])
        const a = play(s)
        expect(peekedBy(a).sort()).toEqual([WOLVES, INN].sort())
        expect(s.requireVault().dispossessed).toEqual([])
        expect(s.denizensBySite['c1']).toEqual([])
    })

    it("at YOUR site: the pawn's, whoever rules the cards — and no other site's", () => {
        const s = board()
        const a = play(s)
        expect(s.denizensBySite['c1']).toEqual([])
        expect(s.denizensBySite['c2']).toEqual([TENTS])
        expect(s.denizensBySite['p1']).toEqual([ELDERS])
        expect(peekedBy(a)).toHaveLength(2)
        const vault = s.requireVault()
        for (const elsewhere of [TENTS, ELDERS]) expect([...vault.dispossessed, ...vault.discardPiles[Region.Cradle]]).not.toContain(elsewhere)
    })

    it('a locked denizen cannot be moved (R-7.2.2, R-9.2): it stays and is not counted', () => {
        const s = board({ c1: [FOREST_COUNCIL, WOLVES, INN] })
        const a = play(s)
        expect(s.denizensBySite['c1']).toEqual([FOREST_COUNCIL])
        expect(peekedBy(a)).toHaveLength(2)
        expect(s.requireVault().dispossessed).not.toContain(FOREST_COUNCIL)
    })

    it("a lock a power imposes binds too: an enemy's Ancient Bloodline keeps every denizen at the site it rules", () => {
        const s = board({}, { [FOE]: { advisers: [{ cardId: BLOODLINE, faceUp: true }] } })
        const a = play(s)
        expect(s.denizensBySite['c1']).toEqual([WOLVES, INN])
        expect(a.metadata?.whenPlayed).toMatch(/no denizens at c1 could be moved/)
        expect(a.metadata?.pileDeposits).toBeUndefined()
    })

    it('favor and secrets on a moved card return as a discard returns them (R-10.5): favor to its bank, secrets facedown to the player', () => {
        const s = board({}, {}, [...POOL, ELDERS])
        s.cardTokens = { [WOLVES]: { favor: 2, secrets: 1 }, [TENTS]: { favor: 1, secrets: 0 } }
        const bank = s.favorBank[Suit.Beast]
        expectFavorConserved(s, () => {
            // The seeded draw leaves Wolves in the Dispossessed, so only the move sheds its tokens.
            expect(peekedBy(play(s))).not.toContain(WOLVES)
        })
        expect(s.favorBank[Suit.Beast]).toBe(bank + 2)
        expect(s.getPlayerState(ME).secretsFacedown).toBe(1)
        expect(s.cardTokens[WOLVES]).toBeUndefined()
        expect(s.cardTokens[TENTS]).toEqual({ favor: 1, secrets: 0 })
    })
})

describe('"Shuffle and draw denizens from the Dispossessed equal to the number you moved"', () => {
    it('shuffle: the draw is not the top of the pool as it lay, and the protected PRNG advanced', () => {
        const s = board()
        const before = s.prng.invocations
        const a = play(s)
        expect(s.prng.invocations).toBeGreaterThan(before)
        expect(peekedBy(a)).not.toEqual(POOL.slice(0, 2))
        const again = play(board())
        expect(peekedBy(again)).toEqual(peekedBy(a))
    })

    it('equal to the number you moved: two in, two out; three in, three out', () => {
        const two = board()
        expect(peekedBy(play(two))).toHaveLength(2)
        expect(two.requireVault().dispossessed).toHaveLength(POOL.length)

        const three = board({ c1: [WOLVES, INN, TENTS], c2: [] })
        expect(peekedBy(play(three))).toHaveLength(3)
        expect(three.requireVault().dispossessed).toHaveLength(POOL.length)
    })

    it('the effect refuses to run on a draw that does not match what it moved', () => {
        const s = board()
        const effect = effectFor(POWER)
        expect(() => effect?.resolve({ state: s, playerId: ME, power: POWER, choices: [] })).toThrow(/moved 2 denizens but the Dispossessed gave 0/)
    })
})

describe('"Peek at them and put them on your region\'s discard pile"', () => {
    it('peek at them: the drawn cards are on the record for the actor, and nowhere in public state or the public summary', () => {
        const s = board({ c1: [WOLVES] })
        const a = play(s)
        const drawn = peekedBy(a)
        expect(drawn).toHaveLength(1)
        expect(a.metadata?.peeked).toEqual(drawn)
        const open = { ...s.dehydrate(), vault: undefined }
        for (const id of [WOLVES, ...POOL]) {
            expect(JSON.stringify(open)).not.toContain(id)
            expect(a.metadata?.whenPlayed?.split('; drew')[1]).not.toContain(id)
        }
        expect(a.metadata?.whenPlayed).toMatch(/drew 1 from it, peeked/)
    })

    it("on YOUR region's discard pile: the pawn's own (R-10.30), not R-10.5's next region", () => {
        const s = board()
        const drawn = peekedBy(play(s))
        const answer = stack(s, [0, 1])
        const vault = s.requireVault()
        // R-10.5 — the Search's own discard goes one region along; the drawn cards do not.
        expect(vault.discardPiles[Region.Provinces]).toEqual([FILLER])
        expect([...vault.discardPiles[Region.Cradle]].sort()).toEqual([...drawn].sort())
        expect(s.discardPileCounts).toEqual({ [Region.Cradle]: 2, [Region.Provinces]: 1, [Region.Hinterland]: 0 })
        expect(s.discardTopBackType?.[Region.Cradle]).toBe(CardKind.Denizen)
        expect(answer.metadata?.pileDeposits).toEqual([{ region: Region.Cradle, cardIds: drawn }])
        expect(answer.revealsInfo).toBe(true)
    })

    it('in an order of the player’s choice (Law Glossary "Discard"): the drawn cards wait, off the pile, on a question to the player', () => {
        const s = board()
        const a = play(s)
        const drawn = peekedBy(a)
        expect(s.pendingQuestions?.queue).toEqual([{ kind: PowerQuestionKind.OrderDrawnCards, cardId: PILGRIMAGE, askedPlayerId: ME, region: Region.Cradle, cardIds: drawn }])
        expect(s.requireVault().discardPiles[Region.Cradle]).toEqual([])
        expect(s.discardPileCounts[Region.Cradle]).toBe(0)
        expect(a.metadata?.pileDeposits).toBeUndefined()
        expect(a.metadata?.whenPlayed).toMatch(/drew 2 from it, peeked, and will stack them on the cradle discard pile/)
    })

    it('stacked in the chosen order on top of what the pile held: the last listed ends on top', () => {
        const s = board()
        s.requireVault().discardPiles[Region.Cradle] = [ELDERS]
        s.discardPileCounts[Region.Cradle] = 1
        const drawn = peekedBy(play(s))
        const answer = stack(s, [1, 0])
        expect(s.requireVault().discardPiles[Region.Cradle]).toEqual([drawn[0], drawn[1], ELDERS])
        expect(s.discardPileCounts[Region.Cradle]).toBe(3)
        expect(s.pendingQuestions?.queue).toEqual([])
        expect(answer.metadata?.summary).toBe('stacked 2 cards on the cradle discard pile')
        const other = board()
        const again = peekedBy(play(other))
        stack(other, [0, 1])
        expect(other.requireVault().discardPiles[Region.Cradle]).toEqual([again[1], again[0]])
    })

    it('the order is a permutation of the drawn cards: a card twice, one left out, one too many or a position off the list is refused; only the player answers', () => {
        const s = board({ c1: [WOLVES, INN, TENTS], c2: [] })
        play(s)
        const reason = (order: number[], playerId = ME) => HydratedAnswerQuestion.reasonCannotAnswer(s, playerId, { kind: PowerQuestionKind.OrderDrawnCards, order })
        const refusal = 'the order must name each of the 3 cards once'
        expect(reason([0, 0, 1])).toBe(refusal)
        expect(reason([0, 1])).toBe(refusal)
        expect(reason([0, 1, 2, 2])).toBe(refusal)
        expect(reason([0, 1, 3])).toBe(refusal)
        expect(reason([0, 1, 1.5])).toBe(refusal)
        expect(reason([2, 0, 1], FOE)).toBe("the question is me's to answer")
        expect(reason([2, 0, 1])).toBeUndefined()
    })

    it('a single card drawn has one order: it goes on the pile at once and nobody is asked', () => {
        const s = board({ c1: [WOLVES] })
        const a = play(s)
        const drawn = peekedBy(a)
        expect(s.pendingQuestions).toBeUndefined()
        expect(s.requireVault().discardPiles[Region.Cradle]).toEqual(drawn)
        expect(a.metadata?.pileDeposits).toEqual([{ region: Region.Cradle, cardIds: drawn }])
    })
})

describe('the negative, the other route, and the host as the only author of the draw', () => {
    it('with no denizen to move nothing happens: no draw, no shuffle, no pile, and the play still stands', () => {
        const s = board({ c1: [] })
        const before = s.prng.invocations
        const a = play(s)
        expect(a.metadata?.reveal).toBeUndefined()
        expect(a.metadata?.peeked).toBeUndefined()
        expect(a.metadata?.pileDeposits).toBeUndefined()
        expect(s.prng.invocations).toBe(before)
        expect(s.requireVault().dispossessed).toEqual(POOL)
        expect(s.discardPileCounts[Region.Cradle]).toBe(0)
        expect(s.getPlayerState(ME).advisers).toEqual([{ cardId: PILGRIMAGE, faceUp: true }])
    })

    it('the R-6.1 flip fires it the same way, and is an Undo barrier though it discards nothing of its own', () => {
        const s = board({}, { [ME]: { advisers: [{ cardId: PILGRIMAGE, faceUp: false }] } })
        const a = new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, { playerId: ME, cardId: PILGRIMAGE, play: SearchPlay.Adviser }))
        a.apply(s)
        const drawn = peekedBy(a)
        expect(drawn).toHaveLength(2)
        expect(s.denizensBySite['c1']).toEqual([])
        expect(a.metadata?.discardedCardIds).toEqual([])
        expect(a.metadata?.peeked).toEqual(drawn)
        stack(s, [0, 1])
        expect(s.requireVault().discardPiles[Region.Cradle]).toEqual([drawn[1], drawn[0]])
        expect(s.discardPileCounts[Region.Cradle]).toBe(2)
        expect(a.revealsInfo).toBe(true)
    })

    it('a forged reveal on the action is overwritten by the host: the draw comes from the vault alone', () => {
        const s = board()
        const forged = { kind: 'peek', cardIds: [ELDERS, TENTS] }
        const a = play(s, { reveal: forged })
        const drawn = peekedBy(a)
        expect(drawn).not.toEqual(forged.cardIds)
        expect([...POOL, WOLVES, INN]).toEqual(expect.arrayContaining(drawn))
        stack(s, [0, 1])
        expect(s.requireVault().discardPiles[Region.Cradle]).toEqual([drawn[1], drawn[0]])
    })
})
