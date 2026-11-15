import {
    Map1850,
    PlaceEdgeToken,
    PriceProtection1850,
    PrivateRules1850,
    ShareRedemption1850,
    TitleRules1850,
    company1850,
    type HydratedState1850,
    type State1850
} from '@tabletop/1850'
import { BuyStopRights, privateOwningCompany } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import {
    ShareActions,
    StopRightsActions,
    createEighteenXXSessionClass,
    type AwaitedDecision,
    type HistoricalMapState
} from '@tabletop/18xx-ui'
import { mapState1850 } from './mapState.js'
import { MapView1850 } from './mapView.js'
import { Presentation1850 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1850, HydratedState1850>
> = createEighteenXXSessionClass<typeof State1850, HydratedState1850>(
    TitleRules1850,
    MapView1850,
    Presentation1850,
    createRouteWorker
)

export class Session1850 extends BaseSession {
    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    readonly shareActions = new ShareActions<HydratedState1850>(
        this,
        PriceProtection1850,
        ShareRedemption1850
    )
    readonly stockPanels = this.titleStockPanels<'company'>([
        {
            id: 'company',
            label: 'Company action',
            available: () => this.shareActions.companyOptions.length > 0
        }
    ])

    readonly mesabiRights = new StopRightsActions(this, 'BuyStopRights', (companyId) =>
        this.createPlayerAction(BuyStopRights, { companyId })
    )

    readonly edgeTokenArea = $derived.by(() => {
        if (!this.canChooseAction || !this.validActionTypes.includes('PlaceEdgeToken'))
            return undefined
        const companyId = this.gameState.stationStep?.companyId
        const area = companyId ? company1850(companyId)?.edgeArea : undefined
        return area ? Map1850.placeName(area) : undefined
    })
    async placeEdgeToken(): Promise<void> {
        const companyId = this.gameState.stationStep?.companyId
        assertExists(companyId, 'An edge token is placed in the station step')
        await this.applyAction(this.createPlayerAction(PlaceEdgeToken, { companyId }))
    }

    protected override titleAwaitedDecision(state: HydratedState1850): AwaitedDecision | undefined {
        return this.shareActions.awaitedDecision(state, {
            companyName: (companyId) => this.companyName(companyId),
            companyInitials: (companyId) => this.companyInitials(companyId),
            playerName: (playerId) => this.getPlayerName(playerId),
            money: this.presentation.money
        })
    }

    privateOperationDescription(privateCompanyId: string): string | undefined {
        if (!privateOwningCompany(this.gameState, privateCompanyId)) return undefined
        return PrivateRules1850.description(this.gameState, privateCompanyId)
    }

    protected override projectMapState(state: HydratedState1850): HistoricalMapState {
        return mapState1850(state)
    }
}
