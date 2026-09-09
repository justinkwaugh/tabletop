import { Shikoku1889Map, Shikoku1889TileSet } from '@tabletop/shikoku-1889'
import type { MapViewDefinition } from '@tabletop/18xx-ui'

export const Shikoku1889MapView: MapViewDefinition = {
    map: Shikoku1889Map,
    tileSet: Shikoku1889TileSet,
    stations: {
        AR: { color: '#3c714e', label: 'AR' },
        IR: { color: '#305fa4', label: 'IR' },
        SR: { color: '#a34c35', label: 'SR' }
    }
}
