import { describe, expect, it } from 'vitest'
import type { HexId } from '../data/hexes.js'
import { RAILROAD_IDS, type RailroadId } from '../data/railroads.js'
import { PhaseName } from '../definition/phases.js'
import { USA_CITIES } from '../data/usaMap.js'
import type { Track } from '../model/gameState.js'
import { boardMap, cityById } from '../data/boardMaps.js'
import { MAP_IDS, type MapId } from '../data/maps.js'
import { buildState } from '../testing/fixtures.js'
import { legalPlacements, placementTest, startCityIds } from './placement.js'
import { ALPHA, BETA, FLAT_FIXTURE_MAP, GAMMA } from '../testing/flatFixtureMap.js'
import {
    cityFitsStartRule,
    noRailroadStartsIn,
    westernmostOccupiedCities
} from './startRailroad.js'

const NEW_YORK: HexId = 'hex.usa.6-60'
const PHILADELPHIA: HexId = 'hex.usa.7-57'
const BOSTON: HexId = 'hex.usa.4-62'
const CHICAGO: HexId = 'hex.usa.5-43'
const SAINT_LOUIS: HexId = 'hex.usa.8-38'
const SEATTLE: HexId = 'hex.usa.0-4'
const LOS_ANGELES: HexId = 'hex.usa.12-10'
const DENVER: HexId = 'hex.usa.8-22'
const RENO: HexId = 'hex.usa.7-7'
const BOISE: HexId = 'hex.usa.4-10'
const POCATELLO: HexId = 'hex.usa.4-16'
const SALT_LAKE_CITY: HexId = 'hex.usa.6-16'
const NEXT_TO_CHICAGO: HexId = 'hex.usa.5-41'
const PLAIN_IN_KANSAS: HexId = 'hex.usa.8-26'

const ALL_SHARES = {
    'railroad.red': 1,
    'railroad.blue': 1,
    'railroad.orange': 1,
    'railroad.yellow': 1,
    'railroad.purple': 1,
    'railroad.black': 1
}

// Occupied western cities: Reno 7, Boise 10, Pocatello and Salt Lake City tied at 16, Denver 22.
const WESTERN_TRACK: Track = {
    [RENO]: ['railroad.purple'],
    [BOISE]: ['railroad.purple', 'railroad.black'],
    [POCATELLO]: ['railroad.black'],
    [SALT_LAKE_CITY]: ['railroad.orange'],
    [DENVER]: ['railroad.orange'],
    [CHICAGO]: ['railroad.orange'],
    [NEW_YORK]: ['railroad.red']
}

function building(track: Track) {
    return buildState({
        round: 6,
        phase: PhaseName.Build,
        shares: { p1: ALL_SHARES },
        track
    })
}

function verdict(track: Track, railroadId: RailroadId, hexId: HexId) {
    return placementTest(building(track), 'p1', railroadId, hexId)
}

const START = { legal: true, isStart: true }
const NO_START = { legal: false, reason: 'not-adjacent-or-start' }

describe('Red and Blue start on the East Coast, never in the same city (R-4.2.1)', () => {
    it.each(['railroad.red', 'railroad.blue'] as const)('%s starts in an East Coast city', (id) => {
        expect(verdict({}, id, NEW_YORK)).toEqual(START)
        expect(verdict({}, id, PHILADELPHIA)).toEqual(START)
    })

    it.each(['railroad.red', 'railroad.blue'] as const)('%s cannot start elsewhere', (id) => {
        expect(verdict({}, id, BOSTON)).toEqual(NO_START)
        expect(verdict({}, id, CHICAGO)).toEqual(NO_START)
    })

    it('refuses Blue the East Coast city Red started in', () => {
        expect(verdict({ [NEW_YORK]: ['railroad.red'] }, 'railroad.blue', NEW_YORK)).toEqual({
            legal: false,
            reason: 'hex-at-capacity'
        })
    })

    it('allows one start only: a started railroad cannot start again', () => {
        expect(verdict({ [NEW_YORK]: ['railroad.red'] }, 'railroad.red', 'hex.usa.9-55')).toEqual(
            NO_START
        )
    })
})

