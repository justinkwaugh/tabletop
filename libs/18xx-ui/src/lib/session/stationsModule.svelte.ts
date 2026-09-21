import { assert } from '@tabletop/common'
import {
    FinishStations,
    PlaceStation,
    StationPlacement,
    applyStationPlacement,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type StationRequest
} from '@tabletop/18xx'
import type { SessionContext } from './sessionContext.js'
import type { SessionDraft } from './sessionDrafts.js'
import { chooseStation, chooseStationPosition, type StationSelection } from './stationSelection.js'

export type StationsState = ConstructorParameters<typeof StationPlacement>[0] &
    Pick<EighteenXXState, 'machineState'>
export type StationsContext<State extends StationsState = StationsState> = SessionContext<
    State,
    Pick<EighteenXXTitleRules, 'stationRules'>
>

export class StationsModule<State extends StationsState> implements SessionDraft {
    #draft: StationSelection = $state({})
    readonly requiresTokenChoice = false
    constructor(
        private readonly context: StationsContext<State>,
        private readonly onPositionChosen: () => void
    ) {}

    model = $derived.by(
        () => new StationPlacement(this.context.state, this.context.rules.stationRules)
    )
    canPlace = $derived.by(
        () => this.context.interactive && this.context.validActionTypes.includes('FinishStations')
    )
    available = $derived.by(() =>
        this.context.state.stations.filter(
            (station) =>
                station.companyId === this.context.state.stationStep?.companyId &&
                station.status === 'available'
        )
    )
    selection = $derived.by((): StationSelection => {
        if (!this.context.draftsVisible || this.context.state.machineState !== 'PlacingStation')
            return {}
        if (this.#draft.stationId) return this.#draft
        if (
            this.requiresTokenChoice ||
            !this.canPlace ||
            !this.context.validActionTypes.includes('PlaceStation')
        )
            return {}
        const cheapestPlaceable = [...this.available]
            .sort((left, right) => this.placementCost(left.id) - this.placementCost(right.id))
            .find((token) => this.model.choices(token.id).length > 0)
        return cheapestPlaceable ? chooseStation(cheapestPlaceable.id, 'auto') : {}
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
        if (!this.preview) return this.context.state
        const state: State = {
            ...this.context.state,
            stations: [...this.context.state.stations],
            stationReservations: [...this.context.state.stationReservations]
        }
        applyStationPlacement(state, this.preview)
        return state
    })

    placementCost(stationId: string): number {
        const { state, rules } = this.context
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
        this.#draft = chooseStation(stationId)
    }
    selectPosition(request: StationRequest) {
        assert(
            this.canPlace &&
                this.selection.stationId?.value === request.stationId &&
                this.model.evaluate(request).details,
            'Choose a legal station position'
        )
        this.#draft = chooseStationPosition(this.selection, request)
        this.onPositionChosen()
    }
    async confirm() {
        const preview = this.preview
        assert(this.canPlace && preview, 'Choose a legal station position')
        await this.context.applyAction(
            this.context.createPlayerAction(PlaceStation, {
                companyId: preview.companyId,
                stationId: preview.stationId,
                position: preview.position,
                expectedCost: preview.cost
            })
        )
    }
    async finish() {
        const companyId = this.context.state.stationStep?.companyId
        assert(
            companyId && this.canPlace && !this.selection.placement,
            'Finish or cancel the station selection'
        )
        await this.context.applyAction(
            this.context.createPlayerAction(FinishStations, { companyId })
        )
    }

    pending() {
        return !!this.#draft.stationId
    }
    unwind() {
        if (!this.#draft.placement && this.#draft.stationId?.source !== 'manual') return false
        this.#draft = {}
        return true
    }
    clear() {
        this.#draft = {}
    }
}
