import { HexOrientation } from '@tabletop/common'
import type { City, Hex, MapDefinition } from './boardMap.js'
import { flatMapHexes, type TerrainColumn } from './flatTerrain.js'
import { flatToAxial, type HexId } from './hexes.js'

// germanyMap.ts, Cities, in reading order (R-4.1.4, R-4.2, R-4.3, R-8.5). Berlin has no limit and
// prints its bonus; every other city holds two, the Red/Blue/Black cities (Essen, Köln, Leipzig,
// Dresden) included. The printed spellings are kept.
export const GERMANY_CITIES: readonly City[] = [
    {
        id: 'city.de.flensburg',
        name: 'Flensburg',
        hexId: 'hex.de.10-0',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.kiel',
        name: 'Kiel',
        hexId: 'hex.de.11-3',
        startColours: ['railroad.yellow', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.stralsund',
        name: 'Stralsund',
        hexId: 'hex.de.18-4',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.rostock',
        name: 'Rostock',
        hexId: 'hex.de.16-6',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.greifswald',
        name: 'Greifswald',
        hexId: 'hex.de.20-6',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.lubeck',
        name: 'Lübeck',
        hexId: 'hex.de.13-7',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.hamburg',
        name: 'Hamburg',
        hexId: 'hex.de.10-8',
        startColours: ['railroad.yellow', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.bremerhaven',
        name: 'Bremerhaven',
        hexId: 'hex.de.7-9',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.schwerin',
        name: 'Schwerin',
        hexId: 'hex.de.15-9',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.bremen',
        name: 'Bremen',
        hexId: 'hex.de.9-11',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.neubrandenburg',
        name: 'Neubrandenburg',
        hexId: 'hex.de.19-11',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.oldenburg',
        name: 'Oldenburg',
        hexId: 'hex.de.6-12',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.hannover',
        name: 'Hannover',
        hexId: 'hex.de.10-16',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.wolfsburg',
        name: 'Wolfsburg',
        hexId: 'hex.de.13-17',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.berlin',
        name: 'Berlin',
        hexId: 'hex.de.19-17',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 'unlimited',
        bonus: 'bonus.de.berlin',
        groups: []
    },
    {
        id: 'city.de.osnabruck',
        name: 'Osnabrück',
        hexId: 'hex.de.6-18',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.potsdam',
        name: 'Potsdam',
        hexId: 'hex.de.17-19',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.bielefeld',
        name: 'Bielefeld',
        hexId: 'hex.de.8-20',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.braunschweig',
        name: 'Braunschweig',
        hexId: 'hex.de.12-20',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.munster',
        name: 'Münster',
        hexId: 'hex.de.5-21',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.magdeburg',
        name: 'Magdeburg',
        hexId: 'hex.de.15-21',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.gottingen',
        name: 'Göttingen',
        hexId: 'hex.de.11-23',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.dessau',
        name: 'Dessau',
        hexId: 'hex.de.17-23',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.essen',
        name: 'Essen',
        hexId: 'hex.de.4-24',
        startColours: ['railroad.red', 'railroad.blue', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.kottbus',
        name: 'Kottbus',
        hexId: 'hex.de.22-24',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.halle',
        name: 'Halle',
        hexId: 'hex.de.15-25',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.dusseldorf',
        name: 'Düsseldorf',
        hexId: 'hex.de.2-26',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.kassel',
        name: 'Kassel',
        hexId: 'hex.de.9-27',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.leipzig',
        name: 'Leipzig',
        hexId: 'hex.de.17-27',
        startColours: ['railroad.red', 'railroad.blue', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.erfurt',
        name: 'Erfurt',
        hexId: 'hex.de.13-29',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.dresden',
        name: 'Dresden',
        hexId: 'hex.de.21-29',
        startColours: ['railroad.red', 'railroad.blue', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.aachen',
        name: 'Aachen',
        hexId: 'hex.de.0-30',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.koln',
        name: 'Köln',
        hexId: 'hex.de.2-30',
        startColours: ['railroad.red', 'railroad.blue', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.jena',
        name: 'Jena',
        hexId: 'hex.de.16-30',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.chemnitz',
        name: 'Chemnitz',
        hexId: 'hex.de.18-30',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.koblenz',
        name: 'Koblenz',
        hexId: 'hex.de.4-32',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.frankfurt',
        name: 'Frankfurt',
        hexId: 'hex.de.7-35',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.trier',
        name: 'Trier',
        hexId: 'hex.de.1-37',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.mainz',
        name: 'Mainz',
        hexId: 'hex.de.5-37',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.wurzburg',
        name: 'Würzburg',
        hexId: 'hex.de.10-38',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.kaiserslautern',
        name: 'Kaiserslautern',
        hexId: 'hex.de.3-39',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.heidelberg',
        name: 'Heidelberg',
        hexId: 'hex.de.7-39',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.nurnberg',
        name: 'Nürnberg',
        hexId: 'hex.de.13-41',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.saarbrucken',
        name: 'Saarbrücken',
        hexId: 'hex.de.2-42',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.heilbronn',
        name: 'Heilbronn',
        hexId: 'hex.de.8-42',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.karlsruhe',
        name: 'Karlsruhe',
        hexId: 'hex.de.5-43',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.regensburg',
        name: 'Regensburg',
        hexId: 'hex.de.16-44',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.stuttgart',
        name: 'Stuttgart',
        hexId: 'hex.de.8-46',
        startColours: ['railroad.orange', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.ulm',
        name: 'Ulm',
        hexId: 'hex.de.10-48',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.augsburg',
        name: 'Augsburg',
        hexId: 'hex.de.13-49',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.freiburg',
        name: 'Freiburg',
        hexId: 'hex.de.4-50',
        startColours: ['railroad.orange', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.de.munchen',
        name: 'München',
        hexId: 'hex.de.15-51',
        startColours: ['railroad.orange', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    }
]

// germanyMap.ts, Terrain: one entry per column, west to east (col 0 is Aachen's), each terrain's
// drows north to south. A column's cities are in the city table.
const GERMANY_TERRAIN_BY_COL: readonly TerrainColumn[] = [
    // 0
    { plain: [26, 28] },
    // 1
    { plain: [23, 25, 27, 29, 31, 33, 35, 39] },
    // 2
    { plain: [22, 24, 28, 32, 34, 36, 38, 40] },
    // 3
    { plain: [15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 41] },
    // 4
    { plain: [8, 10, 12, 14, 16, 18, 20, 22, 26, 28, 30, 34, 36, 38, 40], mountain: [42, 48] },
    // 5
    {
        plain: [9, 11, 13, 15, 17, 19, 23, 25, 27, 29, 31, 33, 35, 47],
        mountain: [39, 41, 45, 49, 51]
    },
    // 6
    {
        plain: [8, 10, 14, 16, 20, 22, 24, 26, 28, 30, 34, 40, 46],
        mountain: [32, 36, 38, 42, 44, 48, 50]
    },
    // 7
    {
        plain: [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 37, 43, 45, 47],
        mountain: [41, 49, 51]
    },
    // 8
    {
        plain: [0, 4, 8, 10, 12, 14, 16, 18, 22, 24, 48],
        mountain: [26, 28, 30, 32, 34, 36, 38, 40, 44, 50]
    },
    // 9
    {
        plain: [1, 3, 5, 7, 9, 13, 15, 17, 19, 21, 23, 33, 35, 37, 49],
        mountain: [25, 29, 31, 39, 41, 43, 45, 47, 51]
    },
    // 10
    {
        plain: [2, 4, 6, 10, 12, 14, 18, 20, 22, 34, 36, 40, 44],
        mountain: [24, 26, 28, 30, 32, 42, 46, 50]
    },
    // 11
    {
        plain: [5, 7, 9, 11, 13, 15, 17, 19, 21, 35, 39, 43, 49],
        mountain: [25, 27, 29, 31, 33, 37, 41, 45, 47, 51]
    },
    // 12
    {
        plain: [4, 6, 8, 10, 12, 14, 16, 18, 22, 34, 38, 46],
        mountain: [24, 26, 28, 30, 32, 36, 40, 42, 44, 48, 50]
    },
    // 13
    {
        plain: [5, 9, 11, 13, 15, 19, 21, 23, 33, 37, 45],
        mountain: [25, 27, 31, 35, 39, 43, 47, 51]
    },
    // 14
    {
        plain: [4, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 38, 44, 46],
        mountain: [30, 34, 40, 42, 48, 50]
    },
    // 15
    {
        plain: [7, 11, 13, 15, 17, 19, 23, 27, 29, 37, 41, 49],
        mountain: [31, 33, 35, 39, 43, 45, 47]
    },
    // 16
    {
        plain: [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 40, 42, 48],
        mountain: [32, 34, 36, 38, 46, 50]
    },
    // 17
    {
        plain: [5, 7, 9, 11, 13, 15, 17, 21, 25, 29, 31, 45],
        mountain: [33, 39, 41, 43, 47, 49, 51]
    },
    // 18
    { plain: [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 44, 46], mountain: [32, 42, 48] },
    // 19
    { plain: [3, 5, 7, 9, 13, 15, 19, 21, 23, 25, 27, 29], mountain: [31, 43, 45, 47] },
    // 20
    { plain: [2, 8, 10, 12, 14, 16, 20, 22, 24, 26, 28], mountain: [30, 44, 46] },
    // 21
    { plain: [7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27] },
    // 22
    { plain: [8, 10, 12, 14, 16, 18, 20, 22, 26], mountain: [28] },
    // 23
    { plain: [25, 27, 29] }
]

// R-8.5: Berlin is one city printed over two hexes. Its id names the north-west cell, the one
// with the house; the south-east cell, with the name and the bonus, is the hex's second cell.
const BERLIN_HEX: HexId = 'hex.de.19-17'
const BERLIN_SECOND_CELL = flatToAxial({ col: 20, drow: 18 })

// In reading order: doubled rows north to south, each west to east.
export const GERMANY_HEXES: readonly Hex[] = flatMapHexes(
    'de',
    GERMANY_TERRAIN_BY_COL,
    GERMANY_CITIES
).map((hex): Hex => (hex.id === BERLIN_HEX ? { ...hex, extraCells: [BERLIN_SECOND_CELL] } : hex))

// R-8.5: the Germany map, flat-topped, with no impassable side. Every city takes a passenger at
// setup, Berlin one.
export const GERMANY_MAP: MapDefinition = {
    id: 'map.de',
    key: 'de',
    orientation: HexOrientation.Flat,
    hexes: GERMANY_HEXES,
    cities: GERMANY_CITIES,
    impassable: [],
    citiesWithoutSetupPassenger: [],
    longDistanceCities: []
}