describe('Orange starts on the East Coast or in Chicago (R-4.2.2)', () => {
    it('starts in an East Coast city or Chicago', () => {
        expect(verdict({}, 'railroad.orange', PHILADELPHIA)).toEqual(START)
        expect(verdict({}, 'railroad.orange', CHICAGO)).toEqual(START)
    })

    it('cannot start in another city', () => {
        expect(verdict({}, 'railroad.orange', SAINT_LOUIS)).toEqual(NO_START)
    })
})

describe('Purple starts on the West Coast (R-4.2.4)', () => {
    it('starts in a West Coast city', () => {
        expect(verdict({}, 'railroad.purple', SEATTLE)).toEqual(START)
        expect(verdict({}, 'railroad.purple', LOS_ANGELES)).toEqual(START)
    })

    it('cannot start inland or on the East Coast', () => {
        expect(verdict({}, 'railroad.purple', DENVER)).toEqual(NO_START)
        expect(verdict({}, 'railroad.purple', NEW_YORK)).toEqual(NO_START)
    })
})

describe('Black starts in any city with room, Chicago included (R-4.2.5)', () => {
    it('starts in any city, a $5 city or an East Coast city included', () => {
        expect(verdict({}, 'railroad.black', DENVER)).toEqual(START)
        expect(verdict({}, 'railroad.black', BOSTON)).toEqual(START)
        expect(verdict({}, 'railroad.black', NEW_YORK)).toEqual(START)
    })

    it('starts in Chicago however many locomotives it holds', () => {
        const crowdedChicago: Track = {
            [CHICAGO]: ['railroad.red', 'railroad.blue', 'railroad.orange', 'railroad.yellow']
        }
        expect(verdict(crowdedChicago, 'railroad.black', CHICAGO)).toEqual(START)
    })

    it('cannot start in a city without room', () => {
        const fullBoston: Track = { [BOSTON]: ['railroad.red', 'railroad.blue'] }
        expect(verdict(fullBoston, 'railroad.black', BOSTON)).toEqual({
            legal: false,
            reason: 'hex-at-capacity'
        })
        expect(verdict({ [NEW_YORK]: ['railroad.red'] }, 'railroad.black', NEW_YORK)).toEqual({
            legal: false,
            reason: 'hex-at-capacity'
        })
    })

    it('cannot start outside a city', () => {
        expect(verdict({}, 'railroad.black', PLAIN_IN_KANSAS)).toEqual(NO_START)
    })
})

describe('the westernmost set (R-4.2.3)', () => {
    it('takes the occupied cities lowest in dcol, every city tied with the third included', () => {
        expect(westernmostOccupiedCities(WESTERN_TRACK)).toEqual([
            'city.usa.reno',
            'city.usa.boise',
            'city.usa.pocatello',
            'city.usa.salt-lake-city'
        ])
    })

    it('counts a city that cannot take Yellow among the three', () => {
        const track: Track = {
            [RENO]: ['railroad.purple', 'railroad.black'],
            [BOISE]: ['railroad.purple'],
            [SALT_LAKE_CITY]: ['railroad.black'],
            [DENVER]: ['railroad.orange']
        }
        expect(westernmostOccupiedCities(track)).toEqual([
            'city.usa.reno',
            'city.usa.boise',
            'city.usa.salt-lake-city'
        ])
        expect(verdict(track, 'railroad.yellow', RENO)).toEqual({
            legal: false,
            reason: 'hex-at-capacity'
        })
        expect(verdict(track, 'railroad.yellow', DENVER)).toEqual(NO_START)
        expect(verdict(track, 'railroad.yellow', BOISE)).toEqual(START)
    })

    it('ignores cities without track and holds every occupied city when fewer than three are', () => {
        const track: Track = { [NEW_YORK]: ['railroad.red'], [CHICAGO]: ['railroad.orange'] }
        expect(westernmostOccupiedCities(track)).toEqual(['city.usa.chicago', 'city.usa.new-york'])
    })
})

