import { TheOldPrinceMap, TheOldPrinceTileSet } from '@tabletop/the-old-prince'
import type { MapViewDefinition } from '@tabletop/18xx-ui'

export const TheOldPrinceMapView: MapViewDefinition = {
    map: TheOldPrinceMap,
    tileSet: TheOldPrinceTileSet,
    stations: {
        C: { color: '#ad3539', label: 'C' },
        ML: { color: '#ad3539', label: 'ML' },
        So: { color: '#3b62a3', label: 'So' },
        PEIR: { color: '#333333', label: 'PEIR' },
        A: { color: '#795291', label: 'A' },
        MS: { color: '#a56627', label: 'MS' },
        MR: { color: '#4b7b43', label: 'MR' },
        S: { color: '#286b73', label: 'S' },
        Gt: { color: '#a14372', label: 'Gt' }
    }
}
