import { assert, assertExists } from '@tabletop/common'
import {
    FinishTrack,
    LayTile,
    RequestTrackConsent,
    TrackConstruction,
    isLayPrivateTile,
    isLayTile,
    isRespondToTrackConsent,
    privateTrackConstruction,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type TrackRequest
} from '@tabletop/18xx'
import type { MapViewDefinition } from '../maps/stationPresentation.js'
import type { CompanyDecisionsModule } from './companyDecisionsModule.svelte.js'
import type { PrivateActionsModule } from './privateActionsModule.svelte.js'
import type { ModuleSession } from './moduleSession.js'
import { StagedSelection } from './stagedSelection.svelte.js'
import { TrackStageOrder, type TrackSelection, type TrackStages } from './trackSelection.js'

type TrackState = ConstructorParameters<typeof TrackConstruction>[0] &
    Parameters<typeof privateTrackConstruction>[0] &
    Pick<EighteenXXState, 'machineState' | 'trackStep' | 'trackConsent'>

export type TrackSession = ModuleSession<
    TrackState,
    Pick<EighteenXXTitleRules, 'trackRules' | 'privatePowerRules'>
>
type TrackMap = {
    map: Pick<MapViewDefinition['map'], 'definition'>
    tileSet: Pick<MapViewDefinition['tileSet'], 'definitions'>
}
type PrivateActions = Pick<PrivateActionsModule, 'selection' | 'trackPowerSelection'>
type Decisions = Pick<CompanyDecisionsModule, 'selectPrivateTile' | 'confirm'>

export class TrackModule {
    readonly stages = new StagedSelection<TrackStages>(TrackStageOrder)
    constructor(
        private readonly session: TrackSession,
        private readonly mapView: () => TrackMap,
        private readonly privateActions: PrivateActions,
        private readonly decisions: Decisions,
        private readonly onLocationChosen: () => void
    ) {}

    private laying = $derived.by(
        () =>
            !!this.privateActions.trackPowerSelection ||
            (this.session.state.machineState === 'LayingTrack' && !this.privateActions.selection)
    )
    selection = $derived.by(
        (): TrackSelection =>
            this.session.selectionsVisible && this.laying ? this.stages.state : {}
    )
    construction = $derived.by(() => {
        const { state, rules } = this.session
        const power = this.privateActions.trackPowerSelection?.value
        if (!power) return new TrackConstruction(state, rules.trackRules)
        const terms = rules.privatePowerRules.trackTerms(
            state,
            power.privateCompanyId,
            power.playerId
        )
        assertExists(terms, 'Selected private tile power requires construction terms')
        return privateTrackConstruction(state, terms, rules.trackRules)
    })
    canBuild = $derived.by(
        () =>
            this.session.interactive &&
            (this.privateActions.trackPowerSelection
                ? this.session.validActionTypes.includes('LayPrivateTile')
                : !this.privateActions.selection &&
                  this.session.validActionTypes.includes('FinishTrack'))
    )
    showChoices = $derived.by(() => !this.session.viewingHistory && this.laying)
    private choicesByLocation = $derived.by(
        () =>
            new Map(
                this.showChoices
                    ? this.mapView().map.definition.locations.map(
                          (location) =>
                              [location.id, this.construction.choices(location.id)] as const
                      )
                    : []
            )
    )
    reachableLocationIds = $derived.by(() =>
        this.showChoices
            ? this.mapView()
                  .map.definition.locations.filter((location) =>
                      this.construction.canReach(location.id)
                  )
                  .map((location) => location.id)
            : []
    )
    locationIds = $derived.by(() =>
        [...this.choicesByLocation].filter(([, choices]) => choices.length).map(([id]) => id)
    )
    choices = $derived.by(() =>
        this.selection.locationId
            ? (this.choicesByLocation.get(this.selection.locationId.value) ?? [])
            : []
    )
    tiles = $derived.by(() =>
        this.mapView().tileSet.definitions.filter((tile) =>
            this.choices.some((choice) => choice.definitionId === tile.id)
        )
    )
    placements = $derived.by(() =>
        this.choices.filter((choice) => choice.definitionId === this.selection.definitionId?.value)
    )
    preview = $derived.by(() =>
        this.selection.placement
            ? this.construction.evaluate(this.selection.placement.value).details
            : undefined
    )
    // The selection a tile animation started on; it no longer counts once the selection changes.
    private tileFlightSelection = $state.raw<object>()
    get tileInFlight() {
        return this.tileFlightSelection !== undefined && this.tileFlightSelection === this.selection
    }
    set tileInFlight(inFlight: boolean) {
        this.tileFlightSelection = inFlight ? this.selection : undefined
    }
    displayedPreview = $derived.by(() => this.session.state.trackConsent?.details ?? this.preview)
    constructionActions = $derived.by(() =>
        this.session.recordedActions.flatMap((action) => {
            const details =
                isLayTile(action) || isLayPrivateTile(action)
                    ? action.metadata
                    : isRespondToTrackConsent(action) && action.metadata?.accepted
                      ? action.metadata.request.details
                      : undefined
            return details
                ? [
                      {
                          id: action.id,
                          locationId: details.locationId,
                          definitionId: details.definitionId,
                          rotation: details.rotation,
                          cost: details.cost
                      }
                  ]
                : []
        })
    )

