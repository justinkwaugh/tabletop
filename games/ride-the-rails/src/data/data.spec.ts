import { describe, expect, it } from 'vitest'
import { Value } from 'typebox/value'
import {
    LOCOMOTIVES_PER_RAILROAD,
    RAILROAD_IDS,
    RAILROAD_INTRODUCTIONS,
    RAILROADS,
    RailroadId,
    type RailroadIntroduction
} from './railroads.js'
import {
    chargesMountain,
    GROUP_LIMITS,
    lowersLimit,
    PLACEMENT_LIMITS,
    placementLimit,
    type MapPlacementLimits
} from './placementLimits.js'
import { BONUS_RULES } from '../rules/bonuses.js'
import { ROUND_END_PASSENGER_CITY } from '../rules/endOfRound.js'
import { ALPHA_HEX, FLAT_FIXTURE_MAP, MOUNTAIN_HEX } from '../testing/flatFixtureMap.js'
import { BOARD_MAPS } from './boardMaps.js'
import { MAP_DETAILS, MAP_IDS, MAP_KEY_OF } from './maps.js'
import { BONUSES, CHICAGO_BONUS, FIVE_DOLLAR_BONUS, TRANSCONTINENTAL_BONUS } from './bonuses.js'

function duplicatesOf(ids: readonly string[]): string[] {
    return ids.filter((id, index) => ids.indexOf(id) !== index)
}

describe('railroads (R-1.1, R-1.4)', () => {
    it('lists the six railroads in availability order (R-1.4)', () => {
        expect(RAILROADS.map((railroad) => [railroad.id, railroad.printedName])).toEqual([
            ['railroad.red', 'Red'],
            ['railroad.blue', 'Blue'],
            ['railroad.orange', 'Orange'],
            ['railroad.yellow', 'Yellow'],
            ['railroad.purple', 'Purple'],
            ['railroad.black', 'Black']
        ])
        expect(RAILROADS.map((railroad) => railroad.id)).toEqual(RAILROAD_IDS)
    })

    it('has no duplicate railroad id', () => {
        expect(duplicatesOf(RAILROADS.map((railroad) => railroad.id))).toEqual([])
    })

    it('gives each railroad 27 locomotives, 162 in all (R-1.1)', () => {
        expect(LOCOMOTIVES_PER_RAILROAD).toBe(27)
        for (const railroad of RAILROADS) {
            expect(railroad.locomotives).toBe(27)
        }
        expect(RAILROADS.reduce((total, railroad) => total + railroad.locomotives, 0)).toBe(162)
    })

    it('validates railroad ids with its schema', () => {
        for (const id of RAILROAD_IDS) {
            expect(Value.Check(RailroadId, id)).toBe(true)
        }
        expect(Value.Check(RailroadId, 'railroad.green')).toBe(false)
    })

    it('introduces the railroads on the USA map by round with their start rules (R-1.4, R-4.2)', () => {
        expect(RAILROAD_INTRODUCTIONS['map.usa']).toEqual([
            { railroadId: 'railroad.red', availableFromRound: 1, startRule: 'east-coast-apart' },
            { railroadId: 'railroad.blue', availableFromRound: 1, startRule: 'east-coast-apart' },
            {
                railroadId: 'railroad.orange',
                availableFromRound: 2,
                startRule: 'east-coast-or-chicago'
            },
            {
                railroadId: 'railroad.yellow',
                availableFromRound: 3,
                startRule: 'chicago-or-westernmost'
            },
            { railroadId: 'railroad.purple', availableFromRound: 4, startRule: 'west-coast' },
            { railroadId: 'railroad.black', availableFromRound: 5, startRule: 'any-city' }
        ])
    })

    it('introduces each railroad once per map, in railroad order (R-1.4, R-8)', () => {
        for (const introductions of Object.values(RAILROAD_INTRODUCTIONS)) {
            expect(introductions.map((introduction) => introduction.railroadId)).toEqual(
                RAILROAD_IDS
            )
        }
    })
})

