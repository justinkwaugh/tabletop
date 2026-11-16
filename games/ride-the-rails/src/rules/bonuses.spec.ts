import { describe, expect, it } from 'vitest'
import { BONUSES } from '../data/bonuses.js'
import { hexIdAt, type HexId } from '../data/hexes.js'
import { RAILROAD_IDS, type RailroadId } from '../data/railroads.js'
import { adjacentHexIds, isUsaHex, USA_CITIES, type City } from '../data/usaMap.js'
import { PhaseName } from '../definition/phases.js'
import type {
    HydratedRideTheRailsGameState,
    Track,
    TranscontinentalClaim
} from '../model/gameState.js'
import type { Shares } from '../model/playerState.js'
import { buildState } from '../testing/fixtures.js'
import { BONUS_RULES, placementBonuses, type BonusPayment } from './bonuses.js'
import { placementTest } from './placement.js'

const CHICAGO: HexId = 'hex.usa.5-43'
const NEXT_TO_CHICAGO: HexId = 'hex.usa.5-41'
const KANSAS_CITY: HexId = 'hex.usa.8-32'
const DENVER: HexId = 'hex.usa.8-22'
const NEW_YORK: HexId = 'hex.usa.6-60'
const PHILADELPHIA: HexId = 'hex.usa.7-57'
const BALTIMORE: HexId = 'hex.usa.9-55'
const SAN_FRANCISCO: HexId = 'hex.usa.9-5'

const FIVE_DOLLAR_CITIES = USA_CITIES.filter((city) => city.bonus === 'bonus.usa.five-dollar')

const EVERY_SHARE: Shares = Object.fromEntries(RAILROAD_IDS.map((railroadId) => [railroadId, 1]))

type Setup = {
    track?: Track
    transcontinental?: TranscontinentalClaim
}

function building({ track = {}, transcontinental }: Setup): HydratedRideTheRailsGameState {
    return buildState({
        round: 6,
        phase: PhaseName.Build,
        shares: { p1: EVERY_SHARE },
        track,
        transcontinental
    })
}

type Placed = { isStart: boolean; bonuses: BonusPayment[] }

// The placement must pass the placement test (R-4.1, R-4.2) before its bonuses are read.
function place(setup: Setup, railroadId: RailroadId, hexId: HexId): Placed {
    const state = building(setup)
    const verdict = placementTest(state, 'p1', railroadId, hexId)
    if (!verdict.legal) {
        throw new Error(`${railroadId} may not be placed in ${hexId}: ${verdict.reason}`)
    }
    const placement = { railroadId, hexId, isStart: verdict.isStart }
    return {
        isStart: verdict.isStart,
        bonuses: placementBonuses(state.mapId, placement, state.track, state.transcontinental)
    }
}

