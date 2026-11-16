import {
    ConvertCentral,
    MoveRebellionStation,
    CpId,
    CprId,
    TbId,
    TitleRules1882,
    centralHomePositions,
    centralParSpaces,
    movableStations,
    rebellionDestinations,
    rebellionMover,
    type HydratedState1882,
    type State1882
} from '@tabletop/1882'
import { assert, assertExists } from '@tabletop/common'
import type { GameSession } from '@tabletop/frontend-components'
import type { StationPosition } from '@tabletop/18xx'
import {
    StagedSelection,
    createEighteenXXSessionClass,
    type MapLocationChoice,
    type TitleOperatingMode
} from '@tabletop/18xx-ui'
import { MapView1882 } from './mapView.js'
import { Presentation1882 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1882, HydratedState1882>
> = createEighteenXXSessionClass<typeof State1882, HydratedState1882>(
    TitleRules1882,
    MapView1882,
    Presentation1882,
    createRouteWorker
)

/** The par the Saskatchewan Central's owner chose, before its home city on the map. */
type CentralSelections = { par: string }
/** The station the North-West Rebellion Company moves, before its destination on the map. */
type MoveSelections = { stationId: string }

export class Session1882 extends BaseSession {
    // The Canadian Pacific brings the CPR's presidency, the Trestle Bridge the share drawn at
    // setup (§3, §7.1.4, §7.1.5).
    override privateCompanyTokens = $derived({
        [CpId]: this.mapView.stations[CprId],
        [TbId]: this.mapView.stations[this.gameState.trestleShareCompanyId]
    })
    private readonly central = new StagedSelection<CentralSelections>(['par'])
    private readonly moving = new StagedSelection<MoveSelections>(['stationId'])
    readonly stockPanels = this.titleStockPanels<'central'>([
        {
            id: 'central',
            label: 'Exchange SC',
            available: () => this.canConvertCentral
        }
    ])
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register(this.central)
        this.localSelections.register(this.moving)
    }

    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    private readonly me = $derived(this.canChooseAction ? this.myPlayer?.id : undefined)
    private can(type: string): boolean {
        return this.canChooseAction && this.validActionTypes.includes(type)
    }

    /** Whether the player may exchange the Saskatchewan Central for the SCR now (§7.1.2). */
    readonly canConvertCentral = $derived(this.can('ConvertCentral'))
    readonly centralParSpaces = $derived(
        this.canConvertCentral ? centralParSpaces(this.gameState) : []
    )
    readonly centralPar = $derived(this.canConvertCentral ? this.central.value('par') : undefined)
    readonly centralHomes = $derived(this.centralPar ? centralHomePositions(this.gameState) : [])
    chooseCentralPar(spaceId: string): void {
        assert(this.centralParSpaces.includes(spaceId), 'Choose one of the SCR’s par values')
        this.central.choose('par', spaceId)
    }
    async convertCentral(home: StationPosition): Promise<void> {
        const marketSpaceId = this.centralPar
        assertExists(marketSpaceId, 'The SCR’s par is chosen')
        await this.applyAction(
            this.createPlayerAction(ConvertCentral, { marketSpaceId, home: { ...home } })
        )
    }

    /** The company that may move a station with the North-West Rebellion Company (§7.1.3). */
    readonly rebellionCompany = $derived.by(() => {
        const me = this.me
        return me && this.can('MoveRebellionStation')
            ? rebellionMover(this.gameState, me)
            : undefined
    })
    readonly movableStations = $derived.by(() => {
        const companyId = this.rebellionCompany
        return companyId ? movableStations(this.gameState, companyId) : []
    })
    readonly movedStationId = $derived(
        this.rebellionCompany ? this.moving.value('stationId') : undefined
    )
    readonly rebellionDestinations = $derived.by(() => {
        const companyId = this.rebellionCompany
        return companyId && this.movedStationId
            ? rebellionDestinations(this.gameState, companyId)
            : []
    })
    chooseMovedStation(stationId: string): void {
        assert(
            this.movableStations.some((station) => station.id === stationId),
            'Choose one of the company’s stations outside the rebellion hexes'
        )
        this.moving.choose('stationId', stationId)
    }
    async moveStation(position: StationPosition): Promise<void> {
        const stationId = this.movedStationId
        assertExists(stationId, 'A station to move is chosen')
        await this.applyAction(
            this.createPlayerAction(MoveRebellionStation, { stationId, position: { ...position } })
        )
    }

    override get titleOperatingModes(): readonly TitleOperatingMode[] {
        return this.rebellionCompany && this.movableStations.length
            ? [{ id: 'rebellion', label: 'North-West Rebellion', shortLabel: 'NWR' }]
            : []
    }

    override get mapLocationChoice(): MapLocationChoice | undefined {
        if (this.centralPar && this.stockPanels.open === 'central')
            return this.cityChoice(this.centralHomes, (home) => this.convertCentral(home))
        if (this.movedStationId && this.operatingMode.titleModeShown === 'rebellion')
            return this.cityChoice(this.rebellionDestinations, (destination) =>
                this.moveStation(destination)
            )
        return super.mapLocationChoice
    }

    /**
     * The hexes holding the open cities, a click choosing the city clicked, or the hex's first
     * where the click found none; a click on a full city beside an open one chooses nothing.
     */
    private cityChoice(
        positions: readonly StationPosition[],
        choose: (position: StationPosition) => Promise<void>
    ): MapLocationChoice {
        return {
            locationIds: [...new Set(positions.map((position) => position.locationId))],
            choose: (locationId, nodeId) => {
                const inHex = positions.filter((position) => position.locationId === locationId)
                const position = nodeId ? inHex.find((entry) => entry.nodeId === nodeId) : inHex[0]
                if (position) void choose(position)
            }
        }
    }

    stationPlace(stationId: string): string {
        const station = this.gameState.stations.find((entry) => entry.id === stationId)
        assert(station?.status === 'placed', `Station ${stationId} is on the board`)
        return this.placeName(station.position.locationId)
    }
}

export function requireSession1882(
    session: GameSession<State1882, HydratedState1882>
): Session1882 {
    assert(session instanceof Session1882, '1882 requires its title session')
    return session
}
