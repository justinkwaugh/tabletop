import { assert, assertExists } from '@tabletop/common'
import {
    TrackConstruction,
    type BoardTile,
    type EighteenXXTitleRules,
    type FutureLay,
    type TileDefinition,
    type TileInventory,
    type TileRotation
} from '@tabletop/18xx'
import type { MapViewDefinition } from '../maps/stationPresentation.js'
import { tileGroupOf } from '../maps/tileGroups.js'
import type { ModuleSession } from './moduleSession.js'

type PlanState = ConstructorParameters<typeof TrackConstruction>[0]
export type TilePlanSession = ModuleSession<PlanState, Pick<EighteenXXTitleRules, 'trackRules'>>
type PlanMapView = Pick<MapViewDefinition, 'tileGroups'> & {
    map: Pick<MapViewDefinition['map'], 'definition'>
    tileSet: Pick<MapViewDefinition['tileSet'], 'definitions'>
}
type PlanStep = { definitionId: string; rotation: TileRotation }
type Plan = { locationId: string; steps: readonly PlanStep[] }
/** A lay the supply has the tiles for. */
type SuppliedLay = FutureLay & Required<Pick<FutureLay, 'placement'>>
/** The tiles that may replace the tile a plan has reached, and the one tried there, if any. */
type PlanLevel = { lays: readonly FutureLay[]; chosen?: SuppliedLay }
/** A tile the ring offers: one that may replace the tile the plan has reached by its level. */
export type TilePlanChoice = {
    level: number
    tile: TileDefinition
    rotation: TileRotation
    available: boolean
    chosen: boolean
    /** Every tile the choice lays, where it lays one across several hexes. */
    piece?: readonly BoardTile[]
}

/** A player trying the tiles that may one day upgrade a hex; nothing it shows is an Action. */
export class TilePlanModule {
    constructor(
        private readonly session: TilePlanSession,
        private readonly mapView: () => PlanMapView,
        private readonly enabled: () => boolean
    ) {}

    /** Whether taps on the map may open a plan: no other choice on the map takes them. */
    available = $derived.by(
        () => this.enabled() && !this.session.viewingHistory && !this.session.publishing
    )
    private plan = $derived(closedAgain(this.available))
    /** The hexes a tap may open a plan on: each hex of a piece some tile may still upgrade. */
    locationIds = $derived.by((): string[] => {
        if (!this.available) return []
        const construction = this.construction(this.session.state.tileInventory)
        return this.mapView()
            .map.definition.locations.filter((location) => this.anchor(construction, location.id))
            .map((location) => location.id)
    })
    private activePlan = $derived.by(() =>
        this.plan && this.locationIds.includes(this.plan.locationId) ? this.plan : undefined
    )
    /** The hex the plan lays its tiles from. */
    locationId = $derived.by(() => this.activePlan?.locationId)
    /** Every hex the plan's tiles cover. */
    pieceLocationIds = $derived.by((): readonly string[] => {
        const locationId = this.locationId
        if (!locationId) return []
        return tileGroupOf(this.mapView(), locationId) ?? [locationId]
    })
    /** The plan's levels, and the board's tiles with every tile it tries laid. */
    private tried = $derived.by((): { levels: PlanLevel[]; inventory?: TileInventory } => {
        const plan = this.activePlan
        if (!plan) return { levels: [] }
        let inventory: TileInventory | undefined
        const levels: PlanLevel[] = []
        for (const step of [...plan.steps, undefined]) {
            const construction = this.construction(inventory ?? this.session.state.tileInventory)
            const lays = construction.futureLays(plan.locationId)
            const chosen = step
                ? this.placedLays(lays, step.definitionId).find(
                      (lay) => lay.rotation === step.rotation
                  )
                : undefined
            levels.push({ lays, ...(chosen ? { chosen } : {}) })
            if (!chosen) break
            inventory = construction.inventoryAfter(chosen)
        }
        return { levels, ...(inventory ? { inventory } : {}) }
    })
    private levels = $derived(this.tried.levels)
    /** The board's tiles with the plan's tiles laid, while it has laid one. */
    inventory = $derived(this.tried.inventory)
    /** The hex whose tile the plan has replaced, while it has. */
    previewedLocationId = $derived.by(() => (this.inventory ? this.locationId : undefined))
    choices = $derived.by((): TilePlanChoice[] =>
        this.levels.flatMap((level, index) =>
            this.mapView().tileSet.definitions.flatMap((tile) => {
                const lays = level.lays.filter((lay) => lay.definitionId === tile.id)
                if (!lays.length) return []
                const chosen = level.chosen?.definitionId === tile.id
                const shown = chosen ? level.chosen : lays[0]
                assertExists(shown, 'A choice shows one of its lays')
                const companions =
                    this.session.rules.trackRules.companionTiles?.(this.session.state, shown) ?? []
                return [
                    {
                        level: index,
                        tile,
                        rotation: shown.rotation,
                        available: lays.some((lay) => lay.placement),
                        chosen,
                        ...(companions.length ? { piece: [shown, ...companions] } : {})
                    }
                ]
            })
        )
    )

