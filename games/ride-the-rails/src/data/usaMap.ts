import { HexOrientation } from '@tabletop/common'
import type { City, CityHex, MapDefinition, TerrainHex } from './boardMap.js'
import { hexCoordinates, hexIdAt, type DoubledCoordinates } from './hexes.js'

// The USA is pointy, and its hexes keep their (row, dcol) beside their ids.
export type UsaHex = (TerrainHex | CityHex) & DoubledCoordinates

type TerrainRow = {
    plain: readonly number[]
    mountain: readonly number[]
}

// usaMap.ts, Cities (R-4.1.4, R-4.2, R-4.3.1, R-4.3.2, R-8.1)
export const USA_CITIES: readonly City[] = [
    {
        id: 'city.usa.seattle',
        name: 'Seattle',
        hexId: 'hex.usa.0-4',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: ['west-coast']
    },
    {
        id: 'city.usa.spokane',
        name: 'Spokane',
        hexId: 'hex.usa.0-10',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.billings',
        name: 'Billings',
        hexId: 'hex.usa.0-22',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.fargo',
        name: 'Fargo',
        hexId: 'hex.usa.0-32',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.butte',
        name: 'Butte',
        hexId: 'hex.usa.1-17',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.bismarck',
        name: 'Bismarck',
        hexId: 'hex.usa.1-27',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.green-bay',
        name: 'Green Bay',
        hexId: 'hex.usa.1-43',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.portland-or',
        name: 'Portland (Oregon)',
        hexId: 'hex.usa.2-4',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: ['west-coast']
    },
    {
        id: 'city.usa.minneapolis',
        name: 'Minneapolis',
        hexId: 'hex.usa.2-36',
        startColours: [],
        capacity: 2,
        bonus: 'bonus.usa.five-dollar',
        groups: []
    },
    {
        id: 'city.usa.portland-me',
        name: 'Portland (Maine)',
        hexId: 'hex.usa.2-64',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.rapid-city',
        name: 'Rapid City',
        hexId: 'hex.usa.3-25',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.milwaukee',
        name: 'Milwaukee',
        hexId: 'hex.usa.3-41',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.boise',
        name: 'Boise',
        hexId: 'hex.usa.4-10',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.pocatello',
        name: 'Pocatello',
        hexId: 'hex.usa.4-16',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.detroit',
        name: 'Detroit',
        hexId: 'hex.usa.4-48',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.buffalo',
        name: 'Buffalo',
        hexId: 'hex.usa.4-52',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.albany',
        name: 'Albany',
        hexId: 'hex.usa.4-58',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.boston',
        name: 'Boston',
        hexId: 'hex.usa.4-62',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.cheyenne',
        name: 'Cheyenne',
        hexId: 'hex.usa.5-23',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.omaha',
        name: 'Omaha',
        hexId: 'hex.usa.5-31',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.des-moines',
        name: 'Des Moines',
        hexId: 'hex.usa.5-37',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.chicago',
        name: 'Chicago',
        hexId: 'hex.usa.5-43',
        startColours: ['railroad.orange', 'railroad.yellow', 'railroad.black'],
        capacity: 'unlimited',
        bonus: 'bonus.usa.chicago',
        groups: []
    },
    {
        id: 'city.usa.salt-lake-city',
        name: 'Salt Lake City',
        hexId: 'hex.usa.6-16',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.new-york',
        name: 'New York',
        hexId: 'hex.usa.6-60',
        startColours: ['railroad.blue', 'railroad.red', 'railroad.orange', 'railroad.black'],
        capacity: 1,
        bonus: null,
        groups: ['east-coast']
    },
    {
        id: 'city.usa.reno',
        name: 'Reno',
        hexId: 'hex.usa.7-7',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.pittsburgh',
        name: 'Pittsburgh',
        hexId: 'hex.usa.7-51',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.philadelphia',
        name: 'Philadelphia',
        hexId: 'hex.usa.7-57',
        startColours: ['railroad.blue', 'railroad.red', 'railroad.orange', 'railroad.black'],
        capacity: 1,
        bonus: null,
        groups: ['east-coast']
    },
    {
        id: 'city.usa.denver',
        name: 'Denver',
        hexId: 'hex.usa.8-22',
        startColours: [],
        capacity: 2,
        bonus: 'bonus.usa.five-dollar',
        groups: []
    },
    {
        id: 'city.usa.kansas-city',
        name: 'Kansas City',
        hexId: 'hex.usa.8-32',
        startColours: [],
        capacity: 2,
        bonus: 'bonus.usa.five-dollar',
        groups: []
    },
    {
        id: 'city.usa.saint-louis',
        name: 'Saint Louis',
        hexId: 'hex.usa.8-38',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.cincinnati',
        name: 'Cincinnati',
        hexId: 'hex.usa.8-46',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.san-francisco',
        name: 'San Francisco',
        hexId: 'hex.usa.9-5',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: ['west-coast']
    },
    {
        id: 'city.usa.baltimore',
        name: 'Baltimore',
        hexId: 'hex.usa.9-55',
        startColours: ['railroad.blue', 'railroad.red', 'railroad.orange', 'railroad.black'],
        capacity: 1,
        bonus: null,
        groups: ['east-coast']
    },
    {
        id: 'city.usa.las-vegas',
        name: 'Las Vegas',
        hexId: 'hex.usa.10-14',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.oklahoma-city',
        name: 'Oklahoma City',
        hexId: 'hex.usa.10-30',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.nashville',
        name: 'Nashville',
        hexId: 'hex.usa.10-42',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.santa-fe',
        name: 'Santa Fe',
        hexId: 'hex.usa.11-21',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.little-rock',
        name: 'Little Rock',
        hexId: 'hex.usa.11-37',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.washington',
        name: 'Washington',
        hexId: 'hex.usa.11-55',
        startColours: ['railroad.blue', 'railroad.red', 'railroad.orange', 'railroad.black'],
        capacity: 1,
        bonus: null,
        groups: ['east-coast']
    },
    {
        id: 'city.usa.los-angeles',
        name: 'Los Angeles',
        hexId: 'hex.usa.12-10',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: ['west-coast']
    },
    {
        id: 'city.usa.atlanta',
        name: 'Atlanta',
        hexId: 'hex.usa.12-46',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.charleston',
        name: 'Charleston',
        hexId: 'hex.usa.12-52',
        startColours: ['railroad.blue', 'railroad.red', 'railroad.orange', 'railroad.black'],
        capacity: 1,
        bonus: null,
        groups: ['east-coast']
    },
    {
        id: 'city.usa.phoenix',
        name: 'Phoenix',
        hexId: 'hex.usa.13-17',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.dallas',
        name: 'Dallas',
        hexId: 'hex.usa.13-31',
        startColours: [],
        capacity: 2,
        bonus: 'bonus.usa.five-dollar',
        groups: []
    },
    {
        id: 'city.usa.el-paso',
        name: 'El Paso',
        hexId: 'hex.usa.14-24',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.jacksonville',
        name: 'Jacksonville',
        hexId: 'hex.usa.14-50',
        startColours: ['railroad.blue', 'railroad.red', 'railroad.orange', 'railroad.black'],
        capacity: 1,
        bonus: null,
        groups: ['east-coast']
    },
    {
        id: 'city.usa.houston',
        name: 'Houston',
        hexId: 'hex.usa.15-35',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.new-orleans',
        name: 'New Orleans',
        hexId: 'hex.usa.15-41',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.tampa',
        name: 'Tampa',
        hexId: 'hex.usa.16-48',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.corpus-christi',
        name: 'Corpus Christi',
        hexId: 'hex.usa.17-31',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.usa.miami',
        name: 'Miami',
        hexId: 'hex.usa.18-50',
        startColours: [],
        capacity: 2,
        bonus: null,
        groups: []
    }
]

