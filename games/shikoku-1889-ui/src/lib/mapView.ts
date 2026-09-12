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
    map: Shikoku1889Map,
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
