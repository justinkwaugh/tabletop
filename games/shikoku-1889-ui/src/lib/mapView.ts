import ARToken from './images/tokens/AR.svg'
import IRToken from './images/tokens/IR.svg'
import SRToken from './images/tokens/SR.svg'
import KOToken from './images/tokens/KO.svg'
import TRToken from './images/tokens/TR.svg'
import KUToken from './images/tokens/KU.svg'
import URToken from './images/tokens/UR.svg'
import { Shikoku1889Map, Shikoku1889TileSet } from '@tabletop/shikoku-1889'
import type { MapViewDefinition } from '@tabletop/18xx-ui'

export const Shikoku1889MapView: MapViewDefinition = {
    // Fitted to keep every drawn market cell and the depot 12 map units clear of every hex, with the
    // market at TOP's scale.
    boardAreas: {
        market: { x: -412, y: -200, width: 817, height: 659 },
        depot: { x: 416, y: -200, width: 381, height: 187 }
    },
    map: Shikoku1889Map,
    // Diesel is a train, not a phase, so its value prints as D100 on charcoal.
    revenueStageColors: { diesel: '#3b3f42' },
    revenueStageLabels: { diesel: 'D' },
    terrainCostPrefix: '¥',
    // Kouchi's tracks fill its top and right, so its K, revenue and name take the open corners.
    layouts: {
        F9: { labelPosition: { x: 38, y: 0 }, revenuePositions: { city: { x: -17.2, y: -29.8 } } },
        // Ohzu's revenue takes its northeast corner.
        C4: { revenuePositions: { city: { x: 17.5, y: -30.3 } } },
        // Kotohira's H sits in its west corner.
        I4: { labelPosition: { x: -36, y: 0 } }
    },
    namePositions: { F9: { x: 0, y: 21.5 }, B7: { x: 0, y: 21.5 } },
    terrainHeights: { F9: 31 },
    markerArt: {
        port: { tileSymbol: 'port' },
        'ehime-railroad': { localLine: true },
        'takamatsu-electric-track': { localLine: true, above: true }
    },
    tileSet: Shikoku1889TileSet,
    stations: {
        KO: { color: '#d81e3e', label: 'KO', imageUrl: KOToken },
        TR: { color: '#00a993', label: 'TR', imageUrl: TRToken },
        KU: { color: '#0189d1', label: 'KU', imageUrl: KUToken },
        UR: { color: '#6f533e', label: 'UR', imageUrl: URToken },
        AR: { color: '#3c714e', label: 'AR', imageUrl: ARToken },
        IR: { color: '#305fa4', label: 'IR', imageUrl: IRToken },
        SR: { color: '#a34c35', label: 'SR', imageUrl: SRToken }
    }
}
