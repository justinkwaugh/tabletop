import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    PhaseName,
    RAILROAD_IDS,
    USA_CITIES,
    USA_HEXES,
    adjacentHexIds,
    hexIdAt,
    isEastCoastCity,
    legalPlacements,
    usaHex,
    type HexId,
    type RailroadId,
    type Shares,
    type Track
} from '@tabletop/ride-the-rails'
import { buildState, type StateRecipe } from '@tabletop/ride-the-rails/testing'
import { EMPTY_BOARD_OFFER, boardOffer, placementOffer, type OfferedHex } from './boardOffer.js'

const NEW_YORK: HexId = 'hex.usa.6-60'
const PHILADELPHIA: HexId = 'hex.usa.7-57'
const CHICAGO: HexId = 'hex.usa.5-43'
const NEXT_TO_CHICAGO: HexId = 'hex.usa.5-41'
const KANSAS_CITY: HexId = 'hex.usa.8-32'

const EVERY_SHARE: Shares = Object.fromEntries(RAILROAD_IDS.map((railroadId) => [railroadId, 1]))

function building(recipe: StateRecipe = {}) {
    return buildState({ phase: PhaseName.Build, ...recipe })
}

function holding(...railroadIds: RailroadId[]): Shares {
    return Object.fromEntries(railroadIds.map((railroadId) => [railroadId, 1]))
}

function row(rowNumber: number, fromDcol: number, toDcol: number): HexId[] {
    const hexIds: HexId[] = []
    for (let dcol = fromDcol; dcol <= toDcol; dcol += 2) {
        hexIds.push(hexIdAt({ row: rowNumber, dcol }))
    }
    return hexIds
}

function trackOf(...runs: [RailroadId, HexId[]][]): Track {
    const track: Track = {}
    for (const [railroadId, hexIds] of runs) {
        for (const hexId of hexIds) {
            track[hexId] = [...(track[hexId] ?? []), railroadId]
        }
    }
    return track
}

function offeredAt(offered: readonly OfferedHex[], hexId: HexId): OfferedHex | undefined {
    return offered.find((hex) => hex.hexId === hexId)
}

function found<T>(value: T | undefined, what: string): T {
    assertExists(value, `No ${what}`)
    return value
}

const MOUNTAIN = found(
    USA_HEXES.find((hex) => hex.terrain === 'mountain'),
    'mountain hex'
).id
const PLAIN_BESIDE_MOUNTAIN = found(
    adjacentHexIds(MOUNTAIN).find((adjacent) => usaHex(adjacent).terrain === 'plain'),
    'plain hex beside the mountain'
)

