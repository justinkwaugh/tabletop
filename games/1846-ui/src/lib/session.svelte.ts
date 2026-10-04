import { assertExists } from '@tabletop/common'
import { createMapDrawing, stationMapTokens, type MapSelection } from '@tabletop/18xx-ui'
import { MapView1846 } from './mapView.js'
import {
    LayTile,
    FinishTrack,
    TrackConstruction,
    type TrackLayDetails,
    StartCompany,
    BuyShares,
    SellShares,
    FinishStockTurn
} from '@tabletop/18xx'
import { GameSession } from '@tabletop/frontend-components'
import {
    ChooseDraftCard,
    PassFinalCompany,
    choicesFor,
    stockChoices,
    TrackRules1846,
    type EighteenFortySixProjectedState,
    type HydratedEighteenFortySixState
} from '@tabletop/1846'

export class EighteenFortySixSession extends GameSession<
    EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> {
    private openedPacketKey = $state<string>()
    private readonly packetKey = $derived(
        `${this.gameState.id}:${this.gameState.actionCount}:${this.myPlayer?.id}`
    )
    readonly packetVisible = $derived(
        !this.updatingVisibleState && this.openedPacketKey === this.packetKey
    )
    readonly draftChoices = $derived(
        this.myPlayer ? choicesFor(this.gameState, this.myPlayer.id) : []
    )
    readonly stockChoices = $derived(
        this.gameState.machineState === 'StockRound' && this.myPlayer
            ? stockChoices(this.gameState, this.myPlayer.id)
            : undefined
    )
    readonly mapScene = $derived(
        createMapDrawing(
            MapView1846.map,
            { tileSet: MapView1846.tileSet, inventory: this.gameState.tileInventory },
            MapView1846
        )
    )
    readonly mapTokens = $derived(stationMapTokens(this.gameState, MapView1846.stations))
    readonly canSelectTrack = $derived(
        this.gameState.machineState === 'LayingTrack' &&
            this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    readonly construction = $derived(
        this.gameState.machineState === 'LayingTrack'
            ? new TrackConstruction(this.gameState, TrackRules1846)
            : undefined
    )
    readonly trackLocations = $derived(
        this.construction
            ? MapView1846.map.definition.locations
                  .filter((location) => this.construction!.choices(location.id).length)
                  .map((location) => location.id)
            : []
    )
    selectedLocation = $derived.by((): string | undefined => {
        void [
            this.gameState.id,
            this.gameState.actionCount,
            this.myPlayer?.id,
            this.updatingVisibleState,
            this.canSelectTrack
        ]
        return undefined
    })
    readonly selectedTrackChoices = $derived(
        this.selectedLocation && !this.updatingVisibleState
            ? (this.construction?.choices(this.selectedLocation) ?? [])
            : []
    )
    selectMap(selection: MapSelection): void {
        if (!this.canSelectTrack) return
        this.selectedLocation = selection.locationId || undefined
    }
    backFromTrack(): void {
        this.selectedLocation = undefined
    }
    async layTrack(choice: TrackLayDetails): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(LayTile, {
                companyId: choice.companyId,
                locationId: choice.locationId,
                definitionId: choice.definitionId,
                rotation: choice.rotation,
                nodeMapping: choice.nodeMapping,
                expectedCost: choice.cost
            })
        )
    }
    async finishTrack(): Promise<void> {
        const companyId = this.gameState.trackStep?.companyId
        assertExists(companyId, 'Track construction requires an operating company')
        await this.applyAction(this.createPlayerAction(FinishTrack, { companyId }))
    }
    override async undo(): Promise<void> {
        if (this.selectedLocation !== undefined) {
            this.selectedLocation = undefined
            return
        }
        await super.undo()
    }
    async startCompany(
        choice: NonNullable<typeof this.stockChoices>['starts'][number]
    ): Promise<void> {
        await this.applyAction(this.createPlayerAction(StartCompany, choice))
    }
    async buyShare(choice: NonNullable<typeof this.stockChoices>['buys'][number]): Promise<void> {
        const { companyId: _companyId, source: _source, ...request } = choice
        await this.applyAction(this.createPlayerAction(BuyShares, request))
    }
    async sellShares(
        choice: NonNullable<typeof this.stockChoices>['sells'][number]
    ): Promise<void> {
        await this.applyAction(this.createPlayerAction(SellShares, choice))
    }
    async finishStockTurn(): Promise<void> {
        await this.applyAction(this.createPlayerAction(FinishStockTurn))
    }
    revealPacket(): void {
        this.openedPacketKey = this.packetKey
    }
    hidePacket(): void {
        this.openedPacketKey = undefined
    }
    async choose(cardId: string): Promise<void> {
        this.hidePacket()
        await this.applyAction(this.createPlayerAction(ChooseDraftCard, { cardId }))
    }
    async passFinalCompany(): Promise<void> {
        this.hidePacket()
        await this.applyAction(this.createPlayerAction(PassFinalCompany))
    }
    override beforeNewState(): void {
        this.hidePacket()
        this.selectedLocation = undefined
    }
}
