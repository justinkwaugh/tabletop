import { HexDimensions } from '../../../graph/dimensions.js'

export enum HexOrientation {
    Pointy = 'pointy',
    Flat = 'flat'
}

export type HexDefinition = {
    orientation: HexOrientation
    dimensions?: HexDimensions
}
