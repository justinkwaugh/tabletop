import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    createLetterNumberLocationFactory,
    createStagedTileRevenue as revenue,
    createTrackTileFace as track,
    createTownTileFace as town,
    createCityTileFace as city,
    createOffboardTileFace as offboard,
    type MapLocation
} from '@tabletop/18xx'

const Names: Readonly<Record<string, string>> = {
    F3: 'Saijou',
    G4: 'Niihama',
    H7: 'Ikeda',
    A10: 'Sukumo',
    J11: 'Anan',
    G12: 'Nahari',
    E2: 'Matsuyama',
    I2: 'Marugame',
    K8: 'Tokushima',
    C10: 'Kubokawa',
    J5: 'Ritsurin Kouen',
    G10: 'Nangoku',
    J9: 'Komatsujima',
    I12: 'Muki',
    B11: 'Nakamura',
    I4: 'Kotohira',
    C4: 'Ohzu',
    K4: 'Takamatsu',
    B7: 'Uwajima',
    B3: 'Yawatahama',
    G14: 'Muroto',
    F1: 'Imabari',
    J1: 'Sakaide & Okayama',
    L7: 'Naruto & Awaji',
    F9: 'Kouchi'
}

const Homes: Readonly<Record<string, string>> = {
    K8: 'AR',
    E2: 'IR',
    I2: 'SR',
    K4: 'KO',
    F9: 'TR',
    C10: 'KU',
    B7: 'UR'
}

const Markers: Readonly<Record<string, NonNullable<MapLocation['markers']>>> = {
    K4: [
        {
            id: 'takamatsu-electric-track',
            label: 'A',
            description: 'No upgrades while Takamatsu Electric Track is player-owned.'
        }
    ],
    C4: [
        {
            id: 'ehime-railroad',
            label: 'C',
            description:
                'No upgrades while Ehime Railroad is player-owned; selling it grants its seller an immediate upgrade opportunity.'
        }
    ],
    B11: [
        {
            id: 'port',
            label: 'Port',
            description: 'Eligible location for the Mitsubishi Ferry port tile.'
        }
    ],
    G10: [
        {
            id: 'port',
            label: 'Port',
            description: 'Eligible location for the Mitsubishi Ferry port tile.'
        }
    ],
    I12: [
        {
            id: 'port',
            label: 'Port',
            description: 'Eligible location for the Mitsubishi Ferry port tile.'
        }
    ],
    J9: [
        {
            id: 'port',
            label: 'Port',
            description: 'Eligible location for the Mitsubishi Ferry port tile.'
        }
    ]
}

const locations = createLetterNumberLocationFactory({
    orientation: HexOrientation.Flat,
    numberOffset: 0,
    fixedColors: ['gray', 'red'],
    names: Names,
    homes: Homes,
    markers: Markers
})

export const Shikoku1889Map = new RailwayMap({
    id: 'shikoku-1889',
    name: 'Shikoku 1889',
    orientation: HexOrientation.Flat,
    locations: [
        ...locations('D3 H3 J3 B5 C8 E8 I8 D9 I10', track('white', [])),
        ...locations('F3 G4 H7 A10 J11 G12 E2 I2 K8 C10', city('white', [], 0, 1)),
        ...locations('J5 B11 G10 I12 J9', town('white', [[]], 0)),
        ...locations('K6', track('white', []), { terrain: { cost: 80, kinds: ['water'] } }),
        ...locations('H5 I6', track('white', []), {
            terrain: { cost: 80, kinds: ['water', 'mountain'] }
        }),
        ...locations('E4 D5 F5 C6 E6 G6 D7 F7 A8 G8 B9 H9 H11 H13', track('white', []), {
            terrain: { cost: 80, kinds: ['mountain'] }
        }),
        ...locations('I4', city('white', [], 0, 1, ['H']), {
            terrain: { cost: 80, kinds: ['urban'] }
        }),
        ...locations('C4', city('yellow', [2], 20, 1)),
        ...locations('K4', city('yellow', [0, 1, 2], 30, 1, ['T'])),
        ...locations('B7', city('gray', [1, 3, 5], 40, 2)),
        ...locations('B3', town('gray', [[0, 5]], 20)),
        ...locations('G14', town('gray', [[3, 4]], 20)),
        ...locations('J7', track('gray', [[1, 5]])),
        ...locations(
            'F1',
            offboard(
                [0, 1],
                revenue([
                    ['yellow', 30],
                    ['brown', 60],
                    ['diesel', 100]
                ])
            )
        ),
        ...locations(
            'J1',
            offboard(
                [0, 1],
                revenue([
                    ['yellow', 20],
                    ['brown', 40],
                    ['diesel', 80]
                ])
            )
        ),
        ...locations(
            'L7',
            offboard(
                [1, 2],
                revenue([
                    ['yellow', 20],
                    ['brown', 40],
                    ['diesel', 80]
                ])
            )
        ),
        ...locations('F9', city('green', [2, 3, 4, 5], 30, 2, ['K']), {
            terrain: { cost: 80, kinds: ['urban'] }
        })
    ]
})
