import { assertExists } from '@tabletop/common'
import {
    closePrivate,
    privateOwner,
    type CompanyAuctionState,
    type CompanyFormation,
    type StationPosition,
    type StockState
} from '@tabletop/18xx'
import type { EighteenUSAState } from './state.js'
import { Subsidies, resourceSubsidyKinds, type Subsidy } from './subsidies.js'
import { SubsidyPrivateIds, isSubsidyPrivate } from './privates.js'

type SubsidyState = Pick<EighteenUSAState, 'citySubsidies' | 'noSubsidyCityIds' | 'cityBonuses'>

export function subsidy(subsidyId: string): Subsidy {
    const found = Subsidies.find((entry) => entry.id === subsidyId)
    assertExists(found, `Unknown subsidy ${subsidyId}`)
    return found
}

/** The subsidy a city still offers, until the first stock round ends. */
export function citySubsidy(state: SubsidyState, locationId: string): Subsidy | undefined {
    const subsidyId = state.citySubsidies[locationId]
    return subsidyId ? subsidy(subsidyId) : undefined
}

/** A city's cash subsidy, counted as the winner's equity in its company's auction (§11.6.1). */
export function subsidyEquity(
    state: CompanyAuctionState & SubsidyState,
    home: StationPosition
): number {
    const effect = citySubsidy(state, home.locationId)?.effect
    return effect?.kind === 'cash' ? effect.amount : 0
}

const HeldSubsidyPrivates: Readonly<Record<string, string>> = {
    boomtown: SubsidyPrivateIds.boomtown,
    'free-station': SubsidyPrivateIds.freeStation,
    resource: SubsidyPrivateIds.resource
}

/**
 * A company started in a subsidy city takes its subsidy: a city bonus stays on the city, and a
 * Boomtown, Free Station or Resource subsidy goes onto the company's charter until used.
 */
export function claimSubsidy(state: StockState & SubsidyState, formation: CompanyFormation): void {
    const locationId = formation.home.locationId
    const claimed = citySubsidy(state, locationId)
    if (!claimed) return
    delete state.citySubsidies[locationId]
    const effect = claimed.effect
    if (effect.kind === 'city-bonus')
        state.cityBonuses = { ...state.cityBonuses, [locationId]: claimed.id }
    const privateId = HeldSubsidyPrivates[effect.kind]
    if (
        !privateId ||
        (effect.kind === 'resource' && !resourceSubsidyKinds(privatesInPlay(state)).length)
    )
        return
    const certificate = state.certificates.find(
        (entry) => entry.kind === 'private' && entry.companyId === privateId
    )
    assertExists(certificate, 'Every held subsidy has a charter')
    certificate.owner = { kind: 'company', companyId: formation.companyId }
    delete certificate.poolId
}

function privatesInPlay(state: StockState): string[] {
    return state.companies
        .filter((company) => company.kind === 'private' && !isSubsidyPrivate(company.id))
        .map((company) => company.id)
}

/** Unclaimed subsidies leave the game as the first stock round ends (§11.6.1). */
export function removeUnclaimedSubsidies(state: StockState & SubsidyState): void {
    if (!Object.keys(state.citySubsidies).length) return
    state.citySubsidies = {}
    for (const privateId of Object.values(SubsidyPrivateIds))
        if (
            state.companies.some((company) => company.id === privateId && !company.closed) &&
            privateOwner(state, privateId)?.kind === 'bank'
        )
            closePrivate(state, privateId)
}