    selectLocation(locationId: string) {
        assert(
            this.canBuild && this.locationIds.includes(locationId),
            'No legal construction at this location'
        )
        this.stages.clear()
        this.stages.choose('locationId', locationId)
        const choices = this.choicesByLocation.get(locationId) ?? []
        if (new Set(choices.map((choice) => choice.definitionId)).size === 1) {
            this.chooseTile(choices[0].definitionId, choices.slice(0, 1), 'auto')
            this.tileInFlight = true
        }
        this.onLocationChosen()
    }
    selectTile(definitionId: string) {
        assert(this.canBuild && this.selection.locationId, 'Choose a construction location')
        const choices = this.choices.filter((choice) => choice.definitionId === definitionId)
        assert(choices.length, 'No legal placement for this tile')
        this.chooseTile(definitionId, choices)
    }
    previewTile(definitionId: string) {
        this.selectTile(definitionId)
        this.chooseTile(definitionId, this.placements.slice(0, 1))
    }
    rotatePreview() {
        assert(this.canBuild && this.preview, 'Choose a track tile to rotate')
        const preview = this.preview
        const index = this.placements.findIndex(
            (choice) =>
                choice.rotation === preview.rotation &&
                JSON.stringify(choice.nodeMapping) === JSON.stringify(preview.nodeMapping)
        )
        const next = [
            ...this.placements.slice(index + 1),
            ...this.placements.slice(0, index + 1)
        ].find((choice) => choice.rotation !== preview.rotation)
        if (next) this.selectPlacement(next)
    }
    selectPlacement(request: TrackRequest) {
        assert(
            this.canBuild &&
                this.selection.definitionId?.value === request.definitionId &&
                this.construction.evaluate(request).details,
            'Choose a legal tile rotation'
        )
        this.stages.choose('placement', request)
    }
    back() {
        this.stages.back()
    }
    cancel() {
        this.stages.clear()
    }
    async confirm() {
        const preview = this.preview
        assert(this.canBuild && preview, 'Choose a legal track placement')
        const power = this.privateActions.trackPowerSelection?.value
        if (power) {
            this.decisions.selectPrivateTile({ ...power, details: preview })
            await this.decisions.confirm()
            return
        }
        const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = preview
        await this.session.applyAction(
            this.session.createPlayerAction(
                preview.consentPlayerId && preview.consentPlayerId !== this.session.playerId
                    ? RequestTrackConsent
                    : LayTile,
                { companyId, locationId, definitionId, rotation, nodeMapping, expectedCost: cost }
            )
        )
    }
    async finish() {
        const companyId = this.session.state.trackStep?.companyId
        assert(
            companyId &&
                !this.selection.locationId &&
                this.session.validActionTypes.includes('FinishTrack') &&
                this.session.interactive,
            'Finish or cancel the construction selection'
        )
        await this.session.applyAction(this.session.createPlayerAction(FinishTrack, { companyId }))
    }

    private chooseTile(
        definitionId: string,
        placements: readonly TrackRequest[],
        source: 'manual' | 'auto' = 'manual'
    ) {
        this.stages.choose('definitionId', definitionId, source)
        if (placements.length === 1) this.stages.choose('placement', placements[0], 'auto')
    }
}
