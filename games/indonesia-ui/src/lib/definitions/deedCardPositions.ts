import type { Point } from '@tabletop/common'

export type DeedCardPosition = Point

export type DeedCardPositionsByDeed = Record<string, DeedCardPosition>

export const DEED_CARD_POSITIONS_STORAGE_KEY = 'indonesia-deed-card-positions-v1'

export const DEED_CARD_POSITIONS: DeedCardPositionsByDeed = {
    D01: { x: 1831.7, y: 465.2 },
    D02: { x: 1945.6, y: 754.3 },
    D03: { x: 658.8, y: 952.2 },
    D04: { x: 1221.4, y: 1068.1 },
    D05: { x: 1054.9, y: 1201.6 },
    D06: { x: 404.4, y: 969.1 },
    D07: { x: 1544.0, y: 309.8 },
    D08: { x: 2035.4, y: 422.7 },
    D09: { x: 140.6, y: 102.4 },
    D10: { x: 1421.1, y: 326.5 },
    D11: { x: 543.8, y: 336.6 },
    D12: { x: 231.2, y: 612.9 },
    D13: { x: 809.8, y: 505.7 },
    D14: { x: 1408.1, y: 509.1 },
    D15: { x: 877.4, y: 1011.8 },
    D16: { x: 439.4, y: 186.1 },
    D17: { x: 595.5, y: 1138.2 },
    D18: { x: 1724.4, y: 776.7 },
    D19: { x: 792.9, y: 714.3 },
    D20: { x: 2427.9, y: 830.6 },
    D21: { x: 1244.4, y: 764.9 },
    D22: { x: 952.4, y: 285.6 },
    D23: { x: 2102.1, y: 767.2 },
    D24: { x: 2441.2, y: 920.2 }
}
