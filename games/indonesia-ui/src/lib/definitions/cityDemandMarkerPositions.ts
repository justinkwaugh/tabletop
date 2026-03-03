import type { Point } from '@tabletop/common'

export type CityDemandMarkerPosition = Point

export type CityDemandMarkerPositionsByRegion = Readonly<Record<string, CityDemandMarkerPosition>>

export const CITY_DEMAND_MARKER_POSITIONS_BY_REGION: CityDemandMarkerPositionsByRegion = {
    R01: { x: 410.5, y: 110.9 },
    R02: { x: 81.4, y: 467.3 },
    R03: { x: 173.1, y: 736.6 },
    R04: { x: 628.1, y: 194.5 },
    R05: { x: 726.9, y: 446.9 },
    R06: { x: 335.4, y: 864.1 },
    R07: { x: 870.0, y: 611.6 },
    R08: { x: 459.4, y: 1049.1 },
    R09: { x: 1033.8, y: 136.1 },
    R10: { x: 849.2, y: 213.9 },
    R11: { x: 1540.0, y: 237.3 },
    R12: { x: 959.8, y: 694.2 },
    R13: { x: 1098.1, y: 731.8 },
    R14: { x: 1393.7, y: 763.8 },
    R15: { x: 1669.5, y: 878.4 },
    R16: { x: 1597.2, y: 375.7 },
    R17: { x: 1729.1, y: 278.1 },
    R18: { x: 693.4, y: 1083.1 },
    R19: { x: 846.3, y: 1159.4 },
    R20: { x: 1065.1, y: 1133.9 },
    R21: { x: 1275.4, y: 1135.0 },
    R22: { x: 1480.1, y: 1177.4 },
    R23: { x: 1794.8, y: 1161.9 },
    R24: { x: 1981.6, y: 881.3 },
    R26: { x: 1958.2, y: 292.7 },
    R27: { x: 2292.1, y: 492.4 }
}
