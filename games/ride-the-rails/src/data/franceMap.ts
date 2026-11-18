import { HexOrientation } from '@tabletop/common'
import type { City, Hex, ImpassablePair, MapDefinition } from './boardMap.js'
import { flatMapHexes, type TerrainColumn } from './flatTerrain.js'
import type { HexId } from './hexes.js'

// franceMap.ts, Cities, in reading order (R-4.1.4, R-4.2, R-4.3, R-8.4). Paris has no limit and
// prints its bonus; the Red/Blue/Black cities (Lille, Valenciennes, Sedan, Metz) hold one each,
// and every other city two. The printed spellings are kept.
export const FRANCE_CITIES: readonly City[] = [
    {
        id: 'city.fr.dunkerque',
        name: 'Dunkerque',
        hexId: 'hex.fr.12-0',
        startColours: ['railroad.orange', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.lille',
        name: 'Lille',
        hexId: 'hex.fr.15-1',
        startColours: ['railroad.red', 'railroad.blue', 'railroad.black'],
        capacity: 1,
        bonus: null,
        groups: ['red-blue-black']
    },
    {
        id: 'city.fr.valenciennes',
        name: 'Valenciennes',
        hexId: 'hex.fr.17-3',
        startColours: ['railroad.red', 'railroad.blue', 'railroad.black'],
        capacity: 1,
        bonus: null,
        groups: ['red-blue-black']
    },
    {
        id: 'city.fr.dieppe',
        name: 'Dieppe',
        hexId: 'hex.fr.10-4',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.cherbourg',
        name: 'Cherbourg',
        hexId: 'hex.fr.5-5',
        startColours: ['railroad.orange', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.le-havre',
        name: 'Le Havre',
        hexId: 'hex.fr.8-6',
        startColours: ['railroad.orange', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.amiens',
        name: 'Amiens',
        hexId: 'hex.fr.13-7',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.sedan',
        name: 'Sedan',
        hexId: 'hex.fr.19-7',
        startColours: ['railroad.red', 'railroad.blue', 'railroad.black'],
        capacity: 1,
        bonus: null,
        groups: ['red-blue-black']
    },
    {
        id: 'city.fr.caen',
        name: 'Caen',
        hexId: 'hex.fr.8-8',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.rouen',
        name: 'Rouen',
        hexId: 'hex.fr.10-8',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.reims',
        name: 'Reims',
        hexId: 'hex.fr.17-9',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.metz',
        name: 'Metz',
        hexId: 'hex.fr.21-9',
        startColours: ['railroad.red', 'railroad.blue', 'railroad.black'],
        capacity: 1,
        bonus: null,
        groups: ['red-blue-black']
    },
    {
        id: 'city.fr.st-lo',
        name: 'St. Lo',
        hexId: 'hex.fr.6-10',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.brest',
        name: 'Brest',
        hexId: 'hex.fr.0-12',
        startColours: ['railroad.orange', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.nancy',
        name: 'Nancy',
        hexId: 'hex.fr.20-12',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.strasbourg',
        name: 'Strasbourg',
        hexId: 'hex.fr.24-12',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.rennes',
        name: 'Rennes',
        hexId: 'hex.fr.5-13',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.paris',
        name: 'Paris',
        hexId: 'hex.fr.13-13',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 'unlimited',
        bonus: 'bonus.fr.paris',
        groups: []
    },
    {
        id: 'city.fr.troyes',
        name: 'Troyes',
        hexId: 'hex.fr.16-14',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.le-mans',
        name: 'Le Mans',
        hexId: 'hex.fr.9-15',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.lorient',
        name: 'Lorient',
        hexId: 'hex.fr.2-16',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.chaumont',
        name: 'Chaumont',
        hexId: 'hex.fr.18-16',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.laroche',
        name: 'Laroche',
        hexId: 'hex.fr.15-17',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.st-nazaire',
        name: 'St. Nazaire',
        hexId: 'hex.fr.4-18',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.nantes',
        name: 'Nantes',
        hexId: 'hex.fr.6-18',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.tours',
        name: 'Tours',
        hexId: 'hex.fr.10-18',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.orleans',
        name: 'Orleans',
        hexId: 'hex.fr.12-18',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.basel',
        name: 'Basel',
        hexId: 'hex.fr.24-18',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.besancon',
        name: 'Besancon',
        hexId: 'hex.fr.21-19',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.dijon',
        name: 'Dijon',
        hexId: 'hex.fr.18-20',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.chateauroux',
        name: 'Chateauroux',
        hexId: 'hex.fr.12-22',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.poitiers',
        name: 'Poitiers',
        hexId: 'hex.fr.9-23',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.la-rochelle',
        name: 'La Rochelle',
        hexId: 'hex.fr.6-24',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.macon',
        name: 'Macon',
        hexId: 'hex.fr.18-24',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.geneve',
        name: 'Geneve',
        hexId: 'hex.fr.22-24',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.vichy',
        name: 'Vichy',
        hexId: 'hex.fr.15-25',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.culot',
        name: 'Culot',
        hexId: 'hex.fr.20-26',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.limonges',
        name: 'Limonges',
        hexId: 'hex.fr.11-27',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.angouleme',
        name: 'Angouleme',
        hexId: 'hex.fr.8-28',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.clemont-ferrand',
        name: 'Clemont-Ferrand',
        hexId: 'hex.fr.14-28',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.lyon',
        name: 'Lyon',
        hexId: 'hex.fr.18-28',
        startColours: ['railroad.purple', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.perigueux',
        name: 'Perigueux',
        hexId: 'hex.fr.10-30',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.bordeaux',
        name: 'Bordeaux',
        hexId: 'hex.fr.7-31',
        startColours: ['railroad.yellow', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.valence',
        name: 'Valence',
        hexId: 'hex.fr.18-32',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.morcenx',
        name: 'Morcenx',
        hexId: 'hex.fr.6-34',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.capdenac',
        name: 'Capdenac',
        hexId: 'hex.fr.12-34',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.montauban',
        name: 'Montauban',
        hexId: 'hex.fr.9-35',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.toulouse',
        name: 'Toulouse',
        hexId: 'hex.fr.11-37',
        startColours: ['railroad.yellow', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.nimes',
        name: 'Nimes',
        hexId: 'hex.fr.17-37',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.nice',
        name: 'Nice',
        hexId: 'hex.fr.23-37',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.narbonne',
        name: 'Narbonne',
        hexId: 'hex.fr.14-40',
        startColours: ['railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    },
    {
        id: 'city.fr.marseille',
        name: 'Marseille',
        hexId: 'hex.fr.20-40',
        startColours: ['railroad.yellow', 'railroad.black'],
        capacity: 2,
        bonus: null,
        groups: []
    }
]

// franceMap.ts, Terrain: one entry per column, west to east (col 0 is Brest's), each terrain's
// drows north to south. A column's cities are in the city table; the Paris entry hexes are plain.
const FRANCE_TERRAIN_BY_COL: readonly TerrainColumn[] = [
    // 0
    {},
    // 1
    { plain: [11, 13, 15] },
    // 2
    { plain: [12, 14] },
    // 3
    { plain: [11, 13, 15] },
    // 4
    { plain: [12, 14, 16, 20, 22] },
    // 5
    { plain: [7, 9, 11, 15, 17, 19, 21, 23, 31, 33, 35, 37] },
    // 6
    { plain: [6, 8, 12, 14, 16, 20, 22, 26, 28, 30, 32, 36], mountain: [38] },
    // 7
    { plain: [9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 33, 35, 37], mountain: [39] },
    // 8
    { plain: [10, 12, 14, 16, 18, 20, 22, 24, 26, 30, 32, 34, 36, 38], mountain: [40] },
    // 9
    { plain: [5, 7, 9, 11, 13, 17, 19, 21, 25, 27, 29, 31, 33, 37, 39], mountain: [41] },
    // 10
    { plain: [6, 10, 12, 14, 16, 20, 22, 24, 26, 28, 32, 34, 36, 38], mountain: [40] },
    // 11
    { plain: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 29, 31, 33, 35, 39], mountain: [41] },
    // 12
    { plain: [2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 26, 28, 30, 32, 36, 38, 40], mountain: [42] },
    // 13
    { plain: [1, 3, 5, 9, 11, 15, 17, 19, 21, 23, 25, 27, 33, 35, 37, 39], mountain: [29, 31, 41] },
    // 14
    { plain: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 38], mountain: [30, 32, 34, 36, 42] },
    // 15
    { plain: [3, 5, 7, 9, 11, 13, 15, 19, 21, 23, 37, 39], mountain: [27, 29, 31, 33, 35] },
    // 16
    { plain: [2, 4, 6, 8, 10, 12, 16, 18, 20, 22, 24, 26, 38], mountain: [28, 30, 32, 34, 36] },
    // 17
    { plain: [5, 7, 11, 13, 15, 17, 19, 21, 23, 25, 27, 33, 35, 39], mountain: [29, 31] },
    // 18
    { plain: [4, 6, 8, 10, 12, 14, 18, 22, 26, 30, 34, 36, 38] },
    // 19
    { plain: [5, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 35, 37, 39], mountain: [29, 31, 33] },
    // 20
    { plain: [8, 10, 14, 16, 18, 20, 22, 24, 38], mountain: [28, 30, 32, 34, 36] },
    // 21
    { plain: [7, 11, 13, 15, 17, 39, 41], mountain: [21, 23, 25, 27, 29, 31, 33, 35, 37] },
    // 22
    { plain: [8, 10, 12, 14, 16, 38, 40], mountain: [18, 20, 26, 28, 30, 32, 34, 36] },
    // 23
    { plain: [9, 11], mountain: [13, 15, 17] },
    // 24
    { plain: [10] }
]

// R-8.4: the six hexes round Paris, printed "x1" with a train. Each holds one locomotive, and a
// railroad holds only one of them.
export const PARIS_ENTRY_HEXES: readonly HexId[] = [
    'hex.fr.13-11',
    'hex.fr.12-12',
    'hex.fr.14-12',
    'hex.fr.12-14',
    'hex.fr.14-14',
    'hex.fr.13-15'
]

// R-8.4: the seven estuary sides, printed red. The Seine parts Le Havre from Caen; the Loire runs
// three sides between St. Nazaire and Nantes; one side runs under La Rochelle; the Gironde runs
// two sides north of Bordeaux.
const FRANCE_IMPASSABLE: readonly ImpassablePair[] = [
    ['hex.fr.8-6', 'hex.fr.8-8'],
    ['hex.fr.4-18', 'hex.fr.5-19'],
    ['hex.fr.5-17', 'hex.fr.5-19'],
    ['hex.fr.5-17', 'hex.fr.6-18'],
    ['hex.fr.6-24', 'hex.fr.6-26'],
    ['hex.fr.6-28', 'hex.fr.6-30'],
    ['hex.fr.7-29', 'hex.fr.6-30']
]

// In reading order: doubled rows north to south, each west to east.
export const FRANCE_HEXES: readonly Hex[] = flatMapHexes(
    'fr',
    FRANCE_TERRAIN_BY_COL,
    FRANCE_CITIES
).map((hex): Hex =>
    hex.terrain !== 'city' && PARIS_ENTRY_HEXES.includes(hex.id)
        ? { ...hex, groups: ['paris-entry'] }
        : hex
)

// R-8.4: the France map, flat-topped. Every city takes a passenger at setup.
export const FRANCE_MAP: MapDefinition = {
    id: 'map.fr',
    key: 'fr',
    orientation: HexOrientation.Flat,
    hexes: FRANCE_HEXES,
    cities: FRANCE_CITIES,
    impassable: FRANCE_IMPASSABLE,
    citiesWithoutSetupPassenger: [],
    longDistanceCities: []
}
