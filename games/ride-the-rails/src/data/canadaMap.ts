import { HexOrientation } from '@tabletop/common'
import type { City, Hex, ImpassablePair, MapDefinition } from './boardMap.js'
import { flatMapHexes, type TerrainColumn } from './flatTerrain.js'

// canadaMap.ts, Cities, in reading order (R-4.1.4, R-4.2, R-4.3, R-8.3). Toronto has no limit and
// prints its bonus; every other city holds two.
export const CANADA_CITIES: readonly City[] = [
    {
        id: 'city.ca.haileybury',
        name: 'Haileybury',
        hexId: 'hex.ca.11-1',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.sault-ste-marie',
        name: 'Sault Ste. Marie',
        hexId: 'hex.ca.0-2',
        startColours: ['railroad.yellow', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.cartier',
        name: 'Cartier',
        hexId: 'hex.ca.6-2',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.thessalon',
        name: 'Thessalon',
        hexId: 'hex.ca.2-4',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.blind-river',
        name: 'Blind River',
        hexId: 'hex.ca.4-4',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.sudbury',
        name: 'Sudbury',
        hexId: 'hex.ca.8-4',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.quebec-city',
        name: 'Québec City',
        hexId: 'hex.ca.30-4',
        startColours: ['railroad.orange', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.north-bay',
        name: 'North Bay',
        hexId: 'hex.ca.11-5',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.maniwaki',
        name: 'Maniwaki',
        hexId: 'hex.ca.19-5',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.trois-rivieres',
        name: 'Trois-Rivières',
        hexId: 'hex.ca.27-5',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.massey',
        name: 'Massey',
        hexId: 'hex.ca.6-6',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.saint-jerome',
        name: 'Saint-Jérôme',
        hexId: 'hex.ca.22-6',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.nicolet',
        name: 'Nicolet',
        hexId: 'hex.ca.28-6',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.mattawa',
        name: 'Mattawa',
        hexId: 'hex.ca.13-7',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.joliette',
        name: 'Joliette',
        hexId: 'hex.ca.25-7',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.britt',
        name: 'Britt',
        hexId: 'hex.ca.8-8',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.pembroke',
        name: 'Pembroke',
        hexId: 'hex.ca.16-8',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.sorel-tracy',
        name: 'Sorel-Tracy',
        hexId: 'hex.ca.26-8',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.thetford-mines',
        name: 'Thetford Mines',
        hexId: 'hex.ca.30-8',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.montreal',
        name: 'Montréal',
        hexId: 'hex.ca.24-10',
        startColours: ['railroad.red', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.asbestos',
        name: 'Asbestos',
        hexId: 'hex.ca.28-10',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.parry-sound',
        name: 'Parry Sound',
        hexId: 'hex.ca.9-11',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.huntsville',
        name: 'Huntsville',
        hexId: 'hex.ca.11-11',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.barrys-bay',
        name: "Barry's Bay",
        hexId: 'hex.ca.15-11',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.arnprior',
        name: 'Arnprior',
        hexId: 'hex.ca.18-12',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.ottawa',
        name: 'Ottawa',
        hexId: 'hex.ca.20-12',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.saint-jean-sur-richelieu',
        name: 'Saint-Jean-sur-Richelieu',
        hexId: 'hex.ca.25-13',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.sutton',
        name: 'Sutton',
        hexId: 'hex.ca.27-13',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.sherbrooke',
        name: 'Sherbrooke',
        hexId: 'hex.ca.29-13',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.owen-sound',
        name: 'Owen Sound',
        hexId: 'hex.ca.6-14',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.orillia',
        name: 'Orillia',
        hexId: 'hex.ca.12-14',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.bancroft',
        name: 'Bancroft',
        hexId: 'hex.ca.14-14',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.cornwall',
        name: 'Cornwall',
        hexId: 'hex.ca.22-14',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.barrie',
        name: 'Barrie',
        hexId: 'hex.ca.8-16',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.peterborough',
        name: 'Peterborough',
        hexId: 'hex.ca.10-16',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.prescott',
        name: 'Prescott',
        hexId: 'hex.ca.20-16',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.walkerton',
        name: 'Walkerton',
        hexId: 'hex.ca.6-18',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.lindsay',
        name: 'Lindsay',
        hexId: 'hex.ca.12-18',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.kingston',
        name: 'Kingston',
        hexId: 'hex.ca.18-18',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.orangeville',
        name: 'Orangeville',
        hexId: 'hex.ca.9-19',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.belleville',
        name: 'Belleville',
        hexId: 'hex.ca.15-19',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.goderich',
        name: 'Goderich',
        hexId: 'hex.ca.5-21',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.kitchener',
        name: 'Kitchener',
        hexId: 'hex.ca.7-21',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.toronto',
        name: 'Toronto',
        hexId: 'hex.ca.11-21',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 'unlimited',
        bonus: 'bonus.ca.toronto',
        groups: []
    },
    {
        id: 'city.ca.hamilton',
        name: 'Hamilton',
        hexId: 'hex.ca.9-23',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.sarnia',
        name: 'Sarnia',
        hexId: 'hex.ca.2-24',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.london',
        name: 'London',
        hexId: 'hex.ca.6-24',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.niagra-falls',
        name: 'Niagra Falls',
        hexId: 'hex.ca.11-25',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.simcoe',
        name: 'Simcoe',
        hexId: 'hex.ca.8-26',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.chatham',
        name: 'Chatham',
        hexId: 'hex.ca.3-27',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.st-thomas',
        name: 'St. Thomas',
        hexId: 'hex.ca.5-27',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.ca.windsor',
        name: 'Windsor',
        hexId: 'hex.ca.1-29',
        startColours: ['railroad.blue', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    }
]

// canadaMap.ts, Terrain: one entry per column, west to east (col 0 is Sault Ste. Marie's), the
// plain hexes' drows north to south. Canada has no mountains; a column's cities are in the city
// table.
const CANADA_TERRAIN_BY_COL: readonly TerrainColumn[] = [
    // 0
    {},
    // 1
    { plain: [1, 3] },
    // 2
    { plain: [2, 28, 30] },
    // 3
    { plain: [1, 3, 25, 29] },
    // 4
    { plain: [2, 24, 26, 28] },
    // 5
    { plain: [1, 3, 5, 19, 23, 25] },
    // 6
    { plain: [4, 16, 20, 22, 26] },
    // 7
    { plain: [1, 3, 5, 7, 15, 17, 19, 23, 25, 27] },
    // 8
    { plain: [2, 6, 18, 20, 22, 24] },
    // 9
    { plain: [1, 3, 5, 7, 9, 17, 21, 25, 27] },
    // 10
    { plain: [2, 4, 6, 8, 10, 12, 14, 18, 20, 22, 24, 26] },
    // 11
    { plain: [3, 7, 9, 13, 15, 17, 19] },
    // 12
    { plain: [2, 4, 6, 8, 10, 12, 16, 20] },
    // 13
    { plain: [1, 3, 5, 9, 11, 13, 15, 17, 19] },
    // 14
    { plain: [2, 4, 6, 8, 10, 12, 16, 18, 20] },
    // 15
    { plain: [1, 3, 5, 7, 9, 13, 15, 17] },
    // 16
    { plain: [2, 4, 6, 10, 12, 14, 16, 18] },
    // 17
    { plain: [1, 3, 5, 7, 9, 11, 13, 15, 17] },
    // 18
    { plain: [2, 4, 6, 8, 10, 14, 16] },
    // 19
    { plain: [1, 3, 7, 9, 11, 13, 15, 17] },
    // 20
    { plain: [2, 4, 6, 8, 10, 14] },
    // 21
    { plain: [1, 3, 5, 7, 9, 11, 13, 15] },
    // 22
    { plain: [2, 4, 8, 10, 12] },
    // 23
    { plain: [1, 3, 5, 7, 9, 11, 13] },
    // 24
    { plain: [2, 4, 6, 8, 12] },
    // 25
    { plain: [1, 3, 5, 9, 11] },
    // 26
    { plain: [2, 4, 6, 10, 12] },
    // 27
    { plain: [1, 3, 7, 9, 11] },
    // 28
    { plain: [2, 4, 8, 12] },
    // 29
    { plain: [1, 3, 5, 7, 9, 11] },
    // 30
    { plain: [2, 6, 10, 12] }
]

// R-8.3: the printed impassable sides. One runs east of Hamilton, between the two hexes there;
// the long one runs from Cornwall along Montréal's south side, breaks at its south-east side, and
// goes on north-east to Québec City. Its first two sides lie along the shore, so a cell past
// them is water.
const CANADA_IMPASSABLE: readonly ImpassablePair[] = [
    ['hex.ca.10-22', 'hex.ca.10-24'],
    ['hex.ca.23-13', 'hex.ca.23-15'],
    ['hex.ca.23-13', 'hex.ca.24-14'],
    ['hex.ca.23-13', 'hex.ca.24-12'],
    ['hex.ca.23-11', 'hex.ca.24-12'],
    ['hex.ca.24-10', 'hex.ca.24-12'],
    ['hex.ca.25-9', 'hex.ca.25-11'],
    ['hex.ca.25-9', 'hex.ca.26-10'],
    ['hex.ca.25-9', 'hex.ca.26-8'],
    ['hex.ca.25-7', 'hex.ca.26-8'],
    ['hex.ca.26-6', 'hex.ca.26-8'],
    ['hex.ca.26-6', 'hex.ca.27-7'],
    ['hex.ca.27-5', 'hex.ca.27-7'],
    ['hex.ca.27-5', 'hex.ca.28-6'],
    ['hex.ca.28-4', 'hex.ca.28-6'],
    ['hex.ca.28-4', 'hex.ca.29-5'],
    ['hex.ca.29-3', 'hex.ca.29-5'],
    ['hex.ca.29-5', 'hex.ca.30-4']
]

// In reading order: doubled rows north to south, each west to east.
export const CANADA_HEXES: readonly Hex[] = flatMapHexes('ca', CANADA_TERRAIN_BY_COL, CANADA_CITIES)

// R-8.3: the Canada map, flat-topped. Every city takes a passenger at setup.
export const CANADA_MAP: MapDefinition = {
    id: 'map.ca',
    key: 'ca',
    orientation: HexOrientation.Flat,
    hexes: CANADA_HEXES,
    cities: CANADA_CITIES,
    impassable: CANADA_IMPASSABLE,
    citiesWithoutSetupPassenger: [],
    longDistanceCities: []
}
