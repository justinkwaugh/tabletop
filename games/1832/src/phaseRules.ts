import * as Type from 'typebox'
import { EighteenThirtyTwoMarket } from './stockMarket.js'
import { marketDiscardOrder, type PhaseRules } from '@tabletop/18xx'
import { EighteenThirtyTwoPhases } from './trains.js'
import { requireEighteenThirtyTwoState } from './state.js'
import { revenueTokenExpires } from './revenueTokens.js'
import { RevenueToken } from './titleState.js'

const PhaseChanges = Type.Object(
    { removedRevenueTokens: Type.Array(RevenueToken) },
    { additionalProperties: false }
)

export const EighteenThirtyTwoPhaseRules: PhaseRules = {
    // With diesels, 5-trains are permanent; the diesel phase rusts the 4s (§17.2).
    rustTiming: (state, train) =>
        requireEighteenThirtyTwoState(state).variants.diesels && train.definitionId === '5'
            ? undefined
            : EighteenThirtyTwoPhases.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) =>
        marketDiscardOrder(EighteenThirtyTwoMarket, state, companyId),
    discardDestination: 'market',
    changes: {
        schema: PhaseChanges,
        apply(state) {
            const title = requireEighteenThirtyTwoState(state)
            // The privates close at phase 5, with London's record of its share, and Miami pays
            // in full from then on (§8.4, §16.2).
            if (EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '5')) {
                delete title.londonCompanyId
                delete title.miamiRun
            }
            if (EighteenThirtyTwoPhases.isAtLeast(state.phaseId, '8')) delete title.keyWestCompanyId
            const removedRevenueTokens = title.revenueTokens.filter((token) =>
                revenueTokenExpires(token, state.phaseId)
            )
            if (removedRevenueTokens.length)
                title.revenueTokens = title.revenueTokens.filter(
                    (token) => !revenueTokenExpires(token, state.phaseId)
                )
            return { removedRevenueTokens }
        }
    }
}
