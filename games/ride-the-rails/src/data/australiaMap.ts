import { HexOrientation } from '@tabletop/common'
import type { City, Hex, MapDefinition } from './boardMap.js'
import { flatMapHexes, type TerrainColumn } from './flatTerrain.js'

// australiaMap.ts, Cities, in reading order (R-4.1.4, R-4.2, R-4.3, R-8.2). Perth and Brisbane,
// the long-distance cities, hold one locomotive and print their bonus; every other city holds
// two.
export const AUSTRALIA_CITIES: readonly City[] = [
    {
        id: 'city.au.broken-hill',
        name: 'Broken Hill',
        hexId: 'hex.au.11-1',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.menindee',
        name: 'Menindee',
        hexId: 'hex.au.13-3',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.peterborough',
        name: 'Peterborough',
        hexId: 'hex.au.6-6',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.ivanhoe',
        name: 'Ivanhoe',
        hexId: 'hex.au.16-6',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.dubbo',
        name: 'Dubbo',
        hexId: 'hex.au.26-6',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.brisbane',
        name: 'Brisbane',
        hexId: 'hex.au.34-6',
        startColours: [],
        capacity: 1,
        bonus: 'bonus.au.brisbane',
        groups: []
    },
    {
        id: 'city.au.roto',
        name: 'Roto',
        hexId: 'hex.au.19-7',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.mudgee',
        name: 'Mudgee',
        hexId: 'hex.au.29-7',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.muswellbrook',
        name: 'Muswellbrook',
        hexId: 'hex.au.31-7',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.condobolin',
        name: 'Condobolin',
        hexId: 'hex.au.22-8',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.parkes',
        name: 'Parkes',
        hexId: 'hex.au.25-9',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.newcastle',
        name: 'Newcastle',
        hexId: 'hex.au.33-9',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.orange',
        name: 'Orange',
        hexId: 'hex.au.27-11',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.lithgow',
        name: 'Lithgow',
        hexId: 'hex.au.29-11',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.perth',
        name: 'Perth',
        hexId: 'hex.au.0-12',
        startColours: [],
        capacity: 1,
        bonus: 'bonus.au.perth',
        groups: []
    },
    {
        id: 'city.au.mildura',
        name: 'Mildura',
        hexId: 'hex.au.12-12',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.griffith',
        name: 'Griffith',
        hexId: 'hex.au.20-12',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.wyalongo',
        name: 'Wyalongo',
        hexId: 'hex.au.23-13',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.adelaide',
        name: 'Adelaide',
        hexId: 'hex.au.4-14',
        startColours: ['railroad.orange', 'railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.loxton',
        name: 'Loxton',
        hexId: 'hex.au.8-14',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.benanee',
        name: 'Benanee',
        hexId: 'hex.au.14-14',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.hay',
        name: 'Hay',
        hexId: 'hex.au.18-14',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.cowra',
        name: 'Cowra',
        hexId: 'hex.au.26-14',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.narrandera',
        name: 'Narrandera',
        hexId: 'hex.au.21-15',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.sydney',
        name: 'Sydney',
        hexId: 'hex.au.31-15',
        startColours: ['railroad.red', 'railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.murray-bridge',
        name: 'Murray Bridge',
        hexId: 'hex.au.6-16',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.cootamundra',
        name: 'Cootamundra',
        hexId: 'hex.au.24-16',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.goulburn',
        name: 'Goulburn',
        hexId: 'hex.au.28-16',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.pinaroo',
        name: 'Pinaroo',
        hexId: 'hex.au.9-17',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.patchewollock',
        name: 'Patchewollock',
        hexId: 'hex.au.11-17',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.swan-hill',
        name: 'Swan Hill',
        hexId: 'hex.au.14-18',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.deniliquin',
        name: 'Deniliquin',
        hexId: 'hex.au.18-18',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.wagga-wagga',
        name: 'Wagga Wagga',
        hexId: 'hex.au.22-18',
        startColours: ['railroad.yellow', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.yaapeet',
        name: 'Yaapeet',
        hexId: 'hex.au.12-20',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.canberra',
        name: 'Canberra',
        hexId: 'hex.au.26-20',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.bordertown',
        name: 'Bordertown',
        hexId: 'hex.au.9-21',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.echuca',
        name: 'Echuca',
        hexId: 'hex.au.17-21',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.st-arnaud',
        name: 'St. Arnaud',
        hexId: 'hex.au.14-22',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.albury',
        name: 'Albury',
        hexId: 'hex.au.22-22',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.kingston',
        name: 'Kingston',
        hexId: 'hex.au.7-23',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.bendigo',
        name: 'Bendigo',
        hexId: 'hex.au.16-24',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.wangaratta',
        name: 'Wangaratta',
        hexId: 'hex.au.20-24',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.bombala',
        name: 'Bombala',
        hexId: 'hex.au.26-24',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.morea',
        name: 'Morea',
        hexId: 'hex.au.9-25',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.ararat',
        name: 'Ararat',
        hexId: 'hex.au.12-26',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.ballarat',
        name: 'Ballarat',
        hexId: 'hex.au.15-27',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.mount-gambier',
        name: 'Mount Gambier',
        hexId: 'hex.au.8-28',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.melbourne',
        name: 'Melbourne',
        hexId: 'hex.au.17-29',
        startColours: ['railroad.blue', 'railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.bairnsdale',
        name: 'Bairnsdale',
        hexId: 'hex.au.22-30',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.orbost',
        name: 'Orbost',
        hexId: 'hex.au.24-30',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.warrnambool',
        name: 'Warrnambool',
        hexId: 'hex.au.11-31',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.geelong',
        name: 'Geelong',
        hexId: 'hex.au.15-31',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.wonthaggi',
        name: 'Wonthaggi',
        hexId: 'hex.au.18-32',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.au.port-albert',
        name: 'Port Albert',
        hexId: 'hex.au.20-34',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    }
]

// australiaMap.ts, Terrain: one entry per column, west to east (col 0 is Perth's), each terrain's
// drows north to south. A column's cities are in the city table.
const AUSTRALIA_TERRAIN_BY_COL: readonly TerrainColumn[] = [
    // 0
    {},
    // 1
    { 'long-distance': [13] },
    // 2
    { 'long-distance': [12] },
    // 3
    { 'long-distance': [13] },
    // 4
    {},
    // 5
    { plain: [7, 9, 11, 13, 15] },
    // 6
    { plain: [2, 4, 8, 10, 12, 14, 18, 20] },
    // 7
    { plain: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 25, 27] },
    // 8
    { plain: [2, 4, 6, 8, 10, 12, 16, 18, 20, 22, 24, 26] },
    // 9
    { plain: [1, 3, 5, 7, 9, 11, 13, 15, 19, 23, 27, 29] },
    // 10
    { plain: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
    // 11
    { plain: [3, 5, 7, 9, 11, 13, 15, 19, 21, 23, 25, 27, 29] },
    // 12
    { plain: [2, 4, 6, 8, 10, 14, 16, 18, 22, 24, 28, 30] },
    // 13
    { plain: [1, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31] },
    // 14
    { plain: [2, 4, 6, 8, 10, 12, 16, 20, 24, 26, 28, 30, 32] },
    // 15
    { plain: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 29] },
    // 16
    { plain: [2, 4, 8, 10, 12, 14, 16, 18, 20, 22, 26, 28, 30] },
    // 17
    { plain: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 23, 25, 27] },
    // 18
    { plain: [2, 4, 6, 8, 10, 12, 16, 20, 22, 24, 26, 30], mountain: [28] },
    // 19
    { plain: [1, 3, 5, 9, 11, 13, 15, 17, 19, 21, 23, 25, 31, 33], mountain: [29], alps: [27] },
    // 20
    { plain: [2, 4, 6, 8, 10, 14, 16, 18, 20, 22, 32], mountain: [26, 30], alps: [28] },
    // 21
    { plain: [1, 3, 5, 7, 9, 11, 13, 17, 19, 21, 23, 25, 31, 33], mountain: [29], alps: [27] },
    // 22
    { plain: [2, 4, 6, 10, 12, 14, 16, 20], mountain: [24, 28], alps: [26] },
    // 23
    { plain: [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 29], mountain: [23], alps: [25, 27] },
    // 24
    { plain: [2, 4, 6, 8, 10, 12, 14, 18, 20], mountain: [22, 28], alps: [24, 26] },
    // 25
    { plain: [1, 3, 5, 7, 11, 13, 15, 17], mountain: [19, 29], alps: [21, 23, 25, 27] },
    // 26
    { plain: [2, 4, 8, 10, 12, 16, 22, 30], mountain: [18, 26], alps: [28] },
    // 27
    { plain: [1, 3, 5, 7, 9, 17, 19], mountain: [13, 15, 21, 23, 25, 27], alps: [29] },
    // 28
    { plain: [2, 4, 6, 8, 10, 12, 18, 24], mountain: [14, 20, 22] },
    // 29
    { plain: [1, 3, 5, 9, 17, 21], mountain: [13, 15, 19] },
    // 30
    { plain: [2, 4, 6, 12, 14, 16, 18], mountain: [8, 10] },
    // 31
    { plain: [1, 3, 5], mountain: [9, 11, 13] },
    // 32
    { plain: [6, 8], mountain: [10, 12] },
    // 33
    { mountain: [11] },
    // 34
    { 'long-distance': [8] }
]

// In reading order: doubled rows north to south, each west to east.
export const AUSTRALIA_HEXES: readonly Hex[] = flatMapHexes(
    'au',
    AUSTRALIA_TERRAIN_BY_COL,
    AUSTRALIA_CITIES
)

// R-8.2: the Australia map, flat-topped. Perth and Brisbane, the long-distance cities, take no
// passenger at setup.
export const AUSTRALIA_MAP: MapDefinition = {
    id: 'map.au',
    key: 'au',
    orientation: HexOrientation.Flat,
    hexes: AUSTRALIA_HEXES,
    cities: AUSTRALIA_CITIES,
    impassable: [],
    citiesWithoutSetupPassenger: ['city.au.perth', 'city.au.brisbane'],
    longDistanceCities: ['city.au.perth', 'city.au.brisbane']
}