describe('Yellow starts once, in Chicago or a westernmost city (R-4.2.3)', () => {
    it('starts in Chicago, whatever Chicago holds', () => {
        const crowded: Track = {
            ...WESTERN_TRACK,
            [CHICAGO]: ['railroad.orange', 'railroad.red', 'railroad.black']
        }
        expect(verdict(WESTERN_TRACK, 'railroad.yellow', CHICAGO)).toEqual(START)
        expect(verdict(crowded, 'railroad.yellow', CHICAGO)).toEqual(START)
    })

    it('starts in a westernmost city holding exactly one locomotive', () => {
        expect(verdict(WESTERN_TRACK, 'railroad.yellow', RENO)).toEqual(START)
        expect(verdict(WESTERN_TRACK, 'railroad.yellow', SALT_LAKE_CITY)).toEqual(START)
    })

    it('cannot start in an occupied city outside the set, or an empty city', () => {
        expect(verdict(WESTERN_TRACK, 'railroad.yellow', DENVER)).toEqual(NO_START)
        expect(verdict(WESTERN_TRACK, 'railroad.yellow', SAINT_LOUIS)).toEqual(NO_START)
    })

    it('has no start left once it has started in Chicago', () => {
        const track: Track = { ...WESTERN_TRACK, [CHICAGO]: ['railroad.orange', 'railroad.yellow'] }
        expect(verdict(track, 'railroad.yellow', RENO)).toEqual(NO_START)
        expect(verdict(track, 'railroad.yellow', POCATELLO)).toEqual(NO_START)
    })

    it('has no start left once it has started in a westernmost city', () => {
        const track: Track = { ...WESTERN_TRACK, [RENO]: ['railroad.purple', 'railroad.yellow'] }
        expect(verdict(track, 'railroad.yellow', CHICAGO)).toEqual(NO_START)
        expect(verdict(track, 'railroad.yellow', POCATELLO)).toEqual(NO_START)
    })
})

describe('a placement next to the railroad’s own track is never a start (R-4.1.2, R-4.2.3)', () => {
    it('lets Yellow build into Chicago by adjacency, not as a start', () => {
        const track: Track = { ...WESTERN_TRACK, [NEXT_TO_CHICAGO]: ['railroad.yellow'] }
        expect(verdict(track, 'railroad.yellow', CHICAGO)).toEqual({
            legal: true,
            isStart: false
        })
    })

    it('lets Red build into an East Coast city by adjacency without a start', () => {
        const track: Track = { [PHILADELPHIA]: ['railroad.red'], 'hex.usa.6-58': ['railroad.red'] }
        expect(verdict(track, 'railroad.red', NEW_YORK)).toEqual({ legal: true, isStart: false })
    })
})

describe('the cities a railroad may start in now (R-4.2)', () => {
    const sorted = (cityIds: readonly string[]) => cityIds.toSorted()
    const WEST_COAST = USA_CITIES.filter((city) => city.groups.includes('west-coast'))

    it('gives Yellow Chicago and the westernmost cities holding exactly one locomotive', () => {
        expect(sorted(startCityIds(building(WESTERN_TRACK), 'railroad.yellow'))).toEqual(
            sorted([
                'city.usa.chicago',
                'city.usa.reno',
                'city.usa.pocatello',
                'city.usa.salt-lake-city'
            ])
        )
    })

    it('follows the track: a placement changes Yellow’s set before its first placement', () => {
        const filledPocatello: Track = {
            ...WESTERN_TRACK,
            [POCATELLO]: ['railroad.black', 'railroad.purple']
        }
        expect(startCityIds(building(filledPocatello), 'railroad.yellow')).not.toContain(
            'city.usa.pocatello'
        )
        // Seattle now lies furthest west, so the set shrinks to Seattle, Reno and Boise.
        const seattleTaken: Track = { ...WESTERN_TRACK, [SEATTLE]: ['railroad.purple'] }
        expect(sorted(startCityIds(building(seattleTaken), 'railroad.yellow'))).toEqual(
            sorted(['city.usa.chicago', 'city.usa.seattle', 'city.usa.reno'])
        )
    })

    it('gives Purple the four West Coast cities, then drops one without room', () => {
        expect(WEST_COAST).toHaveLength(4)
        expect(startCityIds(building({}), 'railroad.purple')).toEqual(
            WEST_COAST.map((city) => city.id)
        )
        const fullSeattle: Track = { [SEATTLE]: ['railroad.black', 'railroad.orange'] }
        expect(startCityIds(building(fullSeattle), 'railroad.purple')).toEqual(
            WEST_COAST.filter((city) => city.hexId !== SEATTLE).map((city) => city.id)
        )
    })

    it('gives a railroad no start city once it has started', () => {
        expect(
            startCityIds(building({ [LOS_ANGELES]: ['railroad.purple'] }), 'railroad.purple')
        ).toEqual([])
        const yellowInChicago: Track = {
            ...WESTERN_TRACK,
            [CHICAGO]: ['railroad.orange', 'railroad.yellow']
        }
        expect(startCityIds(building(yellowInChicago), 'railroad.yellow')).toEqual([])
    })

    it('agrees with the placement test on every city', () => {
        const state = building(WESTERN_TRACK)
        for (const railroadId of [
            'railroad.yellow',
            'railroad.purple',
            'railroad.black'
        ] as const) {
            const starts = startCityIds(state, railroadId)
            for (const city of USA_CITIES) {
                const placement = verdict(WESTERN_TRACK, railroadId, city.hexId)
                expect(starts.includes(city.id), `${railroadId} in ${city.id}`).toBe(
                    placement.legal && placement.isStart
                )
            }
        }
    })
})

