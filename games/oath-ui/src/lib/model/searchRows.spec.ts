import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    Banner,
    HydratedOathGameState,
    OathRevision,
    PowerChoiceKind,
    PowerTiming,
    Region,
    SearchSource,
    cardPower,
    powerIndexOf,
    type ModifierUse
} from '@tabletop/oath'
import {
    openTurn,
    required,
    served,
    testBanners,
    testPlayer,
    testState
} from '@tabletop/oath/testing'
import { searchRows } from './searchRows.js'

const OBSERVATORY = 'denizen.arcane.observatory'
const ERRAND_BOY = 'denizen.beast.errand-boy'

function board(
    piles: Partial<Record<Region, number>> = {},
    cards: Record<string, string[]> = {},
    over: Record<string, unknown> = {}
) {
    const s = testState(
        [testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', favor: 2, supply: 5 })],
        {
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...cards },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            discardPileCounts: { cradle: 4, provinces: 0, hinterland: 0, ...piles },
            ...over
        }
    )
    openTurn(s, 'p1')
    return s
}

const observatory = (region: Region): ModifierUse => ({
    cardId: OBSERVATORY,
    powerIndex: powerIndexOf(OBSERVATORY, PowerTiming.Modifier),
    choices: [{ kind: PowerChoiceKind.Region, region }]
})

const errandBoyAt = (region?: Region): ModifierUse => ({
    cardId: ERRAND_BOY,
    powerIndex: powerIndexOf(ERRAND_BOY, PowerTiming.Modifier),
    ...(region ? { choices: [{ kind: PowerChoiceKind.Region, region }] } : {})
})

/** The piles a card in use names, each sent with it, as `regionVariants` gives them. */
function variantsOf(named: (region: Region) => ModifierUse, regions: Region[]) {
    const use = named(regions[0] ?? Region.Cradle)
    const printed = required(cardPower(use.cardId, use.powerIndex), use.cardId)
    return regions.map((region) => ({
        use: { cardId: use.cardId, powerIndex: use.powerIndex },
        modifiers: [named(region)],
        cost: printed.cost
    }))
}

const read = (rows: ReturnType<typeof searchRows>) =>
    rows.map((row) => [row.source, row.region, row.cost, row.draw, row.variant])

describe('the sources a Search can draw from (R-5.1.1)', () => {
    it('lists the world deck and the pawn’s region’s pile with their prices and draws', () => {
        expect(read(searchRows(board(), 'p1', [], []))).toEqual([
            [SearchSource.WorldDeck, undefined, 2, 3, undefined],
            [SearchSource.Discard, Region.Cradle, 2, 3, undefined]
        ])
    })

    it('prices the world deck at 2 for the Darkest Secret’s holder where the track says 3', () => {
        const track = board({}, {}, { visionsDrawn: 1 })
        const holder = board(
            {},
            {},
            { visionsDrawn: 1, banners: testBanners({ [Banner.DarkestSecret]: 'p1' }) }
        )
        expect(read(searchRows(track, 'p1', [], []))[0]).toEqual([
            SearchSource.WorldDeck,
            undefined,
            3,
            3,
            undefined
        ])
        expect(read(searchRows(holder, 'p1', [], []))[0]).toEqual([
            SearchSource.WorldDeck,
            undefined,
            2,
            3,
            undefined
        ])
    })

    it('leaves out an empty pile', () => {
        expect(read(searchRows(board({ cradle: 0 }), 'p1', [], []))).toEqual([
            [SearchSource.WorldDeck, undefined, 2, 3, undefined]
        ])
    })

    it('lists each other pile a declared modifier may name, leaving out the empty ones (R-7.4)', () => {
        const s = board({ cradle: 0, provinces: 3, hinterland: 0 }, { c1: [OBSERVATORY] })
        const variants = variantsOf(observatory, [Region.Provinces, Region.Hinterland])
        // The world deck is no pile Observatory names, so it is listed and sent without it (R-7.4).
        const rows = searchRows(s, 'p1', [observatory(Region.Cradle)], variants)
        expect(read(rows)).toEqual([
            [SearchSource.WorldDeck, undefined, 2, 3, undefined],
            [SearchSource.Discard, Region.Provinces, 2, 3, 0]
        ])
        expect(rows.map((row) => row.modifiers)).toEqual([[], [observatory(Region.Provinces)]])
        expect(rows.map((row) => row.cardCost)).toEqual([undefined, variants[0]?.cost])
    })

    it('keeps the seat’s own pile with Errand Boy in use, sent without it; each other pile carries its cost', () => {
        const s = testState(
            [
                testPlayer({
                    playerId: 'p1',
                    color: Color.Red,
                    siteId: 'c1',
                    favor: 2,
                    supply: 5,
                    advisers: [{ cardId: ERRAND_BOY, faceUp: true }]
                })
            ],
            {
                denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
                siteCards: {
                    c1: 'site.plains',
                    c2: 'site.river',
                    p1: 'site.marshes',
                    h1: 'site.mountain'
                },
                discardPileCounts: { cradle: 4, provinces: 3, hinterland: 2 }
            }
        )
        openTurn(s, 'p1')
        const variants = variantsOf(errandBoyAt, [Region.Provinces, Region.Hinterland])
        const rows = searchRows(s, 'p1', [errandBoyAt()], variants)
        expect(read(rows)).toEqual([
            [SearchSource.WorldDeck, undefined, 2, 3, undefined],
            [SearchSource.Discard, Region.Cradle, 2, 3, undefined],
            [SearchSource.Discard, Region.Provinces, 2, 3, 0],
            [SearchSource.Discard, Region.Hinterland, 2, 3, 1]
        ])
        expect(rows.map((row) => row.modifiers)).toEqual([
            [],
            [],
            [errandBoyAt(Region.Provinces)],
            [errandBoyAt(Region.Hinterland)]
        ])
        expect(rows.map((row) => row.cardCost?.placeFavor)).toEqual([undefined, undefined, 1, 1])
    })
})

