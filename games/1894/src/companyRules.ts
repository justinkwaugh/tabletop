import { EighteenNinetyFourCharters } from './charters.js'
import { LateCompanies } from './majors.js'
import { EighteenNinetyFourMarket, ReissueParSpaceId } from './stockMarket.js'
import { EighteenNinetyFourPhases } from './trains.js'
import {
    fullCapitalizationCompanyRules,
    type CompanyRules,
    type FormationState,
    type MapStateData
} from '@tabletop/18xx'
import { lateCompanyHomes } from './lateCompanies.js'

const fullCapitalization = fullCapitalizationCompanyRules({
    market: EighteenNinetyFourMarket,
    charters: EighteenNinetyFourCharters,
    ipoPoolId: 'initial-offering',
    parSpaceColor: 'pink',
    floatPercent: 60
})

/** The ordinary par prices, F67, F80 and F95 (§6.5). */
export const ParSpaceIds: readonly string[] = EighteenNinetyFourMarket.spaces
    .filter((space) => space.color === 'pink')
    .sort((a, b) => a.price - b.price)
    .map((space) => space.id)

export const EighteenNinetyFourCompanyRules: CompanyRules = {
    ...fullCapitalization,
    // Late companies open in the brown phase (§11.3.3).
    startMarketSpaces(state, companyId) {
        if (
            companyId in LateCompanies &&
            !EighteenNinetyFourPhases.isAtLeast(state.phaseId, 'brown')
        )
            return []
        return [...ParSpaceIds]
    },
    // The two shareholding companies' buyers may also choose F100 (§5.3).
    awardParSpaces: () => [...ParSpaceIds, ReissueParSpaceId],
    // A late company's president chooses its home as it starts (§11.3.3).
    startHomes: (state: FormationState & MapStateData, companyId) =>
        lateCompanyHomes(state, companyId),
    parAfterAward: true
}
