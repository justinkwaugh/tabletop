import { assert, assertExists } from '@tabletop/common'
import { RailwayMapState, TrackNetwork, type EighteenXXState, type TileFace } from '@tabletop/18xx'
import { createMapDrawing, isMapSelectionValid, type MapSelection } from '../maps/mapDrawing.js'
import { stationMapTokens, type MapViewDefinition } from '../maps/stationPresentation.js'
import type { ModuleSession } from './moduleSession.js'
import type { RoutesModule, RoutesSession } from './routesModule.svelte.js'
import type { StationsModule, StationsState } from './stationsModule.svelte.js'
import type { TrackModule } from './trackModule.svelte.js'

type MapState = Parameters<typeof stationMapTokens>[0] &
    Pick<EighteenXXState, 'companies' | 'stations' | 'tileInventory' | 'stationStep' | 'trackStep'>
export type MapSession = ModuleSession<MapState, unknown>
export type MapStyle = 'classic' | 'muted'

type Track = Pick<
    TrackModule,
    | 'selection'
    | 'preview'
    | 'displayedPreview'
    | 'tileInFlight'
    | 'construction'
    | 'showChoices'
    | 'canBuild'
    | 'locationIds'
    | 'selectLocation'
    | 'rotatePreview'
>
type Stations = Pick<
    StationsModule<StationsState>,
    | 'selection'
    | 'preview'
    | 'displayState'
    | 'canPlace'
    | 'locationIds'
    | 'choices'
    | 'selectPosition'
    | 'confirm'
>
type Routes = Pick<
    RoutesModule<RoutesSession['state']>,
    'canRun' | 'editor' | 'appendPath' | 'selectStart'
>

export class MapModule {
    showTrackAccess = $state(true)
    private inspectedCompanyId: string | undefined = $state()
    private inspection: { selection: MapSelection; face: TileFace } | undefined = $state.raw()
    private styles: Record<string, MapStyle> = $state({})
    constructor(
        private readonly session: MapSession,
        private readonly view: () => MapViewDefinition,
        private readonly track: Track,
        private readonly stations: Stations,
        private readonly routes: Routes
    ) {}

    scene = $derived.by(() => this.draw(this.session.state.tileInventory))
    tokens = $derived.by(() => stationMapTokens(this.session.state, this.view().stations))
    tileCounts = $derived.by(() => this.view().tileSet.counts(this.session.state.tileInventory))
    displayedScene = $derived.by(() => {
        const preview = this.track.displayedPreview
        return preview && !this.track.tileInFlight
            ? this.draw(this.track.construction.inventoryAfter(preview))
            : this.scene
    })
    displayedTokens = $derived.by(() => {
        const preview = this.track.displayedPreview
        if (preview && !this.track.tileInFlight)
            return stationMapTokens(preview, this.view().stations)
        return this.stations.preview
            ? stationMapTokens(this.stations.displayState, this.view().stations)
            : this.tokens
    })
    style = $derived.by(
        (): MapStyle =>
            this.session.playerId ? (this.styles[this.session.playerId] ?? 'classic') : 'classic'
    )
    selection = $derived.by((): MapSelection | undefined => {
        if (this.session.publishing) return undefined
        const constructionLocation = this.track.selection.locationId?.value
        if (constructionLocation) return { kind: 'hex', locationId: constructionLocation }
        const stationPosition = this.stations.selection.placement?.value.position
        if (stationPosition) return { kind: 'slot', ...stationPosition }
        const inspection = this.inspection
        if (!inspection || !isMapSelectionValid(this.scene, inspection.selection)) return undefined
        const face = this.scene.locations.find(
            (entry) => entry.location.id === inspection.selection.locationId
        )?.face
        return inspection.selection.kind === 'hex' || face === inspection.face
            ? inspection.selection
            : undefined
    })

