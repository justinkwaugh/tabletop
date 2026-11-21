import {
    Companies1860,
    LayerParRanges,
    openLayer,
    requireState1860,
    type Layer
} from '@tabletop/1860'
import { getCompany } from '@tabletop/18xx'

/** Whether a layer's companies may start: open, the one to open next, or later still. */
export type LayerStanding = 'open' | 'next' | 'later'

export type LayerCompany = {
    companyId: string
    /** Its home hex, where the panel shows it on the map. */
    home: string
    started: boolean
}

export type LayerEntry = {
    layer: Layer
    companies: readonly LayerCompany[]
    /** The par prices its companies choose from (Major Companies). */
    parRange: { minimum: number; maximum: number }
    standing: LayerStanding
}

/**
 * The four layers of companies in the order they open: each opens once a company of the layer
 * before has operated or sold out of the IPO (Major Companies).
 */
export function companyLayers(stateObject: object): LayerEntry[] {
    const state = requireState1860(stateObject)
    const open = openLayer(state)
    return ([1, 2, 3, 4] as const).map((layer) => ({
        layer,
        companies: Companies1860.filter((company) => company.layer === layer).map((company) => ({
            companyId: company.id,
            home: company.home,
            started: !!getCompany(state, company.id).started
        })),
        parRange: LayerParRanges[layer],
        standing: layer <= open ? 'open' : layer === open + 1 ? 'next' : 'later'
    }))
}