describe('placement limits (R-3.2.3, R-3.2.4)', () => {
    it('prints 8 / 5 / 4 for 3 / 4 / 5 players on the USA map, mountain −1', () => {
        expect(PLACEMENT_LIMITS['map.usa']).toEqual({
            byPlayerCount: [
                { playerCount: 3, limit: 8 },
                { playerCount: 4, limit: 5 },
                { playerCount: 5, limit: 4 }
            ],
            mountainReduction: 1
        })
    })

    it('reads the limit without a mountain placement (R-3.2.3)', () => {
        expect(placementLimit('map.usa', 3, false)).toBe(8)
        expect(placementLimit('map.usa', 4, false)).toBe(5)
        expect(placementLimit('map.usa', 5, false)).toBe(4)
    })

    it('reduces the limit by one once a mountain placement is made (R-3.2.4)', () => {
        expect(placementLimit('map.usa', 3, true)).toBe(7)
        expect(placementLimit('map.usa', 4, true)).toBe(4)
        expect(placementLimit('map.usa', 5, true)).toBe(3)
    })

    it('has one row per player count on every map (R-1.2, R-8)', () => {
        for (const limits of Object.values(PLACEMENT_LIMITS)) {
            expect(limits.byPlayerCount.map((row) => row.playerCount)).toEqual([3, 4, 5])
        }
    })

    it('has no limit for a player count the game does not seat (R-1.2)', () => {
        expect(() => placementLimit('map.usa', 2, false)).toThrow()
    })
})

describe('bonuses (R-4.3)', () => {
    it('pays $2 for each placement in Chicago (R-4.3.1)', () => {
        expect(CHICAGO_BONUS).toEqual({
            id: 'bonus.usa.chicago',
            printedName: 'Chicago',
            amount: 2
        })
    })

    it('pays $5 for a $5 city (R-4.3.2)', () => {
        expect(FIVE_DOLLAR_BONUS).toEqual({
            id: 'bonus.usa.five-dollar',
            printedName: '$5 cities',
            amount: 5
        })
    })

    it('prices the Transcontinental at $12 in a city hex and $8 elsewhere (R-4.3.3)', () => {
        expect(TRANSCONTINENTAL_BONUS).toEqual({
            id: 'bonus.usa.transcontinental',
            printedName: 'Transcontinental',
            cityHexAmount: 12,
            otherHexAmount: 8
        })
    })

    it('lists the three USA bonuses for the USA map (R-4.3, R-8)', () => {
        expect(BONUSES['map.usa'].map((bonus) => bonus.id)).toEqual([
            'bonus.usa.chicago',
            'bonus.usa.five-dollar',
            'bonus.usa.transcontinental'
        ])
    })

    it('has no duplicate bonus id across the maps', () => {
        const ids = Object.values(BONUSES).flatMap((bonuses) => bonuses.map((bonus) => bonus.id))
        expect(duplicatesOf(ids)).toEqual([])
    })
})

describe('tables keyed by map id (R-8)', () => {
    it('keys every table by the same map ids', () => {
        expect(Object.keys(RAILROAD_INTRODUCTIONS)).toEqual([
            'map.usa',
            'map.au',
            'map.ca',
            'map.fr',
            'map.de'
        ])
        expect(Object.keys(PLACEMENT_LIMITS)).toEqual([
            'map.usa',
            'map.au',
            'map.ca',
            'map.fr',
            'map.de'
        ])
        expect(Object.keys(BONUSES)).toEqual(['map.usa', 'map.au', 'map.ca', 'map.fr', 'map.de'])
    })
})

describe('duplicate detection', () => {
    it('reports a repeated id', () => {
        expect(duplicatesOf(['railroad.red', 'railroad.blue', 'railroad.red'])).toEqual([
            'railroad.red'
        ])
    })
})

describe('group limits (R-4.1.4, R-8)', () => {
    it('lets a railroad hold at most two East Coast cities on the USA map', () => {
        expect(GROUP_LIMITS['map.usa']).toEqual([{ group: 'east-coast', perRailroad: 2 }])
    })
})

describe('the mountain cost (R-3.2.4, R-8)', () => {
    const MOUNTAIN = 'hex.usa.6-56'
    const PLAIN = 'hex.usa.7-55'
    const CITY = 'hex.usa.7-57'

    it('lowers the USA limit for any railroad’s mountain placement, and for no other', () => {
        for (const railroadId of RAILROAD_IDS) {
            expect(lowersLimit('map.usa', railroadId, MOUNTAIN)).toBe(true)
            expect(lowersLimit('map.usa', railroadId, PLAIN)).toBe(false)
            expect(lowersLimit('map.usa', railroadId, CITY)).toBe(false)
        }
    })

    it('spares the railroads a map exempts, on the fixture map', () => {
        const limits: MapPlacementLimits = {
            byPlayerCount: [{ playerCount: 3, limit: 7 }],
            mountainReduction: 2,
            mountainExempt: ['railroad.orange']
        }
        const mountain = FLAT_FIXTURE_MAP.hex(MOUNTAIN_HEX)
        expect(chargesMountain(limits, 'railroad.orange', mountain)).toBe(false)
        expect(chargesMountain(limits, 'railroad.red', mountain)).toBe(true)
        expect(chargesMountain(limits, 'railroad.red', FLAT_FIXTURE_MAP.hex(ALPHA_HEX))).toBe(false)
    })

    it('exempts no railroad on the USA map', () => {
        expect(PLACEMENT_LIMITS['map.usa'].mountainExempt ?? []).toEqual([])
    })
})

