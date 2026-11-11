import { describe, expect, it } from 'vitest'
import { Deck, kingOf, Suit, trumpId } from '../components/cards.js'
import { Contract, contractDefinition } from '../components/contracts.js'
import {
    Bonus,
    newAnnouncements,
    Side,
    type AnnouncedBonus,
    type Announcements
} from './announcements.js'
import { scoreBonuses, type BonusHand } from './bonusScoring.js'
import type { CompletedTrick } from './tricks.js'

const declarerSide = ['a', 'b']
const sideOf = (playerId: string) =>
    declarerSide.includes(playerId) ? Side.Declarer : Side.Defenders
const filler = Deck.filter((card) => card.kind === 'suit' && card.points === 1).map(
    (card) => card.id
)

// Twelve tricks won by `winners` (a by default); `special` puts a card in a trick for a player.
function tricks(
    winners: Record<number, string> = {},
    special: { trick: number; playerId: string; cardId: string }[] = []
): CompletedTrick[] {
    return Array.from({ length: 12 }, (_, index) => ({
        winnerId: winners[index] ?? 'a',
        plays: ['a', 'b', 'c', 'd'].map((playerId, seat) => ({
            playerId,
            cardId:
                special.find((play) => play.trick === index && play.playerId === playerId)
                    ?.cardId ?? filler[(index * 4 + seat) % filler.length]
        }))
    }))
}

function announced(bonus: Bonus, side: Side, doubles = 0): AnnouncedBonus {
    return { bonus, side, playerId: side === Side.Declarer ? 'a' : 'c', doubles }
}

function hand(overrides: Partial<BonusHand> & { announcements?: Announcements } = {}): BonusHand {
    return {
        definition: contractDefinition(Contract.Rufer),
        announcements: newAnnouncements(),
        // Defenders win one trick, so there is no Valat.
        tricks: tricks({ 0: 'c' }),
        sideOf,
        cards: { [Side.Declarer]: [], [Side.Defenders]: [] },
        isCalledKing: (cardId) => cardId === kingOf(Suit.Hearts),
        ...overrides
    }
}

const trull = [trumpId(1), trumpId(21), trumpId(22)]

