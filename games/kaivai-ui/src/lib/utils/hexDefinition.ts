import {
    calculateHexGeometry,
    HexOrientation,
    type HexDefinition,
    type HexGeometry
} from '@tabletop/common'

export const KaivaiHexDefinition: HexDefinition = {
    orientation: HexOrientation.Flat,
    dimensions: { width: 100, height: 87 }
}

export const KaivaiHexGeometry: HexGeometry = calculateHexGeometry(KaivaiHexDefinition, {
    q: 0,
    r: 0
})