function row(rowNumber: number, fromDcol: number, toDcol: number): HexId[] {
    const hexIds: HexId[] = []
    for (let dcol = fromDcol; dcol <= toDcol; dcol += 2) {
        const hexId = hexIdAt({ row: rowNumber, dcol })
        expect(isUsaHex(hexId)).toBe(true)
        hexIds.push(hexId)
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

function neighbourOf(city: City): HexId {
    const [hexId] = adjacentHexIds(city.hexId)
    return hexId
}

const CHICAGO_PAYMENT = { bonusId: 'bonus.usa.chicago', amount: 2, cityId: 'city.usa.chicago' }

function fiveDollars(city: City): BonusPayment {
    return { bonusId: 'bonus.usa.five-dollar', amount: 5, cityId: city.id }
}

function transcontinental(amount: number): BonusPayment {
    return { bonusId: 'bonus.usa.transcontinental', amount }
}

describe('the bonus table (R-4.3, R-8)', () => {
    it('keys the USA bonuses by map, in the order they are evaluated (R-3.2.5)', () => {
        expect(BONUS_RULES['map.usa'].map((rule) => rule.bonus)).toEqual(BONUSES['map.usa'])
        expect(BONUS_RULES['map.usa'].map((rule) => rule.bonus.id)).toEqual([
            'bonus.usa.chicago',
            'bonus.usa.five-dollar',
            'bonus.usa.transcontinental'
        ])
    })

    it('pays nothing for a placement in a plain hex', () => {
        const track = trackOf(['railroad.red', [NEXT_TO_CHICAGO]])
        expect(place({ track }, 'railroad.red', 'hex.usa.5-39')).toEqual({
            isStart: false,
            bonuses: []
        })
    })

    it('pays a $5 city before the Transcontinental the same placement completes', () => {
        const track = trackOf(
            ['railroad.purple', row(9, 5, 29)],
            ['railroad.red', [...row(9, 29, 29), 'hex.usa.8-30', 'hex.usa.8-34', ...row(9, 35, 55)]]
        )
        const [kansasCity] = FIVE_DOLLAR_CITIES.filter((city) => city.hexId === KANSAS_CITY)
        expect(place({ track }, 'railroad.red', KANSAS_CITY).bonuses).toEqual([
            fiveDollars(kansasCity),
            transcontinental(8)
        ])
    })
})

describe('Chicago (R-4.3.1)', () => {
    it.each(['railroad.orange', 'railroad.yellow', 'railroad.black'] as const)(
        'pays $2 for the start of %s there',
        (railroadId) => {
            expect(place({}, railroadId, CHICAGO)).toEqual({
                isStart: true,
                bonuses: [CHICAGO_PAYMENT]
            })
        }
    )

    it.each(RAILROAD_IDS)('pays $2 when %s builds in from an adjacent hex', (railroadId) => {
        const track = trackOf([railroadId, [NEXT_TO_CHICAGO]])
        expect(place({ track }, railroadId, CHICAGO)).toEqual({
            isStart: false,
            bonuses: [CHICAGO_PAYMENT]
        })
    })

    it('pays $2 for every placement, however many locomotives Chicago holds', () => {
        const track = trackOf(
            ['railroad.red', [CHICAGO]],
            ['railroad.blue', [CHICAGO]],
            ['railroad.orange', [CHICAGO]],
            ['railroad.black', [NEXT_TO_CHICAGO]]
        )
        expect(place({ track }, 'railroad.black', CHICAGO).bonuses).toEqual([CHICAGO_PAYMENT])
    })
})

describe('$5 cities (R-4.3.2)', () => {
    it('has the four $5 cities', () => {
        expect(FIVE_DOLLAR_CITIES.map((city) => city.id)).toEqual([
            'city.usa.minneapolis',
            'city.usa.denver',
            'city.usa.kansas-city',
            'city.usa.dallas'
        ])
    })

    describe.each(FIVE_DOLLAR_CITIES)('$name', (city) => {
        it.each(RAILROAD_IDS)('pays $5 when %s is the first to build in', (railroadId) => {
            const track = trackOf([railroadId, [neighbourOf(city)]])
            expect(place({ track }, railroadId, city.hexId)).toEqual({
                isStart: false,
                bonuses: [fiveDollars(city)]
            })
        })

        it('pays nothing to a railroad that starts there', () => {
            expect(place({}, 'railroad.black', city.hexId)).toEqual({ isStart: true, bonuses: [] })
        })

        it('pays nothing to a railroad building in after a start there', () => {
            const track = trackOf(
                ['railroad.black', [city.hexId]],
                ['railroad.red', [neighbourOf(city)]]
            )
            expect(place({ track }, 'railroad.red', city.hexId).bonuses).toEqual([])
        })

        it('pays nothing to a second railroad building in', () => {
            const track = trackOf(
                ['railroad.blue', [city.hexId]],
                ['railroad.red', [neighbourOf(city)]]
            )
            expect(place({ track }, 'railroad.red', city.hexId).bonuses).toEqual([])
        })
    })

    it('pays nothing to Yellow’s western start in a $5 city that holds a locomotive', () => {
        const track = trackOf(
            ['railroad.black', [DENVER]],
            ['railroad.red', [NEW_YORK]],
            ['railroad.blue', [PHILADELPHIA]]
        )
        expect(place({ track }, 'railroad.yellow', DENVER)).toEqual({
            isStart: true,
            bonuses: []
        })
    })
})

describe('the Transcontinental (R-4.3.3)', () => {
    it('pays $12 when the railroads join in a city hex', () => {
        const track = trackOf(
            ['railroad.purple', [...row(9, 5, 31), KANSAS_CITY]],
            ['railroad.red', row(9, 33, 55)]
        )
        expect(place({ track }, 'railroad.red', KANSAS_CITY).bonuses).toEqual([
            transcontinental(12)
        ])
    })

    it('pays $8 when the railroads join in another hex', () => {
        const track = trackOf(['railroad.purple', row(9, 5, 31)], ['railroad.red', row(9, 33, 55)])
        expect(place({ track }, 'railroad.red', 'hex.usa.9-31').bonuses).toEqual([
            transcontinental(8)
        ])
    })

    it('pays $12 when some line it completes changes railroad only in cities, whatever this placement joins', () => {
        const track = trackOf(
            ['railroad.purple', [...row(9, 5, 31), KANSAS_CITY, 'hex.usa.9-33']],
            ['railroad.red', [KANSAS_CITY, ...row(9, 35, 55)]]
        )
        expect(place({ track }, 'railroad.red', 'hex.usa.9-33').bonuses).toEqual([
            transcontinental(12)
        ])
    })

    it('pays $8 when the line also changes railroad outside a city, though this placement joins in one', () => {
        const track = trackOf(
            ['railroad.purple', row(9, 5, 29)],
            ['railroad.blue', row(9, 29, 31)],
            ['railroad.red', [KANSAS_CITY, ...row(9, 33, 55)]]
        )
        expect(place({ track }, 'railroad.blue', KANSAS_CITY).bonuses).toEqual([
            transcontinental(8)
        ])
    })

    it('pays nothing for one railroad alone coast to coast', () => {
        const track = trackOf(['railroad.purple', row(9, 5, 53)])
        expect(place({ track }, 'railroad.purple', BALTIMORE).bonuses).toEqual([])
    })

    it('pays nothing to a railroad that only shares the West Coast city', () => {
        const track = trackOf(['railroad.purple', row(9, 5, 55)])
        expect(place({ track }, 'railroad.black', SAN_FRANCISCO)).toEqual({
            isStart: true,
            bonuses: []
        })
    })

    it('pays nothing when locomotives of different railroads are only adjacent', () => {
        const track = trackOf(['railroad.purple', row(9, 5, 29)], ['railroad.red', row(9, 33, 55)])
        expect(place({ track }, 'railroad.purple', 'hex.usa.9-31').bonuses).toEqual([])
    })

    it('pays nothing once it has been paid', () => {
        const track = trackOf(['railroad.purple', row(9, 5, 31)], ['railroad.red', row(9, 33, 55)])
        const claim = { playerId: 'p2', amount: 8 }
        expect(
            place({ track, transcontinental: claim }, 'railroad.red', 'hex.usa.9-31').bonuses
        ).toEqual([])
    })

    it('pays nothing for a placement made after a line exists', () => {
        const track = trackOf(['railroad.purple', row(9, 5, 31)], ['railroad.red', row(9, 31, 55)])
        expect(place({ track }, 'railroad.red', 'hex.usa.8-34').bonuses).toEqual([])
    })
})
