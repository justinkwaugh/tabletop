import {
    CorporateFinanceValidator,
    AssignSteamboatValidator,
    SettleIndependentValidator,
    isBuildPrivateTrack,
    isPlaceCWIStation,
    isAssignRevenueMarker
} from '@tabletop/1846'
import type { HistoryMapPlacement, TitleActionDescription } from '@tabletop/18xx-ui'
import type { GameAction } from '@tabletop/common'

/** 1846's own placements, for their history rows' map previews. */
export function mapPlacement1846(action: GameAction): HistoryMapPlacement | undefined {
    if (AssignSteamboatValidator.Check(action))
        return action.assignment
            ? {
                  kind: 'Steamboat',
                  companyId: action.assignment.companyId,
                  locationIds: [action.assignment.locationId]
              }
            : undefined
    if (isBuildPrivateTrack(action))
        return {
            kind: 'track lay',
            companyId: action.privateCompanyId,
            locationIds: action.lays.map((lay) => lay.locationId)
        }
    if (isPlaceCWIStation(action))
        return action.metadata
            ? {
                  kind: 'station',
                  companyId: action.companyId,
                  locationIds: [action.metadata.position.locationId]
              }
            : undefined
    if (isAssignRevenueMarker(action))
        return action.locationId
            ? {
                  kind: 'marker',
                  companyId: action.metadata?.companyId ?? action.privateCompanyId,
                  locationIds: [action.locationId]
              }
            : undefined
    return undefined
}

export const describe1846Action: TitleActionDescription = (action, companyName) => {
    // A draft row never describes its protected card, even in the actor's projection.
    switch (action.type) {
        case 'ChooseDraftCard':
            return { text: 'chose a private draft card' }
        case 'PassFinalCompany':
            return { text: 'passed the final company; reduce its price by $10' }
        case 'RevealDraft':
            return {
                text: 'Private companies revealed and paid for',
                omitActor: true,
                important: true
            }
        case 'BuyOpeningCompany':
            return { text: 'bought an opening company' }
        case 'PassOpeningPurchase':
            return { text: 'passed on opening companies' }
        case 'ResumeOpeningPurchases':
            return { text: 'Opening purchases resume', omitActor: true }
    }
    if (CorporateFinanceValidator.Check(action))
        return {
            text: `${companyName(action.companyId)} ${action.operation === 'issue' ? 'issued' : 'redeemed'} ${action.shares} ${action.shares === 1 ? 'share' : 'shares'} for $${action.amount}`
        }
    if (AssignSteamboatValidator.Check(action))
        return {
            text: action.assignment
                ? `assigned Steamboat to ${companyName(action.assignment.companyId)} at ${action.assignment.locationId}`
                : 'left Steamboat unassigned'
        }
    if (isBuildPrivateTrack(action))
        return {
            text: `${companyName(action.privateCompanyId)} built private track`,
            detail: action.metadata?.lays
                .map((lay) => `${lay.locationId} · $${lay.cost}`)
                .join(', ')
        }
    if (isPlaceCWIStation(action))
        return { text: `${companyName(action.companyId)} placed its C&WI station in Chicago` }
    if (isAssignRevenueMarker(action))
        return {
            text: action.locationId
                ? `placed ${companyName(action.privateCompanyId)} at ${action.locationId}`
                : `skipped ${companyName(action.privateCompanyId)} marker placement`
        }
    if (SettleIndependentValidator.Check(action))
        return {
            text: `${companyName(action.companyId)} split its earnings equally between owner and treasury`,
            omitActor: true
        }
    return undefined
}