describe('scoring bonuses', () => {
    it('scores a silent Trull for whichever side took it', () => {
        const scoring = scoreBonuses(
            hand({ cards: { [Side.Declarer]: [], [Side.Defenders]: trull } })
        )
        expect(scoring.results).toEqual([
            {
                bonus: Bonus.Trull,
                side: Side.Defenders,
                announced: false,
                doubles: 0,
                made: true,
                points: 1
            }
        ])
    })

    it('wins or loses an announced bonus at its announced value, doubled by each Kontra', () => {
        const announcements = {
            ...newAnnouncements(),
            bonuses: [
                announced(Bonus.Trull, Side.Declarer, 1),
                announced(Bonus.FourKings, Side.Declarer)
            ]
        }
        const scoring = scoreBonuses(
            hand({ announcements, cards: { [Side.Declarer]: trull, [Side.Defenders]: [] } })
        )
        expect(scoring.results.map((result) => [result.bonus, result.made, result.points])).toEqual(
            [
                [Bonus.Trull, true, 4],
                [Bonus.FourKings, false, -2]
            ]
        )
    })

    it('scores a bird for winning its trick, and against its side for losing it', () => {
        const won = scoreBonuses(
            hand({
                tricks: tricks({ 0: 'c', 11: 'b' }, [
                    { trick: 11, playerId: 'b', cardId: trumpId(1) }
                ])
            })
        )
        expect(won.results).toMatchObject([{ bonus: Bonus.Pagat, side: Side.Declarer, points: 1 }])
        const lost = scoreBonuses(
            hand({
                tricks: tricks({ 0: 'c', 10: 'd' }, [
                    { trick: 10, playerId: 'c', cardId: trumpId(2) }
                ])
            })
        )
        expect(lost.results).toMatchObject([
            { bonus: Bonus.Uhu, side: Side.Defenders, made: false, points: -2 }
        ])
    })

    it('loses an announced bird played before its trick', () => {
        const announcements = {
            ...newAnnouncements(),
            bonuses: [announced(Bonus.Pagat, Side.Declarer)]
        }
        const scoring = scoreBonuses(
            hand({
                announcements,
                tricks: tricks({ 0: 'c' }, [{ trick: 5, playerId: 'a', cardId: trumpId(1) }])
            })
        )
        expect(scoring.results).toMatchObject([{ bonus: Bonus.Pagat, made: false, points: -2 }])
    })

    it('scores King ultimo when declarer’s side wins the last trick holding the called King', () => {
        const scoring = scoreBonuses(
            hand({
                tricks: tricks({ 0: 'c', 11: 'a' }, [
                    { trick: 11, playerId: 'b', cardId: kingOf(Suit.Hearts) }
                ])
            })
        )
        expect(scoring.results).toMatchObject([
            { bonus: Bonus.KingUltimo, side: Side.Declarer, made: true, points: 1 }
        ])
    })

    it('scores the announced Sack for 46 card points', () => {
        const announcements = {
            ...newAnnouncements(),
            bonuses: [announced(Bonus.Sack, Side.Declarer)]
        }
        const sack = (cards: string[]) =>
            scoreBonuses(
                hand({ announcements, cards: { [Side.Declarer]: cards, [Side.Defenders]: [] } })
            ).results.find((result) => result.bonus === Bonus.Sack)
        expect(sack(Deck.map((card) => card.id))).toMatchObject({ made: true, points: 2 })
        expect(sack(trull)).toMatchObject({ made: false, points: -2 })
    })

    it('doubles bonuses in Solo contracts', () => {
        const scoring = scoreBonuses(
            hand({
                definition: contractDefinition(Contract.Solodreier),
                cards: { [Side.Declarer]: trull, [Side.Defenders]: [] }
            })
        )
        expect(scoring.results).toMatchObject([{ bonus: Bonus.Trull, points: 2 }])
    })

    it('lets a Valat replace everything else, at four or eight times the game', () => {
        const silent = scoreBonuses(
            hand({ tricks: tricks(), cards: { [Side.Declarer]: trull, [Side.Defenders]: [] } })
        )
        expect(silent.valat).toBe(true)
        expect(silent.results).toEqual([
            {
                bonus: Bonus.Valat,
                side: Side.Declarer,
                announced: false,
                doubles: 0,
                made: true,
                points: 4
            }
        ])
        const announcements = {
            ...newAnnouncements(),
            bonuses: [announced(Bonus.Valat, Side.Declarer)]
        }
        const failed = scoreBonuses(hand({ announcements }))
        expect(failed.valat).toBe(true)
        expect(failed.results).toMatchObject([{ bonus: Bonus.Valat, made: false, points: -8 }])
    })

    it('scores nothing in negative games, and only Four Kings and Valat in the colour games', () => {
        expect(
            scoreBonuses(
                hand({
                    definition: contractDefinition(Contract.Bettel),
                    cards: { [Side.Declarer]: trull, [Side.Defenders]: [] }
                })
            ).results
        ).toEqual([])
        const kings = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades].map(kingOf)
        for (const contract of [Contract.Farbendreier, Contract.Farbensolo]) {
            const scoring = scoreBonuses(
                hand({
                    definition: contractDefinition(contract),
                    announcements: {
                        ...newAnnouncements(),
                        bonuses: [announced(Bonus.Pagat, Side.Declarer)]
                    },
                    cards: { [Side.Declarer]: [...trull, ...kings], [Side.Defenders]: [] }
                })
            )
            expect(scoring.results).toMatchObject([
                { bonus: Bonus.FourKings, side: Side.Declarer, announced: false, points: 1 }
            ])
        }
    })
})
