import { EighteenUSATileSet, MetropolisCandidates } from '@tabletop/18usa'
import { assertExists } from '@tabletop/common'
import { EighteenUSAMapView } from './mapView.js'

const Denver = MetropolisCandidates.find((candidate) => candidate.orientationChosen)
assertExists(Denver, 'Denver’s metropolis is turned by its first company')
const definition = EighteenUSATileSet.definitions.find((tile) => tile.id === Denver.yellowTileId)
assertExists(definition, 'Denver’s metropolis tile is in the set')

/** Denver's metropolis tile as the map draws it, for choosing how it is turned (§12.2.3). */
export const denverTile = {
    face: definition.face,
    layout: EighteenUSAMapView.layouts?.[definition.id]
}
