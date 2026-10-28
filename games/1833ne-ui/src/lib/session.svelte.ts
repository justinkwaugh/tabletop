import {
    AssignLuxuryFerry,
    BuyFerry,
    TitleRules1833NE,
    ferryChoices,
    ferryDefinition,
    luxuryChoices,
    type HydratedState1833NE,
    type State1833NE
} from '@tabletop/1833ne'
import { nextOperatingCompany } from '@tabletop/18xx'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import { MapView1833NE } from './mapView.js'
import { Presentation1833NE } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1833NE, HydratedState1833NE>
> = createEighteenXXSessionClass<typeof State1833NE, HydratedState1833NE>(
    TitleRules1833NE,
    MapView1833NE,
    Presentation1833NE,
    createRouteWorker
)

export type FerryOffer = { locationId: string; name: string; value: number }

export class Session1833NE extends BaseSession {
    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState &&
            !this.gameState.purchaseOffer &&
            !this.decisions.selection &&
            !this.privateActions.selection
    )
    readonly ferryOffers = $derived.by((): FerryOffer[] =>
        this.validActionTypes.includes('BuyFerry')
            ? ferryChoices(this.gameState).flatMap((locationId) => {
                  const ferry = ferryDefinition(locationId)
                  return ferry ? [ferry] : []
              })
            : []
    )
    readonly luxuryOffers = $derived.by((): FerryOffer[] =>
        this.validActionTypes.includes('AssignLuxuryFerry')
            ? luxuryChoices(this.gameState).flatMap((locationId) => {
                  const ferry = ferryDefinition(locationId)
                  return ferry ? [ferry] : []
              })
            : []
    )
    private operatingCompanyId(): string {
        const companyId = nextOperatingCompany(this.gameState)
        if (!companyId) throw new Error('Ferries belong to the operating corporation')
        return companyId
    }
    async buyFerry(locationId: string): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(BuyFerry, { companyId: this.operatingCompanyId(), locationId })
        )
    }
    async assignLuxuryFerry(locationId: string): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(AssignLuxuryFerry, {
                companyId: this.operatingCompanyId(),
                locationId
            })
        )
    }
}
