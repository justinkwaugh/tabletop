import { assertExists } from '@tabletop/common'
import {
    dividendEntitlements,
    dividendMarketMove,
    companyMarketSpace,
    getCompany,
    trainsOwnedBy,
    type DistributionState,
    type EarningsRules
} from '@tabletop/18xx'
import { peirShares } from './peir.js'
import type { TheOldPrinceState } from './state.js'
export const TheOldPrinceEarningsRules: EarningsRules = {
    choices: (_state, companyId) =>
        companyId === 'PEIR' ? ['pay', 'half-pay', 'withhold'] : ['pay', 'withhold'],
    shareCount(state, companyId) {
        if (companyId === 'PEIR') return peirShares(state).length
        const count = getCompany(state, companyId).shareCount
        assertExists(count, 'Dividends require a share count')
        return count
    },
    entitlements: (state, companyId) =>
        dividendEntitlements(state, companyId, (certificate) =>
            certificate.poolId === 'reserved'
                ? undefined
                : certificate.owner.kind === 'bank'
                  ? { kind: 'company', companyId }
                  : certificate.owner
        ),
    retainedRevenue: (_state, _companyId, choice, revenue) =>
        choice === 'withhold' ? revenue : choice === 'half-pay' ? Math.ceil(revenue / 2) : 0,
    roundDividend: (_state, companyId, amount) =>
        companyId === 'PEIR' ? Math.ceil(amount) : amount,
    marketEffect(state, companyId, distribution) {
        if (companyId === 'PEIR' || !getCompany(state, companyId).floated)
            return { bonusPerShare: 0 }
        return {
            move: dividendMarketMove(
                state.stockMarket,
                companyId,
                distribution.baseDividendPerShare > 0
            ),
            bonusPerShare:
                distribution.baseDividendPerShare > 0 &&
                companyMarketSpace(state.stockMarket, companyId).price === 400
                    ? 40
                    : 0
        }
    },
    afterDistribution(
        state: DistributionState &
            Pick<TheOldPrinceState, 'fourPlusTrainIdsWithOperatingOpportunity'>,
        companyId
    ) {
        const trains = trainsOwnedBy(state, { kind: 'company', companyId }).filter(
            (train) => train.definitionId === '4+'
        )
        if (!trains.length) return
        state.fourPlusTrainIdsWithOperatingOpportunity = [
            ...new Set([
                ...(state.fourPlusTrainIdsWithOperatingOpportunity ?? []),
                ...trains.map((train) => train.id)
            ])
        ]
    }
}