describe('every per-map table (R-8)', () => {
    it('has a row for every map id the code knows, and no other', () => {
        const tables: Record<string, object> = {
            BOARD_MAPS,
            MAP_KEY_OF,
            MAP_DETAILS,
            RAILROAD_INTRODUCTIONS,
            PLACEMENT_LIMITS,
            GROUP_LIMITS,
            BONUSES,
            BONUS_RULES,
            ROUND_END_PASSENGER_CITY
        }
        for (const [name, table] of Object.entries(tables)) {
            expect([name, Object.keys(table)]).toEqual([name, [...MAP_IDS]])
        }
    })

    it('has no Paris Travels on the USA map', () => {
        expect(ROUND_END_PASSENGER_CITY['map.usa']).toBe(null)
    })
})

// Australia's introductions with Black starting in any city with room, Perth and Brisbane's
// exception aside.
function blackAnywhere(introductions: readonly RailroadIntroduction[]): RailroadIntroduction[] {
    return introductions.map((introduction) =>
        introduction.startRule === 'any-city-but-long-distance'
            ? { ...introduction, startRule: 'any-city' }
            : introduction
    )
}

describe('Australia (R-8.2)', () => {
    it('brings the railroads in by the USA’s rounds, each starting in a city of its printed colour and Black in any city but the long-distance ones', () => {
        const rounds = (mapId: 'map.usa' | 'map.au' | 'map.ca') =>
            RAILROAD_INTRODUCTIONS[mapId].map(({ railroadId, availableFromRound }) => [
                railroadId,
                availableFromRound
            ])
        expect(rounds('map.au')).toEqual(rounds('map.usa'))
        expect(
            RAILROAD_INTRODUCTIONS['map.au'].map(({ railroadId, startRule }) => [
                railroadId,
                startRule
            ])
        ).toEqual([
            ['railroad.red', 'printed-colour'],
            ['railroad.blue', 'printed-colour'],
            ['railroad.orange', 'printed-colour'],
            ['railroad.yellow', 'printed-colour'],
            ['railroad.purple', 'printed-colour'],
            ['railroad.black', 'any-city-but-long-distance']
        ])
    })

    it('prints 8 / 5 / 4 for 3 / 4 / 5 players, mountain −2, no railroad exempt', () => {
        expect(PLACEMENT_LIMITS['map.au']).toEqual({
            byPlayerCount: [
                { playerCount: 3, limit: 8 },
                { playerCount: 4, limit: 5 },
                { playerCount: 5, limit: 4 }
            ],
            mountainReduction: 2
        })
        expect(placementLimit('map.au', 3, true)).toBe(6)
        expect(placementLimit('map.au', 4, true)).toBe(3)
        expect(placementLimit('map.au', 5, true)).toBe(2)
    })

    it('has no group limit and no Paris Travels', () => {
        expect(GROUP_LIMITS['map.au']).toEqual([])
        expect(ROUND_END_PASSENGER_CITY['map.au']).toBe(null)
    })

    it('is listed for game creation as Australia, with what it changes', () => {
        expect(MAP_KEY_OF['map.au']).toBe('au')
        expect(MAP_DETAILS['map.au']).toEqual({
            name: 'Australia',
            description:
                'The Alps take no track; long-distance hexes hold one locomotive and end the turn; Perth $50, Brisbane $20.'
        })
    })
})

describe('Canada (R-8.3)', () => {
    it('introduces the railroads as Australia does, but Black in any city with room: the USA’s rounds, printed colours', () => {
        expect(RAILROAD_INTRODUCTIONS['map.ca']).toEqual(
            blackAnywhere(RAILROAD_INTRODUCTIONS['map.au'])
        )
    })

    it('prints 7 / 5 / 4 for 3 / 4 / 5 players, and has no mountain to lower them', () => {
        expect(PLACEMENT_LIMITS['map.ca'].byPlayerCount).toEqual([
            { playerCount: 3, limit: 7 },
            { playerCount: 4, limit: 5 },
            { playerCount: 5, limit: 4 }
        ])
        expect(placementLimit('map.ca', 3, false)).toBe(7)
        expect(placementLimit('map.ca', 4, false)).toBe(5)
        expect(placementLimit('map.ca', 5, false)).toBe(4)
        expect(BOARD_MAPS['map.ca'].hexes.some((hex) => hex.terrain === 'mountain')).toBe(false)
    })

    it('has no group limit and no Paris Travels', () => {
        expect(GROUP_LIMITS['map.ca']).toEqual([])
        expect(ROUND_END_PASSENGER_CITY['map.ca']).toBe(null)
    })

    it('is listed for game creation as Canada, with what it changes', () => {
        expect(MAP_KEY_OF['map.ca']).toBe('ca')
        expect(MAP_DETAILS['map.ca']).toEqual({
            name: 'Canada',
            description:
                'No mountains; impassable sides block track; Toronto has no limit, $3 a placement and $2 a start; the Intercolonial pays $8.'
        })
    })
})

