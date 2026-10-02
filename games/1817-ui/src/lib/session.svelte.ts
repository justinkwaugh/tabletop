import { assert } from '@tabletop/common'
import {
    companyMarketSpace,
    type EighteenXXState,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import type { GameSession } from '@tabletop/frontend-components'
import {
    BuyBackShares,
    EighteenSeventeenTitleRules,
    ShortShare,
    corporateActionOptions,
    shortableCompanyIds
} from '@tabletop/1817'
import { EighteenSeventeenMapView } from './mapView.js'
import { EighteenSeventeenPresentation } from './presentation.js'

const BaseSession = createEighteenXXSessionClass(
    EighteenSeventeenTitleRules,
    EighteenSeventeenMapView,
    EighteenSeventeenPresentation
)

export class EighteenSeventeenSession extends BaseSession {
    corporateActions = $derived.by(() => {
        const playerId = this.gameState.activePlayerIds[0]
        return playerId &&
            (this.validActionTypes.includes('TakeLoan') ||
                this.validActionTypes.includes('BuyBackShares'))
            ? corporateActionOptions(this.gameState, playerId)
            : []
    })
    shortableCompanies = $derived.by(() => {
        const playerId = this.gameState.activePlayerIds[0]
        return playerId && this.validActionTypes.includes('ShortShare')
            ? shortableCompanyIds(this.gameState, playerId)
            : []
    })
    async shortShare(companyId: string) {
        assert(this.shortableCompanies.includes(companyId), 'This company cannot be shorted now')
        await this.applyAction(
            this.createPlayerAction(ShortShare, {
                companyId,
                expectedPrice: companyMarketSpace(this.gameState.stockMarket, companyId).price
            })
        )
    }
    async buyBackShare(companyId: string) {
        const buyBack = this.corporateActions.find(
            (option) => option.companyId === companyId
        )?.buyBack
        assert(
            buyBack && this.validActionTypes.includes('BuyBackShares'),
            'The company cannot buy back a share now'
        )
        await this.applyAction(
            this.createPlayerAction(BuyBackShares, {
                companyId,
                certificateIds: [buyBack.certificateId]
            })
        )
    }
}

export function requireEighteenSeventeenSession(
    session: GameSession<EighteenXXState, HydratedEighteenXXState>
): EighteenSeventeenSession {
    assert(session instanceof EighteenSeventeenSession, 'Expected a 1817 session')
    return session
}
