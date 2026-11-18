import { HexOrientation } from '@tabletop/common'
import { BoardMap, type City, type CityId, type Hex, type MapDefinition } from '../data/boardMap.js'
import type { HexId } from '../data/hexes.js'

// A small flat map for the specs, so flat geometry, impassable sides and a two-cell hex are
// exercised before any flat map is printed. The id types know only the USA's key, so the fixture
// borrows it; it is never registered, and only its own `BoardMap` reads it (the UI's board
// geometry specs build their flat board from it).
// Some of its ids are the USA's too: a spec builds the fixture's geometry from the fixture, never
// through a global id lookup.
//
//   col:     0     1     2     3
//   drow 0  0-0         2-0
//   drow 1        1-1         3-1
//   drow 2  0-2         2-2
//   drow 3        1-3 A       3-3 Beta
//   drow 4  0-4 x       2-4 Gamma
//   drow 5        1-5 L       3-5
//   drow 6  0-6        (2-6)
//   drow 7        1-7         3-7
//
// Alpha at 0-2 prints the Chicago bonus id and Beta the $5 one, so the bonus factories can be
// tried here with amounts of their own; 1-1 a mountain, 1-3 (A) the Alps, 1-5 (L) long-distance; Gamma's hex 2-4 also
// covers the cell 2-6; an impassable side (x) parts 0-4 from 1-5.

export const ALPHA_HEX: HexId = 'hex.usa.0-2'
export const BETA_HEX: HexId = 'hex.usa.3-3'
export const GAMMA_HEX: HexId = 'hex.usa.2-4'
export const ALPHA: CityId = 'city.usa.alpha'
export const BETA: CityId = 'city.usa.beta'
export const GAMMA: CityId = 'city.usa.gamma'
export const MOUNTAIN_HEX: HexId = 'hex.usa.1-1'
export const ALPS_HEX: HexId = 'hex.usa.1-3'
export const LONG_DISTANCE_HEX: HexId = 'hex.usa.1-5'

const FIXTURE_CITIES: readonly City[] = [
    {
        id: 'city.usa.alpha',
        name: 'Alpha',
        hexId: ALPHA_HEX,
        startColours: ['railroad.red'],
        capacity: 2,
        bonus: 'bonus.usa.chicago',
        groups: []
    },
    {
        id: 'city.usa.beta',
        name: 'Beta',
        hexId: BETA_HEX,
        startColours: ['railroad.blue'],
        capacity: 1,
        bonus: 'bonus.usa.five-dollar',
        groups: []
    },
    {
        id: 'city.usa.gamma',
        name: 'Gamma',
        hexId: GAMMA_HEX,
        startColours: [],
        capacity: 'unlimited',
        bonus: null,
        groups: []
    }
]

const plain = (hexId: HexId): Hex => ({ id: hexId, terrain: 'plain' })

const FIXTURE_HEXES: readonly Hex[] = [
    plain('hex.usa.3-7'),
    plain('hex.usa.1-7'),
    plain('hex.usa.0-6'),
    plain('hex.usa.3-5'),
    { id: LONG_DISTANCE_HEX, terrain: 'long-distance' },
    { id: GAMMA_HEX, terrain: 'city', cityId: 'city.usa.gamma', extraCells: [{ q: 2, r: 2 }] },
    plain('hex.usa.0-4'),
    { id: BETA_HEX, terrain: 'city', cityId: 'city.usa.beta' },
    { id: ALPS_HEX, terrain: 'alps' },
    plain('hex.usa.2-2'),
    { id: ALPHA_HEX, terrain: 'city', cityId: 'city.usa.alpha' },
    plain('hex.usa.3-1'),
    { id: MOUNTAIN_HEX, terrain: 'mountain' },
    plain('hex.usa.2-0'),
    plain('hex.usa.0-0')
]

export const FLAT_FIXTURE_DEFINITION: MapDefinition = {
    id: 'map.usa',
    key: 'usa',
    orientation: HexOrientation.Flat,
    hexes: FIXTURE_HEXES,
    cities: FIXTURE_CITIES,
    impassable: [['hex.usa.0-4', LONG_DISTANCE_HEX]],
    citiesWithoutSetupPassenger: ['city.usa.gamma'],
    longDistanceCities: []
}

export const FLAT_FIXTURE_MAP = new BoardMap(FLAT_FIXTURE_DEFINITION)
