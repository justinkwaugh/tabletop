import type { ResourceKind } from './mapFeatures.js'

export type ResourceToken = {
    kind: ResourceKind
    /** What a train passing the token adds to its run; resource tokens are never route ends. */
    value: number
    /** The raised value, from phase 5 for oil, or after an upgrade action from phase 3 for ore. */
    raised?: { value: number; when: { phaseId: string } | { upgradeFromPhaseId: string } }
    /** The terrain cost a yellow lay with the token ignores. */
    waivedTerrainCost?: number
    tileUpgradable: boolean
}

/** The resource tokens of §13; a token is placed only with a yellow lay on a hex of its kind. */
export const ResourceTokens: Readonly<Record<ResourceKind, ResourceToken>> = {
    coal: { kind: 'coal', value: 10, waivedTerrainCost: 15, tileUpgradable: true },
    oil: {
        kind: 'oil',
        value: 10,
        raised: { value: 20, when: { phaseId: '5' } },
        tileUpgradable: true
    },
    ore: {
        kind: 'ore',
        value: 10,
        raised: { value: 20, when: { upgradeFromPhaseId: '3' } },
        waivedTerrainCost: 15,
        tileUpgradable: false
    }
}

/** A bridge token adds $10 to its city's value for every company (§13.4). */
export const BridgeTokenValue = 10