describe('the Marshes with Mushrooms (R-11.11-H1)', () => {
    const MUSHROOMS = 'denizen.beast.mushrooms'
    const mushrooms: ModifierUse = {
        cardId: MUSHROOMS,
        powerIndex: powerIndexOf(MUSHROOMS, PowerTiming.Modifier)
    }
    const table = (oathRevision: number) => {
        const s = testState(
            [
                testPlayer({
                    playerId: 'p1',
                    color: Color.Red,
                    siteId: 'c1',
                    favor: 2,
                    secrets: 2,
                    supply: 5,
                    advisers: [{ cardId: MUSHROOMS, faceUp: true }]
                }),
                // A facedown adviser, so the seat's own view lacks something the server holds.
                testPlayer({
                    playerId: 'p2',
                    color: Color.Blue,
                    siteId: 'c2',
                    favor: 2,
                    secrets: 2,
                    advisers: [{ cardId: ERRAND_BOY, faceUp: false }]
                })
            ],
            {
                oathRevision,
                denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
                siteCards: {
                    c1: 'site.marshes',
                    c2: 'site.river',
                    p1: 'site.plains',
                    h1: 'site.mountain'
                },
                discardPileCounts: { cradle: 4, provinces: 0, hinterland: 0 }
            }
        )
        openTurn(s, 'p1')
        return s
    }
    const ownView = (s: HydratedOathGameState) =>
        new HydratedOathGameState(served(s, { kind: 'player', playerId: 'p1' }))

    it('drops the pile row Mushrooms alone would draw nothing from, the same on the seat’s own view', () => {
        const s = table(OathRevision.EngineFixes12)
        const expected = [[SearchSource.WorldDeck, undefined, 2, 2, undefined]]
        expect(read(searchRows(s, 'p1', [mushrooms], []))).toEqual(expected)
        expect(read(searchRows(ownView(s), 'p1', [mushrooms], []))).toEqual(expected)
        // Without Mushrooms the pile row stays, one card fewer.
        expect(read(searchRows(ownView(s), 'p1', [], []))).toEqual([
            [SearchSource.WorldDeck, undefined, 2, 2, undefined],
            [SearchSource.Discard, Region.Cradle, 2, 2, undefined]
        ])
    })

    it('R-X.4 — before revision 16 the pile row draws one', () => {
        const s = table(OathRevision.EngineFixes11)
        const expected = [
            [SearchSource.WorldDeck, undefined, 2, 2, undefined],
            [SearchSource.Discard, Region.Cradle, 0, 1, undefined]
        ]
        expect(read(searchRows(s, 'p1', [mushrooms], []))).toEqual(expected)
        expect(read(searchRows(ownView(s), 'p1', [mushrooms], []))).toEqual(expected)
    })
})
