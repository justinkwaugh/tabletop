import { assert } from '@tabletop/common'
import {
    ChooseHomeStation,
    DeclinePrivateStation,
    FinishStations,
    PlacePrivateStation,
    privateStationPositions,
    PlaceStation,
    pendingHomeChoice,
    StationPlacement,
    applyStationPlacement,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type HomePosition,
    type StationPosition,
    type StationRequest
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'
import { StagedSelection } from './stagedSelection.svelte.js'
import {
    StationStageOrder,
    automaticStation,
    type StationSelection,
    type StationStages
} from './stationSelection.js'

export type StationsState = ConstructorParameters<typeof StationPlacement>[0] &
    Pick<EighteenXXState, 'machineState' | 'privateStation'>
export type StationsSession<State extends StationsState = StationsState> = ModuleSession<
    State,
    Pick<EighteenXXTitleRules, 'stationRules'>
>

export class StationsModule<State extends StationsState> {
    readonly stages = new StagedSelection<StationStages>(StationStageOrder)
    constructor(
        private readonly session: StationsSession<State>,
        private readonly onPositionChosen: () => void,
        private readonly tokenChoiceRequired: () => boolean
    ) {}

    requiresTokenChoice = $derived.by(() => this.tokenChoiceRequired())

    model = $derived.by(
        () => new StationPlacement(this.session.state, this.session.rules.stationRules)
    )
    canPlace = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('FinishStations')
    )
    available = $derived.by(() =>
        this.session.state.stations.filter(
            (station) =>
                station.companyId === this.session.state.stationStep?.companyId &&
                station.status === 'available'
        )
    )
    selection = $derived.by((): StationSelection => {
        if (!this.session.selectionsVisible || this.session.state.machineState !== 'PlacingStation')
            return {}
        if (this.stages.entry('stationId')) return this.stages.state
        if (
            this.requiresTokenChoice ||
            !this.canPlace ||
            !this.session.validActionTypes.includes('PlaceStation')
        )
            return {}
        const cheapestPlaceable = [...this.available]
            .sort((left, right) => this.placementCost(left.id) - this.placementCost(right.id))
            .find((token) => this.model.choices(token.id).length > 0)
        return cheapestPlaceable ? automaticStation(cheapestPlaceable.id) : {}
    })
    choices = $derived.by(() =>
        this.canPlace && this.selection.stationId
            ? this.model.choices(this.selection.stationId.value)
            : []
    )
    locationIds = $derived.by(() => [
        ...new Set(this.choices.map((choice) => choice.position.locationId))
    ])
    preview = $derived.by(() =>
        this.selection.placement
            ? this.model.evaluate(this.selection.placement.value).details
            : undefined
    )
    displayState = $derived.by((): State => {
        if (!this.preview) return this.session.state
        const state: State = {
            ...this.session.state,
            stations: [...this.session.state.stations],
            stationReservations: [...this.session.state.stationReservations]
        }
        applyStationPlacement(state, this.preview)
        return state
    })

    homeChoice = $derived.by(() =>
        pendingHomeChoice(this.session.state, this.session.rules.stationRules)
    )
    canChooseHome = $derived.by(
        () =>
            this.session.interactive && this.session.validActionTypes.includes('ChooseHomeStation')
    )
    homeLocationIds = $derived.by(() =>
        this.canChooseHome && this.homeChoice
            ? [...new Set(this.homeChoice.positions.map((position) => position.locationId))]
            : []
    )

    privateStation = $derived.by(() =>
        this.session.interactive && this.session.validActionTypes.includes('PlacePrivateStation')
            ? this.session.state.privateStation
            : undefined
    )
    privateStationPositions = $derived.by(() =>
        this.privateStation
            ? privateStationPositions(
                  this.session.state,
                  this.session.rules.stationRules,
                  this.privateStation
              )
            : []
    )
    privateStationLocationIds = $derived.by(() => [
        ...new Set(this.privateStationPositions.map((position) => position.locationId))
    ])

    async placePrivateStation(position: StationPosition) {
        const pending = this.privateStation
        assert(pending, 'No private station is pending')
        await this.session.applyAction(
            this.session.createPlayerAction(PlacePrivateStation, {
                privateCompanyId: pending.privateCompanyId,
                position
            })
        )
    }
    async declinePrivateStation() {
        const pending = this.privateStation
        assert(pending, 'No private station is pending')
        await this.session.applyAction(
            this.session.createPlayerAction(DeclinePrivateStation, {
                privateCompanyId: pending.privateCompanyId
            })
        )
    }
    async chooseHome(position: HomePosition) {
        const choice = this.homeChoice
        assert(this.canChooseHome && choice, 'No home city choice is pending')
        await this.session.applyAction(
            this.session.createPlayerAction(ChooseHomeStation, {
                companyId: choice.companyId,
                ...position
            })
        )
    }
    placementCost(stationId: string): number {
        const { state, rules } = this.session
        const station = state.stations.find((entry) => entry.id === stationId)
        assert(station?.status === 'available', 'Station cost requires an available token')
        return rules.stationRules.pendingHomes(state).some((home) => home.stationId === stationId)
            ? 0
            : rules.stationRules.placementCost(state, stationId)
    }
    select(stationId: string) {
        assert(
            this.canPlace && this.available.some((station) => station.id === stationId),
            'Choose an available station'
        )
        this.stages.clear()
        this.stages.choose('stationId', stationId)
    }
    selectPosition(request: StationRequest) {
        assert(
            this.canPlace &&
                this.selection.stationId?.value === request.stationId &&
                this.model.evaluate(request).details,
            'Choose a legal station position'
        )
        this.stages.state = this.selection
        this.stages.choose('placement', request)
        this.onPositionChosen()
    }
    async confirm() {
        const preview = this.preview
        assert(this.canPlace && preview, 'Choose a legal station position')
        await this.session.applyAction(
            this.session.createPlayerAction(PlaceStation, {
                companyId: preview.companyId,
                stationId: preview.stationId,
                position: preview.position,
                expectedCost: preview.cost
            })
        )
    }
    async finish() {
        const companyId = this.session.state.stationStep?.companyId
        assert(
            companyId && this.canPlace && !this.selection.placement,
            'Finish or cancel the station selection'
        )
        await this.session.applyAction(
            this.session.createPlayerAction(FinishStations, { companyId })
        )
    }
}
