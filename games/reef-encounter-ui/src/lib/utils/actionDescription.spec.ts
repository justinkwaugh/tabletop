import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    CoralColor,
    type EatCoral,
    type EndGame,
    type ExchangeConsumedPolyp,
    type ExchangeLarvaCube,
    type FeedParrotfish,
    type SearchBag,
    type PlayLarvaCube,
    type PlacePolyp,
    type RefillOpenSea,
    type TakeOpenSeaSpace
} from '@tabletop/reef-encounter'
import { capitalised, describeActions } from './actionDescription.js'

let next = 0
const base = () => ({ id: `action-${next++}`, gameId: 'game', source: ActionSource.User })

const placed = (color: CoralColor, boardId: 1 | 2, attacked?: CoralColor): PlacePolyp => ({
    ...base(),
    type: ActionType.PlacePolyp,
    playerId: 'a',
    boardId,
    coords: { row: 0, col: 0 },
    fromConsumed: false,
    metadata: { color, attacked }
})

const played = (color: CoralColor): PlayLarvaCube => ({
    ...base(),
    type: ActionType.PlayLarvaCube,
    playerId: 'a',
    color
})

const possessive = (playerId: string) => (playerId === 'a' ? 'your' : 'Bashir’s')

const described = (actions: Parameters<typeof describeActions>[0], own: 'your' | 'their') =>
    describeActions(actions, own, possessive, (boardId) => `Board ${boardId}`)

const texts = (...args: Parameters<typeof described>) =>
    described(...args).map((phrase) => phrase.text)

