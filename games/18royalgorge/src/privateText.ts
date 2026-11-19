import { assertExists } from '@tabletop/common'
import type { PrivateRules } from '@tabletop/18xx'
import {
    CoalCreekId,
    CoalDepotId,
    GhostTownId,
    JewelerId,
    PrivateCatalogRoyalGorge,
    SteelDepotId
} from './companies.js'
import { GhostTownCount } from './gold.js'
import { requireStateRoyalGorge } from './state.js'

const counted = (count: number, kind: string) => `${count} ${kind}${count === 1 ? '' : 's'}`

/** What a private holds on its card now, for its owner (Y2, Y3, Y6, G6, B3). */
export function privateCardContents(state: object, privateId: string): string | undefined {
    const title = requireStateRoyalGorge(state)
    switch (privateId) {
        case CoalCreekId:
            return `${counted(title.coalCreekCubes, 'coal cube')}, ${title.coalCreekSupply} in the mine`
        case CoalDepotId:
            return counted(title.coalDepotCubes, 'coal cube')
        case SteelDepotId:
            return counted(title.depotSteel, 'steel cube')
        case GhostTownId:
            return `${counted(GhostTownCount - title.ghostTowns.length, 'ghost town')} left`
        case JewelerId:
            return title.jewelerCash ? `$${title.jewelerCash} on the card` : undefined
        default:
            return undefined
    }
}

/** A private's card text with what it holds now: coal, steel, ghost towns or the jeweler's money. */
export const privateDescription: PrivateRules['description'] = (state, privateId) => {
    const text = PrivateCatalogRoyalGorge.definition(privateId).description
    assertExists(text, `Private ${privateId} has its card text`)
    const contents = privateCardContents(state, privateId)
    return contents ? `${text} Now: ${contents}.` : text
}