describe('the placement offer (R-3.2, R-4.1, R-4.2)', () => {
    it('lights exactly the legal placements, each hex once with a pip per railroad', () => {
        const state = building({
            round: 5,
            shares: { p1: EVERY_SHARE },
            track: trackOf(['railroad.red', [NEW_YORK]], ['railroad.blue', [PHILADELPHIA]])
        })
        const offered = placementOffer(state, 'p1')
        const fromOffer = offered.flatMap((hex) =>
            hex.placements.map(({ railroadId, isStart }) => ({
                railroadId,
                hexId: hex.hexId,
                isStart
            }))
        )
        const byKey = (placement: { railroadId: string; hexId: string }) =>
            `${placement.railroadId} ${placement.hexId}`
        expect(fromOffer.map(byKey).sort()).toEqual(legalPlacements(state, 'p1').map(byKey).sort())
        expect(new Set(offered.map((hex) => hex.hexId)).size).toBe(offered.length)
        for (const hex of offered) {
            const railroadIds = hex.placements.map((placement) => placement.railroadId)
            expect(railroadIds).toEqual(RAILROAD_IDS.filter((id) => railroadIds.includes(id)))
        }
    })

    it('lights the six East Coast cities with hollow Red pips for a first Red placement (R-4.2.1)', () => {
        const offered = placementOffer(building({ shares: { p1: holding('railroad.red') } }), 'p1')
        const eastCoast = USA_CITIES.filter(isEastCoastCity).map((city) => city.hexId)
        expect(offered.map((hex) => hex.hexId).sort()).toEqual([...eastCoast].sort())
        for (const hex of offered) {
            expect(hex.placements).toEqual([
                { railroadId: 'railroad.red', isStart: true, bonuses: [] }
            ])
            expect(hex.startOnly).toBe(true)
        }
    })

    it('leaves an East Coast city another railroad holds unlit (R-4.1.4)', () => {
        const state = building({
            shares: { p1: holding('railroad.red') },
            track: trackOf(['railroad.blue', [PHILADELPHIA]])
        })
        expect(offeredAt(placementOffer(state, 'p1'), PHILADELPHIA)).toBeUndefined()
    })

    it('gives the start ring only where every placement is a start (R-4.2.5)', () => {
        const state = building({
            round: 5,
            shares: { p1: holding('railroad.red', 'railroad.black') },
            track: trackOf(['railroad.red', [NEXT_TO_CHICAGO]])
        })
        const offered = placementOffer(state, 'p1')
        const chicago = offeredAt(offered, CHICAGO)
        expect(chicago?.placements.map(({ railroadId, isStart }) => [railroadId, isStart])).toEqual(
            [
                ['railroad.red', false],
                ['railroad.black', true]
            ]
        )
        expect(chicago?.startOnly).toBe(false)
        const startOnly = offered.filter((hex) => hex.startOnly)
        expect(startOnly.length).toBeGreaterThan(40)
        for (const hex of startOnly) {
            expect(hex.placements).toEqual([
                expect.objectContaining({ railroadId: 'railroad.black', isStart: true })
            ])
        }
    })
})

describe('the marks (R-4.3, R-3.2.4)', () => {
    it('marks Chicago with $2 (R-4.3.1)', () => {
        const state = building({
            shares: { p1: holding('railroad.red') },
            track: trackOf(['railroad.red', [NEXT_TO_CHICAGO]])
        })
        expect(offeredAt(placementOffer(state, 'p1'), CHICAGO)?.marks).toEqual([
            { kind: 'bonus', bonusId: 'bonus.usa.chicago', amount: 2 }
        ])
    })

    it('marks an empty $5 city when some placement there earns it, and a start there pays nothing (R-4.3.2)', () => {
        const [besideKansasCity] = adjacentHexIds(KANSAS_CITY)
        const state = building({
            round: 5,
            shares: { p1: holding('railroad.red', 'railroad.black') },
            track: trackOf(['railroad.red', [besideKansasCity]])
        })
        const kansasCity = offeredAt(placementOffer(state, 'p1'), KANSAS_CITY)
        expect(kansasCity?.marks).toEqual([
            { kind: 'bonus', bonusId: 'bonus.usa.five-dollar', amount: 5 }
        ])
        expect(kansasCity?.placements).toEqual([
            {
                railroadId: 'railroad.red',
                isStart: false,
                bonuses: [
                    { bonusId: 'bonus.usa.five-dollar', amount: 5, cityId: 'city.usa.kansas-city' }
                ]
            },
            { railroadId: 'railroad.black', isStart: true, bonuses: [] }
        ])

        const blackOnly = building({ round: 5, shares: { p1: holding('railroad.black') } })
        expect(offeredAt(placementOffer(blackOnly, 'p1'), KANSAS_CITY)?.marks).toEqual([])
    })

    it('marks a hex completing the Transcontinental with $12 in a city and $8 elsewhere (R-4.3.3)', () => {
        const atCity = building({
            round: 6,
            shares: { p1: EVERY_SHARE },
            track: trackOf(
                ['railroad.purple', [...row(9, 5, 31), KANSAS_CITY]],
                ['railroad.red', row(9, 33, 55)]
            )
        })
        expect(offeredAt(placementOffer(atCity, 'p1'), KANSAS_CITY)?.marks).toContainEqual({
            kind: 'bonus',
            bonusId: 'bonus.usa.transcontinental',
            amount: 12
        })

        const elsewhere = building({
            round: 6,
            shares: { p1: EVERY_SHARE },
            track: trackOf(['railroad.purple', row(9, 5, 31)], ['railroad.red', row(9, 33, 55)])
        })
        expect(offeredAt(placementOffer(elsewhere, 'p1'), 'hex.usa.9-31')?.marks).toEqual([
            { kind: 'bonus', bonusId: 'bonus.usa.transcontinental', amount: 8 }
        ])

        const claimed = building({
            round: 6,
            shares: { p1: EVERY_SHARE },
            track: trackOf(['railroad.purple', row(9, 5, 31)], ['railroad.red', row(9, 33, 55)]),
            transcontinental: { playerId: 'p2', amount: 8 }
        })
        expect(offeredAt(placementOffer(claimed, 'p1'), 'hex.usa.9-31')?.marks).toEqual([])
    })

    it('marks a mountain −1 until a mountain is used this turn (R-3.2.4)', () => {
        const recipe: StateRecipe = {
            shares: { p1: holding('railroad.red') },
            track: trackOf(['railroad.red', [PLAIN_BESIDE_MOUNTAIN]])
        }
        const fresh = offeredAt(placementOffer(building(recipe), 'p1'), MOUNTAIN)
        expect(fresh?.marks).toEqual([{ kind: 'placement-limit', change: -1 }])

        const used = building({ ...recipe, building: { placed: 1, usedMountain: true } })
        expect(offeredAt(placementOffer(used, 'p1'), MOUNTAIN)?.marks).toEqual([])
    })

    it('lights no mountain when only one placement is left before the limit (R-3.2.3, R-3.2.4)', () => {
        const state = building({
            playerCount: 4,
            shares: { p1: holding('railroad.red') },
            track: trackOf(['railroad.red', [PLAIN_BESIDE_MOUNTAIN]]),
            building: { placed: 4, usedMountain: false }
        })
        const offered = placementOffer(state, 'p1')
        expect(offeredAt(offered, MOUNTAIN)).toBeUndefined()
        expect(offered.some((hex) => usaHex(hex.hexId).terrain === 'plain')).toBe(true)
    })
})