// R-4.2, R-8: the expansion maps start a railroad in a city printed in its colour.
describe('start rules by printed colour (R-4.2, R-8)', () => {
    const alpha = FLAT_FIXTURE_MAP.city(ALPHA)
    const beta = FLAT_FIXTURE_MAP.city(BETA)
    const gamma = FLAT_FIXTURE_MAP.city(GAMMA)

    it('printed-colour: starts a railroad only in a city printing its colour', () => {
        expect(cityFitsStartRule('printed-colour', alpha, 'railroad.red', {})).toBe(true)
        expect(cityFitsStartRule('printed-colour', alpha, 'railroad.blue', {})).toBe(false)
        expect(cityFitsStartRule('printed-colour', beta, 'railroad.blue', {})).toBe(true)
        expect(cityFitsStartRule('printed-colour', gamma, 'railroad.red', {})).toBe(false)
    })

    it('printed-colour-or-berlin: starts a railroad in a city printing its colour, as printed-colour', () => {
        expect(cityFitsStartRule('printed-colour-or-berlin', alpha, 'railroad.red', {})).toBe(true)
        expect(cityFitsStartRule('printed-colour-or-berlin', alpha, 'railroad.blue', {})).toBe(
            false
        )
        expect(cityFitsStartRule('printed-colour-or-berlin', gamma, 'railroad.purple', {})).toBe(
            false
        )
    })

    it('keeps the USA starts on their own rules, whatever colours the cities print', () => {
        const chicago = USA_CITIES.find((city) => city.id === 'city.usa.chicago')
        expect(chicago?.startColours).toContain('railroad.yellow')
        expect(cityFitsStartRule('west-coast', chicago ?? alpha, 'railroad.yellow', {})).toBe(false)
        expect(cityFitsStartRule('any-city', alpha, 'railroad.black', {})).toBe(true)
    })

    it('any-city-but-long-distance: starts Black in any city but a long-distance one (R-8.2)', () => {
        const perth = boardMap('map.au').city('city.au.perth')
        const brisbane = boardMap('map.au').city('city.au.brisbane')
        const adelaide = boardMap('map.au').city('city.au.adelaide')
        const rule = 'any-city-but-long-distance'
        expect(cityFitsStartRule(rule, adelaide, 'railroad.black', {})).toBe(true)
        expect(cityFitsStartRule(rule, perth, 'railroad.black', {})).toBe(false)
        expect(cityFitsStartRule(rule, brisbane, 'railroad.black', {})).toBe(false)
        expect(cityFitsStartRule('any-city', perth, 'railroad.black', {})).toBe(true)
    })
})

function emptyBoard(mapId: MapId) {
    return buildState({ mapId, round: 6, phase: PhaseName.Build, shares: { p1: ALL_SHARES } })
}

