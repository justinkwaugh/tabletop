import {
    StationPlacement,
    getCompany,
    sameCenter,
    type CompanyRules,
    type FormationState,
    type MapStateData,
    type StartHome
} from '@tabletop/18xx'
import { isVariableStart } from './companies.js'
import { Map1833NE } from './map.js'
import { StationRules1833NE } from './stations.js'
import { Market1833NE, StandardCompanyRules1833NE } from './stock.js'
import { JointTokenSpot } from './track.js'
import { Phases1833NE } from './trains.js'

/** A Variable Start home in a gray hex or a hex without track costs $80, elsewhere $120 (§5.34). */
export const HomeCosts = { untracked: 80, tracked: 120 } as const
/** A $120 home needs a starting price of at least $60 (§5.34). */
export const TrackedHomeMinimumPrice = 60

/**
 * The open city spots a Variable Start railroad may start in: vacant, not reserved and not the
 * home of a corporation yet to start (§5.34). Sherbrooke's spot is the joint token's (§6.53).
 */
export function variableStartHomes(
    state: FormationState & MapStateData,
    companyId: string
): StartHome[] {
    const placement = new StationPlacement(state, StationRules1833NE)
    return Map1833NE.definition.locations.flatMap((location) => {
        const tile = placement.mapState.tile(location.id)
        const cost =
            tile.face.color === 'gray' || !tile.face.paths.length
                ? HomeCosts.untracked
                : HomeCosts.tracked
        return tile.face.nodes.flatMap((node) => {
            const position = { locationId: location.id, nodeId: node.id }
            const slot = placement.openSlots(companyId, location.id, node.id)[0]
            return slot === undefined || sameCenter(position, JointTokenSpot)
                ? []
                : [{ ...position, slot, cost }]
        })
    })
}

/** Variable Start railroads start from phase II, in a city their president chooses (§5.34). */
export const CompanyRules1833NE: CompanyRules = {
    ...StandardCompanyRules1833NE,
    startMarketSpaces(state, companyId) {
        if (isVariableStart(companyId) && !Phases1833NE.isAtLeast(state.phaseId, 'II')) return []
        return StandardCompanyRules1833NE.startMarketSpaces(state, companyId)
    },
    startHomes(state: FormationState & MapStateData, companyId: string, marketSpaceId: string) {
        if (!isVariableStart(companyId)) return undefined
        const price = Market1833NE.space(marketSpaceId).price
        return variableStartHomes(state, companyId).filter(
            (home) => home.cost === HomeCosts.untracked || price >= TrackedHomeMinimumPrice
        )
    },
    onFloat(state, companyId) {
        if (!isVariableStart(companyId))
            return StandardCompanyRules1833NE.onFloat?.(state, companyId)
        getCompany(state, companyId).funded = true
    }
}
