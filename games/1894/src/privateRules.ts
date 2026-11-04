import {
    RailwayMapState,
    currentPrivateRevenue,
    getCompany,
    privateOwner,
    type MapStateData,
    type PrivateRules,
    type StockState
} from '@tabletop/18xx'
import { EighteenNinetyFourCharters } from './charters.js'
import { EighteenNinetyFourMap } from './map.js'
import {
    AntwerpRotterdamPrivateId,
    EighteenNinetyFourPrivateCatalog,
    MajorShareholdings,
    SaintQuentinPrivateId
} from './privates.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import { EighteenNinetyFourPhases } from './trains.js'

const SaintQuentinLocationId = 'G10'
const SaintQuentinRevenue: Readonly<Record<string, number>> = { green: 70, brown: 100 }

/**
 * What a private pays as an operating round starts: Antwerpen-Rotterdam earns more for a
 * company, and Saint-Quentin à Guise follows Saint-Quentin's tile (§11.2.2.2, §11.2.2.5).
 */
export function privateIncome1894(
    state: StockState & Pick<MapStateData, 'tileInventory'>,
    privateId: string
): number {
    if (getCompany(state, privateId).closed) return 0
    if (privateId === AntwerpRotterdamPrivateId)
        return privateOwner(state, privateId)?.kind === 'company' ? 10 : 5
    if (privateId === SaintQuentinPrivateId) {
        const tile = new RailwayMapState(
            EighteenNinetyFourMap,
            EighteenNinetyFourTileSet,
            state.tileInventory
        ).tile(SaintQuentinLocationId)
        return SaintQuentinRevenue[tile.face.color] ?? 0
    }
    return currentPrivateRevenue(state, EighteenNinetyFourCharters, privateId)
}

export const EighteenNinetyFourPrivateRules: PrivateRules = {
    exchangeTerms: () => undefined,
    // Privates close as phase 6 begins, Saint-Quentin à Guise as phase D (§11.2.1).
    phaseEffects(state) {
        const effects = EighteenNinetyFourPrivateCatalog.closureEffects(state)
        const saintQuentin = state.companies.find((company) => company.id === SaintQuentinPrivateId)
        return saintQuentin &&
            !saintQuentin.closed &&
            EighteenNinetyFourPhases.isAtLeast(state.phaseId, 'D')
            ? [...effects, { kind: 'close', privateCompanyId: SaintQuentinPrivateId }]
            : effects
    },
    // A major shareholding closes when its company operates (§11.2.2.8–9).
    operationEffects: (state, companyId) =>
        state.companies
            .filter((company) => !company.closed && MajorShareholdings[company.id] === companyId)
            .map((company) => ({ kind: 'close', privateCompanyId: company.id })),
    description: (_state, id) => EighteenNinetyFourPrivateCatalog.definition(id).description ?? ''
}