// usaMap.ts, Terrain: the non-city hexes of each row, from row 0, as dcol values
const USA_TERRAIN_BY_ROW: readonly TerrainRow[] = [
    { plain: [8, 12, 16, 18, 20, 24, 26, 28, 30, 34, 36, 38, 64], mountain: [6, 14] },
    { plain: [3, 7, 9, 11, 19, 21, 23, 25, 29, 31, 33, 35, 37, 39, 41, 63], mountain: [5, 13, 15] },
    {
        plain: [8, 10, 18, 20, 22, 24, 26, 28, 30, 32, 34, 38, 40, 42, 46, 58, 60, 62],
        mountain: [6, 12, 14, 16]
    },
    {
        plain: [3, 7, 9, 11, 13, 21, 23, 27, 29, 31, 33, 35, 37, 39, 45, 47, 57, 61],
        mountain: [5, 15, 17, 19, 59]
    },
    {
        plain: [4, 8, 12, 14, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 46, 54, 56, 60],
        mountain: [6, 18]
    },
    {
        plain: [
            3, 7, 9, 11, 13, 15, 17, 19, 21, 25, 27, 29, 33, 35, 39, 41, 45, 47, 53, 55, 59, 61, 63
        ],
        mountain: [5, 57]
    },
    {
        plain: [
            4, 8, 10, 12, 14, 18, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 58
        ],
        mountain: [6, 20, 54, 56]
    },
    {
        plain: [3, 9, 11, 13, 15, 17, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 55],
        mountain: [5, 19, 21, 53]
    },
    {
        plain: [4, 10, 12, 14, 16, 24, 26, 28, 30, 34, 36, 40, 42, 44, 48, 50, 54, 56],
        mountain: [6, 8, 18, 20, 52]
    },
    {
        plain: [7, 11, 13, 15, 23, 25, 27, 29, 31, 33, 37, 39, 41, 43, 45, 47, 53],
        mountain: [9, 17, 19, 21, 35, 49, 51]
    },
    {
        plain: [6, 8, 12, 16, 22, 24, 26, 28, 32, 38, 40, 44, 46, 52, 54, 56],
        mountain: [10, 18, 20, 34, 36, 48, 50]
    },
    {
        plain: [7, 9, 13, 15, 19, 23, 25, 27, 29, 31, 33, 35, 39, 41, 43, 45, 47, 51, 53],
        mountain: [11, 17, 49]
    },
    {
        plain: [12, 14, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 48, 50],
        mountain: [16]
    },
    {
        plain: [11, 13, 15, 19, 21, 23, 25, 27, 29, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51],
        mountain: []
    },
    { plain: [18, 20, 22, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48], mountain: [] },
    { plain: [25, 27, 29, 31, 33, 47, 49], mountain: [] },
    { plain: [30, 32, 50], mountain: [] },
    { plain: [49, 51], mountain: [] },
    { plain: [], mountain: [] }
]

function terrainHexes(): UsaHex[] {
    return USA_TERRAIN_BY_ROW.flatMap(({ plain, mountain }, row) => [
        ...plain.map((dcol): UsaHex => ({
            id: hexIdAt({ row, dcol }),
            row,
            dcol,
            terrain: 'plain'
        })),
        ...mountain.map((dcol): UsaHex => ({
            id: hexIdAt({ row, dcol }),
            row,
            dcol,
            terrain: 'mountain'
        }))
    ])
}

function cityHexes(): UsaHex[] {
    return USA_CITIES.map((city) => ({
        id: city.hexId,
        ...hexCoordinates(city.hexId),
        terrain: 'city',
        cityId: city.id
    }))
}

// In reading order: rows north to south, each west to east.
export const USA_HEXES: readonly UsaHex[] = [...terrainHexes(), ...cityHexes()].sort(
    (a, b) => a.row - b.row || a.dcol - b.dcol
)

// R-8.1: the base game's map.
export const USA_MAP: MapDefinition = {
    id: 'map.usa',
    key: 'usa',
    orientation: HexOrientation.Pointy,
    hexes: USA_HEXES,
    cities: USA_CITIES,
    impassable: [],
    citiesWithoutSetupPassenger: [],
    longDistanceCities: []
}
