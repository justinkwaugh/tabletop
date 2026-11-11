import {
    Map1870,
    PlaceRevenueToken,
    PriceProtection1870,
    PrivateRules1870,
    ShareRedemption1870,
    TitleRules1870,
    company1870,
    revenueTokenChoices,
    type HydratedState1870,
    type RevenueTokenChoice,
    type State1870
} from '@tabletop/1870'
import {
    ChooseDestinationStation,
    PlacingDestinationStationState,
    privateOwningCompany
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import {
    ShareActions,
    createEighteenXXSessionClass,
    type AwaitedDecision,
    type HistoricalMapState,
    type TitlePrivatePower
} from '@tabletop/18xx-ui'
import { mapState1870 } from './mapState.js'
import { MapView1870 } from './mapView.js'
import { Presentation1870 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1870, HydratedState1870>
> = createEighteenXXSessionClass<typeof State1870, HydratedState1870>(
    TitleRules1870,
    MapView1870,
    Presentation1870,
    createRouteWorker
)

const place = (locationId: string) => Map1870.location(locationId).name ?? locationId

export class Session1870 extends BaseSession {
    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    readonly shareActions = new ShareActions<HydratedState1870>(
        this,
        PriceProtection1870,
        ShareRedemption1870
    )
    readonly stockPanels = this.titleStockPanels<'company'>([
        {
            id: 'company',
            label: 'Company action',
            available: () => this.shareActions.companyOptions.length > 0
        }
    ])

    readonly connectionRun = $derived.by(() => {
        const run = this.gameState.destinationRun
        if (!run) return undefined
        const company = company1870(run.companyId)
        assertExists(company, 'A connection run belongs to a public company')
        return {
            companyId: run.companyId,
            home: place(company.home),
            destination: place(company.destination)
        }
    })
    readonly destinationChoice = $derived(
        this.gameState.machineState === PlacingDestinationStationState
            ? this.connectionRun
            : undefined
    )
    readonly canChooseDestination = $derived(
        this.canChooseAction && this.validActionTypes.includes('ChooseDestinationStation')
    )
    async chooseDestinationStation(onMap: boolean): Promise<void> {
        const run = this.connectionRun
        assertExists(run, 'A destination station belongs to a connection run')
        await this.applyAction(
            this.createPlayerAction(ChooseDestinationStation, { companyId: run.companyId, onMap })
        )
    }

    protected override titleAwaitedDecision(state: HydratedState1870): AwaitedDecision | undefined {
        const run = state.destinationRun
        if (state.machineState === PlacingDestinationStationState && run)
            return {
                title: 'Connection run',
                companyId: run.companyId,
                text: `${this.companyName(run.companyId)} chooses what becomes of its destination station`
            }
        return this.shareActions.awaitedDecision(state, {
            companyName: (companyId) => this.companyName(companyId),
            companyInitials: (companyId) => this.companyInitials(companyId),
            playerName: (playerId) => this.getPlayerName(playerId),
            money: this.presentation.money
        })
    }

    readonly revenueTokenChoices = $derived(
        this.myPlayer && !this.isViewingHistory
            ? revenueTokenChoices(this.gameState, this.myPlayer.id)
            : []
    )
    private tokenPower(
        privateCompanyId: string,
        kind: RevenueTokenChoice['kind'],
        label: string,
        prompt: string
    ): TitlePrivatePower[] {
        const playerId = this.myPlayer?.id
        const choices = this.revenueTokenChoices.filter((choice) => choice.kind === kind)
        if (!playerId || !choices.length) return []
        return [
            {
                kind: 'location',
                privateCompanyId,
                playerId,
                label,
                prompt,
                locationIds: choices.map((choice) => choice.locationId),
                choose: async (locationId) => {
                    const choice = choices.find((entry) => entry.locationId === locationId)
                    assertExists(choice, 'A token power offers only its own places')
                    await this.applyAction(this.createPlayerAction(PlaceRevenueToken, choice))
                }
            }
        ]
    }
    protected override get titlePrivatePowers(): readonly TitlePrivatePower[] {
        const open = this.gameState.revenueTokens.find((token) => token.kind === 'open-port')
        return [
            ...this.tokenPower(
                'SCC',
                'cattle',
                'Cattle token',
                'Choose a city west of the Mississippi for the Cattle token'
            ),
            ...this.tokenPower(
                'GSC',
                'open-port',
                'Open port',
                'Choose a city on the Gulf or the river for the open port'
            ),
            ...this.tokenPower(
                'GSC',
                'closed-port',
                open ? `Close the port in ${place(open.locationId)}` : 'Closed port',
                open
                    ? 'Choose the port’s city to close it, closing the Gulf Shipping Company'
                    : 'Choose a city for the closed port, closing the Gulf Shipping Company'
            )
        ]
    }

    privateOperationDescription(privateCompanyId: string): string | undefined {
        if (!privateOwningCompany(this.gameState, privateCompanyId)) return undefined
        return PrivateRules1870.description(this.gameState, privateCompanyId)
    }

    protected override projectMapState(state: HydratedState1870): HistoricalMapState {
        return mapState1870(state)
    }
}
