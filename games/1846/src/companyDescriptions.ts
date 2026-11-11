import { placeReference as place } from '@tabletop/18xx'
import { MeatPackingLocations, PrivateTrackBlocks } from './map.js'

const places = (locationIds: readonly string[], type: 'conjunction' | 'disjunction') =>
    new Intl.ListFormat('en', { type }).format(locationIds.map(place))

export const CompanyDescriptions1846: Readonly<Record<string, string>> = {
    MS: `Independent railroad in ${place('C15')}. Operates first, splitting its revenue with its owner.`,
    BIG4: `Independent railroad in ${place('G9')}. Operates after Michigan Southern, splitting its revenue with its owner.`,
    'C&WI': `Grants an extra free station in the reserved Chicago & Western Indiana space in ${place('D6')}.`,
    MAIL: 'Adds $10 for every city visited by one train. Remains open once purchased by a corporation.',
    LSL: `One extra free upgrade in ${place('E17')} or ${place('D14')}.`,
    LM: `If ${place('H12')} and ${place('G13')} are not connected, grants an extra free tile lay or upgrade in each hex to connect them.`,
    MC: `Two extra free yellow tile lays in the Michigan Central hexes, ${places(PrivateTrackBlocks.MC, 'conjunction')}.`,
    'O&I': `Two extra free yellow tile lays in the Ohio & Indiana hexes, ${places(PrivateTrackBlocks['O&I'], 'conjunction')}.`,
    BT: 'Adds a $20 revenue marker to an eligible location during phases I–III.',
    SC: 'Adds a $20-per-port-symbol revenue marker at one port.',
    MPC: `Adds a $30 revenue marker in ${places(MeatPackingLocations, 'disjunction')}.`,
    TBC: 'Reduces each mountain, pass, or tunnel cost by $20.'
}