describe('France (R-8.4)', () => {
    it('introduces the railroads as Australia does, but Black in any city with room: the USA’s rounds, printed colours', () => {
        expect(RAILROAD_INTRODUCTIONS['map.fr']).toEqual(
            blackAnywhere(RAILROAD_INTRODUCTIONS['map.au'])
        )
    })

    it('prints 8 / 5 / 4 for 3 / 4 / 5 players, mountain −1, no railroad exempt', () => {
        expect(PLACEMENT_LIMITS['map.fr']).toEqual({
            byPlayerCount: [
                { playerCount: 3, limit: 8 },
                { playerCount: 4, limit: 5 },
                { playerCount: 5, limit: 4 }
            ],
            mountainReduction: 1
        })
        expect(placementLimit('map.fr', 3, true)).toBe(7)
        expect(placementLimit('map.fr', 4, true)).toBe(4)
        expect(placementLimit('map.fr', 5, true)).toBe(3)
    })

    it('limits a railroad to two Red/Blue/Black cities and one Paris entry hex', () => {
        expect(GROUP_LIMITS['map.fr']).toEqual([
            { group: 'red-blue-black', perRailroad: 2 },
            { group: 'paris-entry', perRailroad: 1 }
        ])
    })

    it('has Paris Travels: Paris takes a passenger at the end of a round it has none', () => {
        expect(ROUND_END_PASSENGER_CITY['map.fr']).toBe('city.fr.paris')
    })

    it('is listed for game creation as France, with what it changes', () => {
        expect(MAP_KEY_OF['map.fr']).toBe('fr')
        expect(MAP_DETAILS['map.fr']).toEqual({
            name: 'France',
            description:
                'Paris $10 inside a ring of six one-locomotive entry hexes, and a new passenger there each round it has none; estuaries that track cannot cross.'
        })
    })
})

describe('Germany (R-8.5)', () => {
    it('brings the railroads in by the USA’s rounds, Purple starting in a city of its colour or Berlin', () => {
        expect(
            RAILROAD_INTRODUCTIONS['map.de'].map(({ railroadId, availableFromRound }) => [
                railroadId,
                availableFromRound
            ])
        ).toEqual(
            RAILROAD_INTRODUCTIONS['map.usa'].map(({ railroadId, availableFromRound }) => [
                railroadId,
                availableFromRound
            ])
        )
        expect(
            RAILROAD_INTRODUCTIONS['map.de'].map(({ railroadId, startRule }) => [
                railroadId,
                startRule
            ])
        ).toEqual([
            ['railroad.red', 'printed-colour'],
            ['railroad.blue', 'printed-colour'],
            ['railroad.orange', 'printed-colour'],
            ['railroad.yellow', 'printed-colour'],
            ['railroad.purple', 'printed-colour-or-berlin'],
            ['railroad.black', 'any-city']
        ])
    })

    it('prints 8 / 5 / 4 for 3 / 4 / 5 players, mountain −1, Orange exempt', () => {
        expect(PLACEMENT_LIMITS['map.de']).toEqual({
            byPlayerCount: [
                { playerCount: 3, limit: 8 },
                { playerCount: 4, limit: 5 },
                { playerCount: 5, limit: 4 }
            ],
            mountainReduction: 1,
            mountainExempt: ['railroad.orange']
        })
        expect(placementLimit('map.de', 3, true)).toBe(7)
        expect(placementLimit('map.de', 4, true)).toBe(4)
        expect(placementLimit('map.de', 5, true)).toBe(3)
    })

    it('has no group limit and no Paris Travels', () => {
        expect(GROUP_LIMITS['map.de']).toEqual([])
        expect(ROUND_END_PASSENGER_CITY['map.de']).toBe(null)
    })

    it('is listed for game creation as Germany, with what it changes', () => {
        expect(MAP_KEY_OF['map.de']).toBe('de')
        expect(MAP_DETAILS['map.de']).toEqual({
            name: 'Germany',
            description:
                'Berlin spans two hexes with no limit, $3 a placement, and Purple may start there; Orange pays no mountain cost; Greater Germany pays $12.'
        })
    })
})
