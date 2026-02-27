import type { Point } from '@tabletop/common'

export type DeedCardPosition = Point

export type DeedCardPositionsByDeed = Record<string, DeedCardPosition>

export const DEED_CARD_POSITIONS_STORAGE_KEY = 'indonesia-deed-card-positions-v1'

export const DEED_CARD_POSITIONS: DeedCardPositionsByDeed = {
    'R01:Production': { x: 123.7, y: 120.8 },
    'R02:Shipping': { x: 437.5, y: 186.2 },
    'R03:Production': { x: 232.9, y: 619.8 },
    'R04:Production': { x: 564.4, y: 379.6 },
    'R07:Production': { x: 720.8, y: 582.0 },
    'R08:Shipping': { x: 478.1, y: 1024.9 },
    'R09:Production': { x: 1233.4, y: 178.0 },
    'R10:Production': { x: 816.1, y: 500.2 },
    'R11:Production': { x: 1405.2, y: 325.2 },
    'R13:Production': { x: 1297.9, y: 577.8 },
    'R14:Shipping': { x: 1569.7, y: 306.4 },
    'R15:Production': { x: 1674.1, y: 647.1 },
    'R16:Production': { x: 1409.0, y: 507.8 },
    'R18:Production': { x: 659.9, y: 953.9 },
    'R18:Shipping': { x: 534.7, y: 1050.9 },
    'R19:Production': { x: 878.1, y: 1011.6 },
    'R20:Shipping': { x: 963.3, y: 1143.9 },
    'R21:Production': { x: 1220.8, y: 1069.5 },
    'R24:Production': { x: 1951.3, y: 746.8 },
    'R26:Production': { x: 1831.3, y: 469.3 },
    'R26:Shipping': { x: 2030.1, y: 423.1 },
    'R27:Production': { x: 2402.5, y: 555.4 }
}
