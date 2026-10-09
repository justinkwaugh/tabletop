import { assertExists, sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import {
    BuildNetwork,
    ChooseAction,
    CompanyId,
    Develop,
    MachineState,
    OpenAuction,
    PassBid,
    PlaceBid,
    SkipBonusCube,
    TakeDevelopmentCash,
    city,
    type ActionSpace,
    type HcgGameState,
    type HydratedHcgGameState
} from '@tabletop/hill-country-grocers'
import {
    addBuildHex,
    addPayee,
    hasManualSelection,
    popAuctionSelection,
    popBuildSelection,
    popDevelopSelection,
    selectAuctionCompany,
    selectBuildCompany,
    selectDevelopCity,
    selectedHexes,
    selectedPayees,
    type AuctionSelection,
    type BuildSelection,
    type DevelopSelection
} from './selection.js'

export class HcgGameSession extends GameSession<HcgGameState, HydratedHcgGameState> {
    private buildSelection: BuildSelection = $state({})
    private developSelection: DevelopSelection = $state({})
    private auctionSelection: AuctionSelection = $state({})

    myPlayerId = $derived(this.myPlayer?.id)

    canAct = $derived(this.isMyTurn && !this.isViewingHistory && !this.gameState.result)

    private actingIn(...states: MachineState[]): boolean {
        return this.canAct && states.includes(this.gameState.machineState)
    }

    selectableSpaces: ActionSpace[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return playerId && this.actingIn(MachineState.ChoosingAction)
            ? this.gameState.availableSpaces(playerId)
            : []
    })

    async chooseSpace(space: ActionSpace) {
        if (this.selectableSpaces.includes(space)) {
            await this.applyAction(this.createPlayerAction(ChooseAction, { space }))
        }
    }

    placingBonusCube = $derived(this.actingIn(MachineState.PlacingBonusCube))

    buildCompanyOptions: CompanyId[] = $derived.by(() => {
        const playerId = this.myPlayerId
        if (this.placingBonusCube) {
            return [CompanyId.Streamside]
        }
        return playerId && this.actingIn(MachineState.BuildingNetwork)
            ? this.gameState.buildableCompanies(playerId)
            : []
    })

    // A lone option counts as an automatic choice, so Undo steps straight past it.
    buildCompany: CompanyId | undefined = $derived.by(() => {
        const options = this.buildCompanyOptions
        const chosen = this.buildSelection.company?.value
        if (chosen && options.includes(chosen)) {
            return chosen
        }
        return options.length === 1 ? options[0] : undefined
    })

    chosenHexes: AxialCoordinates[] = $derived(
        this.buildCompany ? selectedHexes(this.buildSelection) : []
    )

    maxCubes: number = $derived.by(() => {
        if (!this.buildCompany) {
            return 0
        }
        return this.placingBonusCube ? 1 : this.gameState.maxCubes(this.buildCompany)
    })

    hexTargets: AxialCoordinates[] = $derived.by(() => {
        const companyId = this.buildCompany
        if (!companyId || this.chosenHexes.length >= this.maxCubes) {
            return []
        }
        return this.gameState.nextCubeHexes(companyId, this.chosenHexes)
    })

    chosenCost = $derived(
        this.buildCompany && this.chosenHexes.length > 0
            ? this.gameState.buildCost(this.buildCompany, this.chosenHexes)
            : undefined
    )

    placementCost(coords: AxialCoordinates): number {
        const companyId = this.buildCompany
        assertExists(companyId, 'Store prices need a building company')
        const withHex = this.gameState.buildCost(companyId, [...this.chosenHexes, coords])
        return withHex.total - (this.chosenCost?.total ?? 0)
    }

    selectBuildCompany(companyId: CompanyId) {
        if (this.buildCompanyOptions.includes(companyId)) {
            this.buildSelection = selectBuildCompany(this.buildSelection, companyId)
        }
    }

    async clickHex(coords: AxialCoordinates) {
        const companyId = this.buildCompany
        if (!companyId || !this.hexTargets.some((target) => sameCoordinates(target, coords))) {
            return
        }
        const hexes = [...this.chosenHexes, coords]
        if (
            hexes.length >= this.maxCubes ||
            this.gameState.nextCubeHexes(companyId, hexes).length === 0
        ) {
            await this.buildNetwork(companyId, hexes)
            return
        }
        this.buildSelection = addBuildHex(this.buildSelection, coords)
    }

    async confirmBuild() {
        if (this.buildCompany && this.chosenHexes.length > 0) {
            await this.buildNetwork(this.buildCompany, this.chosenHexes)
        }
    }

    private async buildNetwork(companyId: CompanyId, hexes: AxialCoordinates[]) {
        await this.applyAction(this.createPlayerAction(BuildNetwork, { companyId, hexes }))
    }

    async skipBonusCube() {
        await this.applyAction(this.createPlayerAction(SkipBonusCube, {}))
    }

    private developing = $derived(this.actingIn(MachineState.DevelopingTowns))

    developCity: string | undefined = $derived(
        this.developing ? this.developSelection.city?.value : undefined
    )

    chosenPayees: CompanyId[] = $derived(
        this.developCity ? selectedPayees(this.developSelection) : []
    )

    cityTargets: string[] = $derived(
        this.developing && !this.developCity && this.gameState.turnDevelopments.length < 2
            ? this.gameState.developableCities()
            : []
    )

    payeeOptions: CompanyId[] = $derived(
        this.developCity
            ? this.gameState
                  .grocersInCity(this.developCity)
                  .filter((companyId) => !this.chosenPayees.includes(companyId))
            : []
    )

    payeesDue: number = $derived(
        this.developCity ? this.gameState.builderPaymentsDue(this.developCity) : 0
    )

    mayTakeDevelopmentCash = $derived(
        this.developing && !this.developCity && this.gameState.turnDevelopments.length === 1
    )

    async clickCity(cityId: string) {
        if (!this.cityTargets.includes(cityId)) {
            return
        }
        if (this.gameState.mustChooseBuilderPayees(cityId)) {
            this.developSelection = selectDevelopCity(this.developSelection, cityId)
            return
        }
        await this.applyAction(this.createPlayerAction(Develop, { cityId }))
    }

    async choosePayee(companyId: CompanyId) {
        const cityId = this.developCity
        if (!cityId || !this.payeeOptions.includes(companyId)) {
            return
        }
        const payeeIds = [...this.chosenPayees, companyId]
        if (payeeIds.length >= this.payeesDue) {
            await this.applyAction(this.createPlayerAction(Develop, { cityId, payeeIds }))
            return
        }
        this.developSelection = addPayee(this.developSelection, companyId)
    }

    async takeDevelopmentCash() {
        await this.applyAction(this.createPlayerAction(TakeDevelopmentCash, {}))
    }

    cityName(cityId: string): string {
        return city(cityId).name
    }

    private startingAuction = $derived(this.actingIn(MachineState.StartingAuction))

    auctionCompanyOptions: CompanyId[] = $derived(
        this.startingAuction ? this.gameState.auctionableCompanies() : []
    )

    auctionCompany: CompanyId | undefined = $derived(
        this.startingAuction ? this.auctionSelection.company?.value : undefined
    )

    selectAuctionCompany(companyId: CompanyId) {
        if (this.auctionCompanyOptions.includes(companyId)) {
            this.auctionSelection = selectAuctionCompany(this.auctionSelection, companyId)
        }
    }

    async openAuction(amount: number) {
        const companyId = this.auctionCompany
        if (companyId) {
            await this.applyAction(this.createPlayerAction(OpenAuction, { companyId, amount }))
        }
    }

    bidding = $derived(this.actingIn(MachineState.Bidding))

    async placeBid(amount: number) {
        await this.applyAction(this.createPlayerAction(PlaceBid, { amount }))
    }

    async passBid() {
        await this.applyAction(this.createPlayerAction(PassBid, {}))
    }

    hasManualSelection(): boolean {
        return hasManualSelection(this.buildSelection, this.developSelection, this.auctionSelection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.buildSelection = popBuildSelection(this.buildSelection)
            this.developSelection = popDevelopSelection(this.developSelection)
            this.auctionSelection = popAuctionSelection(this.auctionSelection)
            return
        }
        await super.undo()
    }

    override beforeNewState(): void {
        this.buildSelection = {}
        this.developSelection = {}
        this.auctionSelection = {}
    }
}