describe('the board offer', () => {
    const state = building({
        shares: { p1: holding('railroad.red', 'railroad.blue') },
        track: trackOf(['railroad.red', [NEW_YORK]], ['railroad.blue', [PHILADELPHIA]])
    })
    const offered = placementOffer(state, 'p1')
    const shared = found(
        offered.find((hex) => hex.placements.length > 1),
        'hex two railroads may enter'
    )
    const single = found(
        offered.find((hex) => hex.placements.length === 1),
        'hex one railroad may enter'
    )

    it('cuts a hole in the scrim for every lit hex', () => {
        const offer = boardOffer(state, offered, undefined)
        expect(offer.lit).toBe(offered)
        expect(offer.scrim?.holes).toEqual(offered.map((hex) => hex.hexId))
        expect(offer.popup).toBeUndefined()
    })

    it('opens the railroad popup on a picked hex two railroads may enter, with each supply left', () => {
        const offer = boardOffer(state, offered, shared.hexId)
        expect(offer.popup).toEqual({
            hexId: shared.hexId,
            chips: [
                { railroadId: 'railroad.red', isStart: false, bonuses: [], supplyLeft: 25 },
                { railroadId: 'railroad.blue', isStart: false, bonuses: [], supplyLeft: 25 }
            ],
            lowersLimit: false
        })
    })

    it('says when the picked hex lowers the turn’s limit, from its mountain mark (R-3.2.4)', () => {
        const mountain = {
            ...shared,
            marks: [{ kind: 'placement-limit' as const, change: -1 }]
        }
        expect(boardOffer(state, [mountain], mountain.hexId).popup?.lowersLimit).toBe(true)
    })

    it('opens no popup on a hex only one railroad may enter', () => {
        expect(boardOffer(state, offered, single.hexId).popup).toBeUndefined()
    })

    it('is empty, with no scrim, when nothing is offered', () => {
        expect(boardOffer(state, [], shared.hexId)).toEqual(EMPTY_BOARD_OFFER)
    })
})
