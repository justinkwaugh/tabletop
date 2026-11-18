import { describe, expect, it } from 'vitest'
import { BONUSES } from '../data/bonuses.js'
import { hexIdAt, type HexId } from '../data/hexes.js'
import { RAILROAD_IDS, type RailroadId } from '../data/railroads.js'
import type { City } from '../data/boardMap.js'
import { adjacentHexIds, boardMap, isHexId } from '../data/boardMaps.js'
import type { MapId } from '../data/maps.js'
import { USA_CITIES } from '../data/usaMap.js'
import { PhaseName } from '../definition/phases.js'
import type {
    HydratedRideTheRailsGameState,
    Track,
    TranscontinentalClaim
} from '../model/gameState.js'
import type { Shares } from '../model/playerState.js'
import { buildState } from '../testing/fixtures.js'
import { greaterGermanyOneShort } from '../testing/greaterGermany.js'
import { intercolonialOneShort, WINDSOR } from '../testing/intercolonial.js'
import {
    ALPHA,
    ALPHA_HEX,
    BETA,
    BETA_HEX,
    FLAT_FIXTURE_MAP,
    GAMMA,
    GAMMA_HEX,
    MOUNTAIN_HEX
} from '../testing/flatFixtureMap.js'
import {
    BONUS_RULES,
    connectionRule,
    everyPlacementRule,
    firstPlacementRule,
    placementBonuses,
    startPricedRule,
    type BonusContext,
    type BonusPayment
} from './bonuses.js'
import { citiesConnected } from './connection.js'
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
    mapId?: MapId
    track?: Track
    transcontinental?: TranscontinentalClaim
}