    networkCompanies = $derived.by(() =>
        this.session.state.companies.filter((company) =>
            this.session.state.stations.some(
                (station) => station.companyId === company.id && station.status === 'placed'
            )
        )
    )
    networkCompanyId = $derived.by(
        () =>
            this.inspectedCompanyId ??
            this.session.state.stationStep?.companyId ??
            this.session.state.trackStep?.companyId ??
            this.networkCompanies[0]?.id
    )
    private network = $derived.by(() =>
        this.networkCompanyId
            ? new TrackNetwork(
                  new RailwayMapState(
                      this.view().map,
                      this.view().tileSet,
                      this.session.state.tileInventory
                  ),
                  this.stations.displayState,
                  this.networkCompanyId
              )
            : undefined
    )
    networkRoutes = $derived.by(() => {
        const network = this.network
        return this.showTrackAccess && !this.session.publishing && !this.track.preview && network
            ? [
                  {
                      id: 'track-access',
                      color: '#168da8',
                      segments: this.scene.locations.flatMap((entry) =>
                          entry.face.paths
                              .filter((path) => network.usesPath(entry.location.id, path.id))
                              .map((path) => ({ locationId: entry.location.id, pathId: path.id }))
                      )
                  }
              ]
            : []
    })
    blockedCities = $derived.by(() =>
        this.scene.locations.flatMap((entry) =>
            entry.face.nodes
                .filter((node) => this.network?.isBlocked(entry.location.id, node.id))
                .map((node) => ({
                    locationId: entry.location.id,
                    nodeId: node.id,
                    name: entry.location.name
                }))
        )
    )

    inspectCompanyNetwork(companyId: string) {
        assert(
            this.networkCompanies.some((company) => company.id === companyId),
            'Choose a company with a station'
        )
        this.inspectedCompanyId = companyId
    }
    inspect(selection: MapSelection) {
        assert(isMapSelectionValid(this.scene, selection), 'Invalid map selection')
        const entry = this.scene.locations.find(
            (entry) => entry.location.id === selection.locationId
        )
        assertExists(entry, 'Selection requires a map location')
        this.inspection = { selection, face: entry.face }
    }
    clearInspection() {
        this.inspection = undefined
    }
    setStyle(style: MapStyle) {
        assertExists(this.session.playerId, 'A map preference requires a player')
        this.styles[this.session.playerId] = style
    }
    select(selection: MapSelection, allowInspection = true) {
        if (this.track.showChoices) {
            if (this.track.canBuild && this.track.locationIds.includes(selection.locationId)) {
                if (this.track.preview?.locationId === selection.locationId)
                    this.track.rotatePreview()
                else this.track.selectLocation(selection.locationId)
            }
            return
        }
        const editor = this.routes.editor
        if (
            this.routes.canRun &&
            editor.trainId &&
            selection.kind === 'path' &&
            editor.extensions.some(
                (path) =>
                    path.locationId === selection.locationId && path.pathId === selection.pathId
            )
        )
            this.routes.appendPath(selection)
        else if (
            this.routes.canRun &&
            editor.trainId &&
            !editor.start &&
            (selection.kind === 'node' || selection.kind === 'slot') &&
            editor.centers.some(
                (center) =>
                    center.locationId === selection.locationId && center.nodeId === selection.nodeId
            )
        )
            this.routes.selectStart({ locationId: selection.locationId, nodeId: selection.nodeId })
        else if (this.stations.canPlace && this.stations.locationIds.includes(selection.locationId))
            this.placeStation(selection)
        else if (allowInspection) this.inspect(selection)
    }

    private placeStation(selection: MapSelection) {
        const location = this.scene.locations.find(
            (entry) => entry.location.id === selection.locationId
        )
        assertExists(location, 'Station placement requires a map location')
        const separateCities = location.face.nodes.filter((node) => node.kind === 'city').length > 1
        if (separateCities && selection.kind !== 'slot' && selection.kind !== 'node') return
        const choice = this.stations.choices.find(
            (choice) =>
                choice.position.locationId === selection.locationId &&
                (!separateCities ||
                    ((selection.kind === 'slot' || selection.kind === 'node') &&
                        choice.position.nodeId === selection.nodeId))
        )
        if (!choice) return
        this.stations.selectPosition(choice)
        void this.stations.confirm()
    }
    private draw(inventory: MapState['tileInventory']) {
        const view = this.view()
        return createMapDrawing(
            view.map,
            { tileSet: view.tileSet, inventory },
            view.layouts,
            view.markerImages
        )
    }
}