describe('Australia (R-8.2)', () => {
    const state = emptyBoard('map.au')

    it('starts Red, Blue, Orange and Yellow each in the one city printed in its colour, Yellow only in Wagga Wagga', () => {
        expect(startCityIds(state, 'railroad.red')).toEqual(['city.au.sydney'])
        expect(startCityIds(state, 'railroad.blue')).toEqual(['city.au.melbourne'])
        expect(startCityIds(state, 'railroad.orange')).toEqual(['city.au.adelaide'])
        expect(startCityIds(state, 'railroad.yellow')).toEqual(['city.au.wagga-wagga'])
    })

    it('starts Purple in every city printed Purple', () => {
        expect(startCityIds(state, 'railroad.purple')).toEqual(
            boardMap('map.au')
                .cities.filter((city) => city.startColours.includes('railroad.purple'))
                .map((city) => city.id)
        )
        expect(startCityIds(state, 'railroad.purple')).toHaveLength(51)
    })

    it('starts Black in any city with room but Perth and Brisbane (R-4.2.5)', () => {
        expect(startCityIds(state, 'railroad.black')).toEqual(
            boardMap('map.au')
                .cities.map((city) => city.id)
                .filter((cityId) => cityId !== 'city.au.perth' && cityId !== 'city.au.brisbane')
        )
        expect(startCityIds(state, 'railroad.black')).toHaveLength(52)
    })

    it('names Perth and Brisbane, of every map’s cities, as where no railroad starts', () => {
        const startless = MAP_IDS.flatMap((mapId) =>
            boardMap(mapId)
                .cities.filter((city) => noRailroadStartsIn(city))
                .map((city) => city.id)
        )
        expect(startless).toEqual(['city.au.brisbane', 'city.au.perth'])
    })

    it('starts no railroad in Perth or Brisbane: no offer there, and a start refused with a reason', () => {
        const offered = legalPlacements(state, 'p1').map((placement) => placement.hexId)
        for (const hexId of ['hex.au.0-12', 'hex.au.34-6'] as const) {
            expect(offered, hexId).not.toContain(hexId)
            for (const railroadId of RAILROAD_IDS) {
                expect(placementTest(state, 'p1', railroadId, hexId), railroadId).toEqual({
                    legal: false,
                    reason: 'not-adjacent-or-start'
                })
            }
        }
    })

    it('refuses Yellow a start anywhere but Wagga Wagga', () => {
        expect(placementTest(state, 'p1', 'railroad.yellow', 'hex.au.22-18')).toEqual(START)
        expect(placementTest(state, 'p1', 'railroad.yellow', 'hex.au.31-15')).toEqual({
            legal: false,
            reason: 'not-adjacent-or-start'
        })
    })
})

describe('Canada (R-8.3)', () => {
    const state = emptyBoard('map.ca')

    it('starts each coloured railroad in the one city printed in its colour, Yellow only in Sault Ste. Marie', () => {
        expect(startCityIds(state, 'railroad.red')).toEqual(['city.ca.montreal'])
        expect(startCityIds(state, 'railroad.blue')).toEqual(['city.ca.windsor'])
        expect(startCityIds(state, 'railroad.orange')).toEqual(['city.ca.quebec-city'])
        expect(startCityIds(state, 'railroad.yellow')).toEqual(['city.ca.sault-ste-marie'])
        expect(startCityIds(state, 'railroad.purple')).toEqual(['city.ca.toronto'])
    })

    it('starts Black in any city with room (R-4.2.5)', () => {
        expect(startCityIds(state, 'railroad.black')).toEqual(
            boardMap('map.ca').cities.map((city) => city.id)
        )
    })

    it('refuses Yellow a start anywhere but Sault Ste. Marie', () => {
        expect(placementTest(state, 'p1', 'railroad.yellow', 'hex.ca.0-2')).toEqual(START)
        expect(placementTest(state, 'p1', 'railroad.yellow', 'hex.ca.11-21')).toEqual({
            legal: false,
            reason: 'not-adjacent-or-start'
        })
    })
})