function building({ mapId, track = {}, transcontinental }: Setup): HydratedRideTheRailsGameState {
    return buildState({
        mapId,
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
        bonuses: placementBonuses(
            state.mapId,
            placement,
            state.track,
            state.transcontinental,
            state.connectionClaim
        )
    }
}

function row(rowNumber: number, fromDcol: number, toDcol: number): HexId[] {
    const hexIds: HexId[] = []
    for (let dcol = fromDcol; dcol <= toDcol; dcol += 2) {
        const hexId = hexIdAt({ row: rowNumber, dcol })
        expect(isHexId(hexId)).toBe(true)
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

// The factories each expansion map's bonuses are made from, tried on the flat fixture: Alpha
// prints the Chicago bonus id and Beta the $5 one, with amounts of the specs' own.
describe('bonus rule factories (R-4.3, R-8)', () => {
    function on(
        placement: { railroadId: RailroadId; hexId: HexId; isStart: boolean },
        trackBefore: Track = {},
        claims: Partial<Pick<BonusContext, 'connectionClaim'>> = {}
    ): BonusContext {
        return {
            map: FLAT_FIXTURE_MAP,
            placement,
            trackBefore,
            transcontinental: undefined,
            connectionClaim: claims.connectionClaim
        }
    }

    describe('every placement, a start included (Chicago, R-4.3.1)', () => {
        const rule = everyPlacementRule({
            id: 'bonus.usa.chicago',
            printedName: 'Alpha',
            amount: 3
        })

        it('pays each placement in the city, a start and a second railroad included', () => {
            const start = { railroadId: 'railroad.red', hexId: ALPHA_HEX, isStart: true } as const
            expect(rule.evaluate(on(start))).toEqual({
                bonusId: 'bonus.usa.chicago',
                amount: 3,
                cityId: ALPHA
            })
            const second = {
                railroadId: 'railroad.blue',
                hexId: ALPHA_HEX,
                isStart: false
            } as const
            expect(rule.evaluate(on(second, { [ALPHA_HEX]: ['railroad.red'] }))?.amount).toBe(3)
        })

        it('pays nothing outside the city', () => {
            const placement = {
                railroadId: 'railroad.red',
                hexId: BETA_HEX,
                isStart: false
            } as const
            expect(rule.evaluate(on(placement))).toBe(undefined)
        })
    })

    describe('first placement (the $5 cities, R-4.3.2)', () => {
        const rule = firstPlacementRule({
            id: 'bonus.usa.five-dollar',
            printedName: 'Beta',
            amount: 20
        })

        it('pays the first locomotive in the city', () => {
            const placement = {
                railroadId: 'railroad.red',
                hexId: BETA_HEX,
                isStart: false
            } as const
            expect(rule.evaluate(on(placement))).toEqual({
                bonusId: 'bonus.usa.five-dollar',
                amount: 20,
                cityId: BETA
            })
        })

        it('pays nothing once the city holds a locomotive, and nothing for a start, which uses it up', () => {
            const later = { railroadId: 'railroad.red', hexId: BETA_HEX, isStart: false } as const
            expect(rule.evaluate(on(later, { [BETA_HEX]: ['railroad.blue'] }))).toBe(undefined)
            const start = { railroadId: 'railroad.blue', hexId: BETA_HEX, isStart: true } as const
            expect(rule.evaluate(on(start))).toBe(undefined)
        })
    })

    describe('start-priced (Toronto)', () => {
        const rule = startPricedRule({
            id: 'bonus.usa.chicago',
            printedName: 'Alpha',
            startAmount: 2,
            buildInAmount: 3
        })

        it('pays the start price for a railroad’s first locomotive there, the build-in price for every other', () => {
            const start = { railroadId: 'railroad.red', hexId: ALPHA_HEX, isStart: true } as const
            expect(rule.evaluate(on(start))).toEqual({
                bonusId: 'bonus.usa.chicago',
                amount: 2,
                cityId: ALPHA
            })
            const buildIn = {
                railroadId: 'railroad.blue',
                hexId: ALPHA_HEX,
                isStart: false
            } as const
            expect(rule.evaluate(on(buildIn, { [ALPHA_HEX]: ['railroad.red'] }))?.amount).toBe(3)
        })

        it('pays nothing outside the city', () => {
            const placement = {
                railroadId: 'railroad.red',
                hexId: GAMMA_HEX,
                isStart: false
            } as const
            expect(rule.evaluate(on(placement))).toBe(undefined)
        })
    })

    describe('connection (Intercolonial, Greater Germany)', () => {
        const rule = connectionRule({
            id: 'bonus.usa.transcontinental',
            printedName: 'Alpha to Gamma',
            amount: 8,
            cityIds: [ALPHA, BETA, GAMMA]
        })
        // Red from Alpha to Beta; Blue from Beta, its last locomotive going into Gamma.
        const before: Track = {
            [ALPHA_HEX]: ['railroad.red'],
            [MOUNTAIN_HEX]: ['railroad.red'],
            'hex.usa.2-2': ['railroad.red'],
            [BETA_HEX]: ['railroad.red', 'railroad.blue']
        }
        const completing = {
            railroadId: 'railroad.blue',
            hexId: GAMMA_HEX,
            isStart: false
        } as const

        it('pays the placement after which the named cities are one network, once', () => {
            expect(rule.claims).toBe('connection')
            expect(rule.evaluate(on(completing, before))).toEqual({
                bonusId: 'bonus.usa.transcontinental',
                amount: 8
            })
        })

        it('pays nothing once claimed', () => {
            const claimed = on(completing, before, {
                connectionClaim: { playerId: 'p2' }
            })
            expect(rule.evaluate(claimed)).toBe(undefined)
        })

        it('pays nothing while a named city is still apart, or for a placement after the network exists', () => {
            const elsewhere = {
                railroadId: 'railroad.red',
                hexId: 'hex.usa.0-0',
                isStart: false
            } as const
            expect(rule.evaluate(on(elsewhere, before))).toBe(undefined)
            const after: Track = { ...before, [GAMMA_HEX]: ['railroad.blue'] }
            expect(rule.evaluate(on(elsewhere, after))).toBe(undefined)
        })
    })
})

describe('Australia (R-8.2)', () => {
    const PERTH: HexId = 'hex.au.0-12'
    const BRISBANE: HexId = 'hex.au.34-6'
    const PERTH_CHAIN_END: HexId = 'hex.au.1-13'
    const BRISBANE_CHAIN_END: HexId = 'hex.au.34-8'
    const PERTH_PAYMENT = { bonusId: 'bonus.au.perth', amount: 50, cityId: 'city.au.perth' }
    const BRISBANE_PAYMENT = {
        bonusId: 'bonus.au.brisbane',
        amount: 20,
        cityId: 'city.au.brisbane'
    }

    it('lists Perth and Brisbane, and no Transcontinental', () => {
        expect(BONUS_RULES['map.au'].map((rule) => rule.bonus)).toEqual(BONUSES['map.au'])
        expect(BONUSES['map.au']).toEqual([
            { id: 'bonus.au.perth', printedName: 'Perth', amount: 50 },
            { id: 'bonus.au.brisbane', printedName: 'Brisbane', amount: 20 }
        ])
    })

    it('pays $50 for building into Perth and $20 into Brisbane', () => {
        const track = trackOf(
            ['railroad.orange', [PERTH_CHAIN_END]],
            ['railroad.red', [BRISBANE_CHAIN_END]]
        )
        expect(place({ mapId: 'map.au', track }, 'railroad.orange', PERTH)).toEqual({
            isStart: false,
            bonuses: [PERTH_PAYMENT]
        })
        expect(place({ mapId: 'map.au', track }, 'railroad.red', BRISBANE)).toEqual({
            isStart: false,
            bonuses: [BRISBANE_PAYMENT]
        })
    })

    it('pays no start there: no railroad starts in Perth or Brisbane, Black included', () => {
        const state = building({ mapId: 'map.au' })
        for (const hexId of [PERTH, BRISBANE]) {
            expect(placementTest(state, 'p1', 'railroad.black', hexId), hexId).toEqual({
                legal: false,
                reason: 'not-adjacent-or-start'
            })
        }
    })

    it('pays each once: Perth and Brisbane hold one locomotive', () => {
        const track = trackOf(
            ['railroad.orange', [PERTH_CHAIN_END, PERTH]],
            ['railroad.red', [BRISBANE_CHAIN_END, BRISBANE]]
        )
        const state = building({ mapId: 'map.au', track })
        expect(placementTest(state, 'p1', 'railroad.black', PERTH)).toEqual({
            legal: false,
            reason: 'hex-at-capacity'
        })
        expect(placementTest(state, 'p1', 'railroad.black', BRISBANE)).toEqual({
            legal: false,
            reason: 'hex-at-capacity'
        })
    })

    it('pays nothing for a placement in another city', () => {
        expect(place({ mapId: 'map.au' }, 'railroad.red', 'hex.au.31-15').bonuses).toEqual([])
    })
})

describe('Canada (R-8.3)', () => {
    const TORONTO: HexId = 'hex.ca.11-21'
    const NORTH_OF_TORONTO: HexId = 'hex.ca.11-19'
    const INTERCOLONIAL = { bonusId: 'bonus.ca.intercolonial', amount: 8 }

    function toronto(amount: number): BonusPayment {
        return { bonusId: 'bonus.ca.toronto', amount, cityId: 'city.ca.toronto' }
    }

    it('lists Toronto and the Intercolonial, and no Transcontinental', () => {
        expect(BONUS_RULES['map.ca'].map((rule) => rule.bonus)).toEqual(BONUSES['map.ca'])
        expect(BONUSES['map.ca']).toEqual([
            { id: 'bonus.ca.toronto', printedName: 'Toronto', startAmount: 2, buildInAmount: 3 },
            {
                id: 'bonus.ca.intercolonial',
                printedName: 'Intercolonial',
                amount: 8,
                cityIds: ['city.ca.sault-ste-marie', 'city.ca.windsor', 'city.ca.quebec-city']
            }
        ])
    })

    it('pays $2 for a railroad’s start in Toronto', () => {
        expect(place({ mapId: 'map.ca' }, 'railroad.purple', TORONTO)).toEqual({
            isStart: true,
            bonuses: [toronto(2)]
        })
        expect(place({ mapId: 'map.ca' }, 'railroad.black', TORONTO)).toEqual({
            isStart: true,
            bonuses: [toronto(2)]
        })
    })

    it('pays $3 for any other placement there, however many railroads it holds', () => {
        const track = trackOf(
            ['railroad.red', [NORTH_OF_TORONTO]],
            ['railroad.purple', [TORONTO]],
            ['railroad.black', [TORONTO]],
            ['railroad.blue', [TORONTO]]
        )
        expect(place({ mapId: 'map.ca', track }, 'railroad.red', TORONTO)).toEqual({
            isStart: false,
            bonuses: [toronto(3)]
        })
    })

    describe('the Intercolonial', () => {
        const { track, railroadId, hexId } = intercolonialOneShort()
        const placement = { railroadId, hexId, isStart: false }

        it('pays $8 to the placement that first joins Sault Ste. Marie, Windsor and Québec City, through links of any railroads', () => {
            expect(place({ mapId: 'map.ca', track }, railroadId, hexId)).toEqual({
                isStart: false,
                bonuses: [INTERCOLONIAL]
            })
        })

        it('pays nothing while a city is still apart', () => {
            const { [WINDSOR]: _windsor, ...apart } = track
            expect(place({ mapId: 'map.ca', track: apart }, railroadId, hexId).bonuses).toEqual([])
        })

        it('pays nothing once claimed, or for a placement after the cities are joined', () => {
            expect(
                placementBonuses('map.ca', placement, track, undefined, { playerId: 'p2' })
            ).toEqual([])
            const joined: Track = { ...track, [hexId]: [railroadId] }
            const later = { railroadId: 'railroad.blue', hexId, isStart: false } as const
            expect(placementBonuses('map.ca', later, joined, undefined, undefined)).toEqual([])
        })
    })
})

describe('France (R-8.4)', () => {
    const PARIS: HexId = 'hex.fr.13-13'
    const NORTH_OF_PARIS: HexId = 'hex.fr.13-11'
    const SOUTH_OF_PARIS: HexId = 'hex.fr.13-15'
    const PARIS_PAYMENT = { bonusId: 'bonus.fr.paris', amount: 10, cityId: 'city.fr.paris' }

    it('lists Paris, and no Transcontinental', () => {
        expect(BONUS_RULES['map.fr'].map((rule) => rule.bonus)).toEqual(BONUSES['map.fr'])
        expect(BONUSES['map.fr']).toEqual([
            { id: 'bonus.fr.paris', printedName: 'Paris', amount: 10 }
        ])
    })

    it('pays $10 for a railroad’s start in Paris', () => {
        expect(place({ mapId: 'map.fr' }, 'railroad.purple', PARIS)).toEqual({
            isStart: true,
            bonuses: [PARIS_PAYMENT]
        })
        expect(place({ mapId: 'map.fr' }, 'railroad.black', PARIS)).toEqual({
            isStart: true,
            bonuses: [PARIS_PAYMENT]
        })
    })

    it('pays $10 for every later placement there, whatever already stands in Paris', () => {
        const track = trackOf(
            ['railroad.red', [NORTH_OF_PARIS]],
            ['railroad.blue', [SOUTH_OF_PARIS]],
            ['railroad.purple', [PARIS]],
            ['railroad.black', [PARIS]]
        )
        expect(place({ mapId: 'map.fr', track }, 'railroad.red', PARIS)).toEqual({
            isStart: false,
            bonuses: [PARIS_PAYMENT]
        })
        expect(place({ mapId: 'map.fr', track }, 'railroad.blue', PARIS)).toEqual({
            isStart: false,
            bonuses: [PARIS_PAYMENT]
        })
    })

    it('pays nothing for a placement in another city or an entry hex', () => {
        expect(place({ mapId: 'map.fr' }, 'railroad.purple', 'hex.fr.18-28').bonuses).toEqual([])
        const track = trackOf(['railroad.purple', [PARIS]])
        expect(
            place({ mapId: 'map.fr', track }, 'railroad.purple', NORTH_OF_PARIS).bonuses
        ).toEqual([])
    })
})

describe('Germany (R-8.5)', () => {
    const BERLIN: HexId = 'hex.de.19-17'
    const NORTH_OF_BERLIN: HexId = 'hex.de.19-15'
    const SOUTH_EAST_OF_BERLIN: HexId = 'hex.de.21-19'
    const BERLIN_PAYMENT = { bonusId: 'bonus.de.berlin', amount: 3, cityId: 'city.de.berlin' }
    const GREATER_GERMANY = { bonusId: 'bonus.de.greater-germany', amount: 12 }

    it('lists Berlin and Greater Germany, and no Transcontinental', () => {
        expect(BONUS_RULES['map.de'].map((rule) => rule.bonus)).toEqual(BONUSES['map.de'])
        expect(BONUSES['map.de']).toEqual([
            { id: 'bonus.de.berlin', printedName: 'Berlin', amount: 3 },
            {
                id: 'bonus.de.greater-germany',
                printedName: 'Greater Germany',
                amount: 12,
                cityIds: [
                    'city.de.berlin',
                    'city.de.hamburg',
                    'city.de.koln',
                    'city.de.dresden',
                    'city.de.munchen'
                ]
            }
        ])
    })

    it('pays $3 for a railroad’s start in Berlin', () => {
        expect(place({ mapId: 'map.de' }, 'railroad.purple', BERLIN)).toEqual({
            isStart: true,
            bonuses: [BERLIN_PAYMENT]
        })
        expect(place({ mapId: 'map.de' }, 'railroad.black', BERLIN)).toEqual({
            isStart: true,
            bonuses: [BERLIN_PAYMENT]
        })
    })

    it('pays $3 for every later placement there, from beside either of its cells', () => {
        const track = trackOf(
            ['railroad.red', [NORTH_OF_BERLIN]],
            ['railroad.blue', [SOUTH_EAST_OF_BERLIN]],
            ['railroad.purple', [BERLIN]]
        )
        expect(place({ mapId: 'map.de', track }, 'railroad.red', BERLIN)).toEqual({
            isStart: false,
            bonuses: [BERLIN_PAYMENT]
        })
        expect(place({ mapId: 'map.de', track }, 'railroad.blue', BERLIN)).toEqual({
            isStart: false,
            bonuses: [BERLIN_PAYMENT]
        })
    })

    it('pays Greater Germany to the placement that joins Berlin, Hamburg, Köln, Dresden and München', () => {
        const { track, railroadId, hexId } = greaterGermanyOneShort()
        expect(place({ mapId: 'map.de', track }, railroadId, hexId).bonuses).toEqual([
            GREATER_GERMANY
        ])
    })

    it('pays nothing while any one of the five is cut off', () => {
        const { track, railroadId, hexId } = greaterGermanyOneShort()
        expect(place({ mapId: 'map.de', track }, 'railroad.black', 'hex.de.17-19').bonuses).toEqual(
            []
        )
        const withoutKoln: Track = Object.fromEntries(
            Object.entries(track).flatMap(([trackHexId, railroadIds]) => {
                const left = railroadIds.filter((id) => id !== 'railroad.red')
                return left.length > 0 ? [[trackHexId, left]] : []
            })
        )
        expect(
            citiesConnected(boardMap('map.de'), withoutKoln, ['city.de.koln', 'city.de.berlin'])
        ).toBe(false)
        expect(place({ mapId: 'map.de', track: withoutKoln }, railroadId, hexId).bonuses).toEqual(
            []
        )
    })

    it('pays it once: nothing once claimed, and nothing once the five are joined', () => {
        const { track, railroadId, hexId } = greaterGermanyOneShort()
        const placement = { railroadId, hexId, isStart: false }
        expect(placementBonuses('map.de', placement, track, undefined, { playerId: 'p2' })).toEqual(
            []
        )
        const joined: Track = { ...track, [hexId]: [railroadId] }
        const later = {
            railroadId: 'railroad.black',
            hexId: 'hex.de.17-19',
            isStart: true
        } as const
        expect(placementBonuses('map.de', later, joined, undefined, undefined)).toEqual([])
    })
})