    /** Tapping the plan's piece turns its tile; tapping another hex plans there, if it may. */
    tap(locationId: string) {
        if (this.pieceLocationIds.includes(locationId)) {
            if (this.inventory) this.rotate()
            return
        }
        const anchor = this.anchor(this.construction(this.session.state.tileInventory), locationId)
        this.plan = anchor ? { locationId: anchor, steps: [] } : undefined
    }
    /** Tries the tile on the plan's hex in place of the level's tile, dropping later levels. */
    choose(level: number, definitionId: string) {
        const [lay] = this.placedLays(this.levels[level]?.lays ?? [], definitionId)
        assert(lay, 'Choose a tile the supply still has')
        this.tryAt(level, lay)
    }
    /** Turns the plan's latest tile to its next way of fitting the hex. */
    rotate() {
        const level = this.levels[this.latestLevel]
        const current = level?.chosen
        assert(current, 'Choose a tile to turn')
        const turns = this.placedLays(level.lays, current.definitionId)
        this.tryAt(this.latestLevel, turns[(turns.indexOf(current) + 1) % turns.length])
    }
    clear() {
        this.plan = undefined
    }

    /** The level whose tile is the one laid last, once the plan has laid one. */
    private get latestLevel(): number {
        return this.levels.length - 2
    }
    private tryAt(level: number, lay: SuppliedLay) {
        const plan = this.activePlan
        assert(plan, 'Open a plan first')
        this.plan = {
            locationId: plan.locationId,
            steps: [
                ...plan.steps.slice(0, level),
                { definitionId: lay.definitionId, rotation: lay.rotation }
            ]
        }
    }
    private placedLays(lays: readonly FutureLay[], definitionId: string): SuppliedLay[] {
        return lays.filter(
            (lay): lay is SuppliedLay => !!lay.placement && lay.definitionId === definitionId
        )
    }
    /**
     * The hex of the tapped piece a plan lays from: the tapped hex, or another the piece covers,
     * where track has reached the piece and some tile may still upgrade it.
     */
    private anchor(construction: TrackConstruction, locationId: string): string | undefined {
        const piece = tileGroupOf(this.mapView(), locationId) ?? [locationId]
        if (!piece.some((id) => construction.meetsTrack(id))) return undefined
        return [locationId, ...piece].find((id) => construction.hasFutureLay(id))
    }
    private construction(inventory: TileInventory): TrackConstruction {
        const { state, rules } = this.session
        return new TrackConstruction({ ...state, tileInventory: inventory }, rules.trackRules)
    }
}

/**
 * No plan, again whenever plans become available or stop being so: a plan never outlives the
 * player's own choice on the map, nor returns after it.
 */
function closedAgain(_available: boolean): Plan | undefined {
    return undefined
}