describe('France (R-8.4)', () => {
    const state = emptyBoard('map.fr')
    const RED_BLUE_BLACK = [
        'city.fr.lille',
        'city.fr.valenciennes',
        'city.fr.sedan',
        'city.fr.metz'
    ]

    it('starts Red and Blue in the Red/Blue/Black cities', () => {
        expect(startCityIds(state, 'railroad.red')).toEqual(RED_BLUE_BLACK)
        expect(startCityIds(state, 'railroad.blue')).toEqual(RED_BLUE_BLACK)
    })

    it('never starts Red and Blue in the same city, which holds one locomotive', () => {
        const redInLille = buildState({
            mapId: 'map.fr',
            round: 6,
            phase: PhaseName.Build,
            shares: { p1: ALL_SHARES },
            track: { 'hex.fr.15-1': ['railroad.red'] }
        })
        expect(placementTest(redInLille, 'p1', 'railroad.blue', 'hex.fr.15-1')).toEqual({
            legal: false,
            reason: 'hex-at-capacity'
        })
        expect(startCityIds(redInLille, 'railroad.blue')).toEqual(RED_BLUE_BLACK.slice(1))
    })

    it('starts Orange, Yellow and Purple each in the cities printed in its colour', () => {
        expect(startCityIds(state, 'railroad.orange')).toEqual([
            'city.fr.dunkerque',
            'city.fr.cherbourg',
            'city.fr.le-havre',
            'city.fr.brest'
        ])
        expect(startCityIds(state, 'railroad.yellow')).toEqual([
            'city.fr.bordeaux',
            'city.fr.toulouse',
            'city.fr.marseille'
        ])
        expect(startCityIds(state, 'railroad.purple')).toEqual([
            'city.fr.strasbourg',
            'city.fr.paris',
            'city.fr.basel',
            'city.fr.geneve',
            'city.fr.lyon'
        ])
    })

    it('starts Black in any city with room (R-4.2.5)', () => {
        expect(startCityIds(state, 'railroad.black')).toEqual(
            boardMap('map.fr').cities.map((city) => city.id)
        )
    })
})

describe('Germany (R-8.5)', () => {
    const state = emptyBoard('map.de')

    it('starts Red and Blue in the Red/Blue/Black cities, Orange and Yellow in their colour’s', () => {
        const redBlueBlack = ['city.de.essen', 'city.de.leipzig', 'city.de.dresden', 'city.de.koln']
        expect(startCityIds(state, 'railroad.red')).toEqual(redBlueBlack)
        expect(startCityIds(state, 'railroad.blue')).toEqual(redBlueBlack)
        expect(startCityIds(state, 'railroad.orange')).toEqual([
            'city.de.stuttgart',
            'city.de.freiburg',
            'city.de.munchen'
        ])
        expect(startCityIds(state, 'railroad.yellow')).toEqual(['city.de.kiel', 'city.de.hamburg'])
    })

    it('starts Purple in Kassel, Erfurt or Berlin, and nowhere else', () => {
        expect(startCityIds(state, 'railroad.purple')).toEqual([
            'city.de.berlin',
            'city.de.kassel',
            'city.de.erfurt'
        ])
        expect(placementTest(state, 'p1', 'railroad.purple', 'hex.de.19-17')).toEqual(START)
        expect(placementTest(state, 'p1', 'railroad.purple', 'hex.de.9-27')).toEqual(START)
        expect(placementTest(state, 'p1', 'railroad.purple', 'hex.de.13-29')).toEqual(START)
        expect(placementTest(state, 'p1', 'railroad.purple', 'hex.de.17-19')).toEqual(NO_START)
    })

    it('reads Berlin as a Purple start whatever its print, and no other city off Purple’s colour', () => {
        const berlin = cityById('city.de.berlin')
        const unprinted = { ...berlin, startColours: [] }
        expect(
            cityFitsStartRule('printed-colour-or-berlin', unprinted, 'railroad.purple', {})
        ).toBe(true)
        expect(cityFitsStartRule('printed-colour', unprinted, 'railroad.purple', {})).toBe(false)
        expect(
            cityFitsStartRule(
                'printed-colour-or-berlin',
                cityById('city.de.potsdam'),
                'railroad.purple',
                {}
            )
        ).toBe(false)
    })

    it('starts Black in any city with room (R-4.2.5)', () => {
        expect(startCityIds(state, 'railroad.black')).toEqual(
            boardMap('map.de').cities.map((city) => city.id)
        )
    })
})