describe('describing a turn', () => {
    it('merges plain placements of one colour on one board', () => {
        const phrases = texts(
            [
                played(CoralColor.Orange),
                placed(CoralColor.Orange, 1),
                placed(CoralColor.Orange, 1),
                placed(CoralColor.Orange, 2)
            ],
            'their'
        )
        expect(phrases).toEqual([
            'played an orange larva cube.',
            'placed 2 orange polyps on Board 1.',
            'placed an orange polyp on Board 2.'
        ])
    })

    it('keeps an attack on its own line', () => {
        const phrases = texts(
            [placed(CoralColor.White, 1), placed(CoralColor.White, 1, CoralColor.Yellow)],
            'their'
        )
        expect(phrases).toEqual([
            'placed a white polyp on Board 1.',
            'placed a white polyp on Board 1, consuming a yellow polyp.'
        ])
    })

    it('speaks to the viewer about their own parrotfish', () => {
        const feed: FeedParrotfish = {
            ...base(),
            type: ActionType.FeedParrotfish,
            playerId: 'a',
            color: CoralColor.Grey
        }
        expect(described([feed], 'your')).toEqual([
            expect.objectContaining({ text: 'fed a grey polyp to your parrotfish.', playerId: 'a' })
        ])
        expect(capitalised('fed a grey polyp.')).toBe('Fed a grey polyp.')
    })

    it('shows components as icons, with shorter words where the icons carry the meaning', () => {
        const exchange: ExchangeConsumedPolyp = {
            ...base(),
            type: ActionType.ExchangeConsumedPolyp,
            playerId: 'a',
            color: CoralColor.Pink
        }
        const [trade] = described([exchange], 'their')
        expect(trade.text).toBe('traded a consumed pink polyp for a pink larva cube.')
        expect(trade.parts).toEqual([
            'traded ',
            expect.objectContaining({ icon: 'polyp', color: CoralColor.Pink, consumed: true }),
            { text: ' for ', short: ' → ' },
            expect.objectContaining({ icon: 'cube', color: CoralColor.Pink, count: 1 }),
            '.'
        ])
    })

    it('says when a move starts the final turns', () => {
        const eat: EatCoral = {
            ...base(),
            type: ActionType.EatCoral,
            playerId: 'a',
            boardId: 1,
            coords: { row: 0, col: 0 },
            metadata: {
                color: CoralColor.Pink,
                polyps: 6,
                returnedToBag: 4,
                shrimpToOpenSea: false,
                startsFinalTurns: true
            }
        }
        expect(texts([eat], 'their')).toEqual([
            'fed a coral of 6 pink polyps to their parrotfish, 4 of them going back into the bag.',
            'That ends the game: everyone else may eat a final coral.'
        ])
    })

    it('tells of a search of the bag and what it found', () => {
        const exchange: ExchangeLarvaCube = {
            ...base(),
            type: ActionType.ExchangeLarvaCube,
            playerId: 'a',
            color: CoralColor.Pink,
            metadata: { searchesBag: true }
        }
        const search = (found: boolean, need: SearchBag['need']): SearchBag => ({
            ...base(),
            source: ActionSource.System,
            type: ActionType.SearchBag,
            revealsInfo: true,
            color: CoralColor.Pink,
            need,
            metadata: { found }
        })
        const exchanging = { kind: 'exchange', playerId: 'a' } as const
        const growing = { kind: 'extraGrowth', boardId: 2 } as const

        expect(texts([exchange, search(true, exchanging)], 'their')).toEqual([
            'reached into the bag to trade a pink larva cube for a pink polyp.',
            'The bag held a pink polyp.'
        ])
        expect(texts([search(false, exchanging)], 'their')).toEqual([
            'The bag held no pink polyp, so the cube stays.'
        ])
        expect(texts([search(true, growing)], 'their')).toEqual([
            'Bonus pink polyp placed from the bag.'
        ])
        expect(texts([search(false, growing)], 'their')).toEqual([
            'No bonus pink polyp left in the bag.'
        ])
    })

    it('ends a placement with the bonus polyp the bag held for it', () => {
        const place: PlacePolyp = {
            ...base(),
            type: ActionType.PlacePolyp,
            playerId: 'a',
            boardId: 2,
            coords: { row: 0, col: 0 },
            fromConsumed: false,
            metadata: { color: CoralColor.Pink }
        }
        const search = (found: boolean): SearchBag => ({
            ...base(),
            source: ActionSource.System,
            type: ActionType.SearchBag,
            revealsInfo: true,
            color: CoralColor.Pink,
            need: { kind: 'extraGrowth', boardId: 2 },
            metadata: { found }
        })
        expect(texts([place, search(true)], 'their')).toEqual([
            'placed a pink polyp on Board 2; bonus pink polyp from the bag.'
        ])
        expect(texts([place, search(false)], 'their')).toEqual([
            'placed a pink polyp on Board 2; no bonus pink polyp left in the bag.'
        ])
    })

    it('ends a turn with the larva cube taken and the refill', () => {
        const take: TakeOpenSeaSpace = {
            ...base(),
            type: ActionType.TakeOpenSeaSpace,
            playerId: 'a',
            larvaColor: CoralColor.Grey,
            metadata: { polyps: [CoralColor.Grey, CoralColor.Orange] }
        }
        const refill: RefillOpenSea = {
            ...base(),
            source: ActionSource.System,
            type: ActionType.RefillOpenSea,
            revealsInfo: true,
            metadata: {
                larvaColor: CoralColor.Grey,
                additions: [
                    { larvaColor: CoralColor.Grey, polyp: CoralColor.Yellow },
                    { larvaColor: CoralColor.Pink, polyp: CoralColor.White }
                ],
                bonusPolypsReturned: false,
                shortage: false
            }
        }
        expect(texts([take, refill], 'their')).toEqual([
            'ended their turn by taking the grey larva cube with grey and orange polyps. Refill: a yellow polyp on the grey space, a white polyp on the pink space.'
        ])
    })

    it('counts repeated colours among the polyps taken with a larva cube', () => {
        const take: TakeOpenSeaSpace = {
            ...base(),
            type: ActionType.TakeOpenSeaSpace,
            playerId: 'a',
            larvaColor: CoralColor.Grey,
            metadata: { polyps: [CoralColor.White, CoralColor.Yellow, CoralColor.Yellow] }
        }
        expect(texts([take], 'their')).toEqual([
            'ended their turn by taking the grey larva cube with a white polyp and two yellow polyps.'
        ])
    })

    it('tells the bonus spaces refilled at turn end, and colours the bag lacked', () => {
        const take: TakeOpenSeaSpace = {
            ...base(),
            type: ActionType.TakeOpenSeaSpace,
            playerId: 'a',
            larvaColor: CoralColor.Grey,
            metadata: { polyps: [CoralColor.Grey] }
        }
        const refill: RefillOpenSea = {
            ...base(),
            source: ActionSource.System,
            type: ActionType.RefillOpenSea,
            revealsInfo: true,
            metadata: {
                larvaColor: CoralColor.Grey,
                additions: [{ larvaColor: CoralColor.Grey, polyp: CoralColor.Yellow }],
                bonusPolypsReturned: false,
                shortage: false,
                bonusRefills: [
                    { color: CoralColor.Pink, found: true },
                    { color: CoralColor.White, found: true },
                    { color: CoralColor.Orange, found: false }
                ]
            }
        }
        expect(texts([take, refill], 'their')).toEqual([
            'ended their turn by taking the grey larva cube with a grey polyp. Refill: a yellow polyp on the grey space. Bonus: pink polyp, white polyp. No bonus orange polyp in the bag.'
        ])
    })

    it('reveals every parrotfish polyp fed at setup when the game ends', () => {
        const ended: EndGame = {
            ...base(),
            source: ActionSource.System,
            type: ActionType.EndGame,
            revealsInfo: true,
            metadata: {
                setupParrotfishPolyps: [
                    { playerId: 'a', color: CoralColor.Grey },
                    { playerId: 'b', color: CoralColor.White }
                ]
            }
        }
        expect(described([ended], 'their')).toEqual([
            expect.objectContaining({ text: 'The game ended.' }),
            expect.objectContaining({
                text: 'your parrotfish had been fed a grey polyp at setup.',
                playerId: 'a'
            }),
            expect.objectContaining({
                text: 'Bashir’s parrotfish had been fed a white polyp at setup.',
                playerId: 'b'
            })
        ])
    })
})
