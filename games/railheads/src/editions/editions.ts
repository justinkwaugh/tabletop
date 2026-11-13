import {
    HexGrid,
    assertExists,
    coordinatesToNumber,
    distanceAxial,
    type AxialCoordinates,
    type HexGridNode
} from '@tabletop/common'
import { DENMARK } from './denmark/edition.js'
import { GERMANY } from './germany/edition.js'
import { MIDWEST } from './midwest/edition.js'
import { SWITZERLAND } from './switzerland/edition.js'
import {
    EditionId,
    HexKind,
    SiteKind,
    type PeakDefinition,
    type TollDefinition,
    type CompanyDefinition,
    type CompanyId,
    type DemandAreaDefinition,
    type EditionDefinition,
    type Industry,
    type RegionDefinition,
    type SiteDefinition
} from './types.js'

export type MapHex = HexGridNode & {
    kind: HexKind
    siteId?: string
    industry?: Industry
    regionId?: string
    // Every hex of a bridge or tunnel names it; track sits on the toll's first hex only.
    tollId?: string
}

const SITE_HEX_KIND: Record<SiteKind, HexKind> = {
    [SiteKind.City]: HexKind.City,
    [SiteKind.Town]: HexKind.Town
}

export function hexKey(coords: AxialCoordinates): number {
    return coordinatesToNumber(coords)
}

export class EditionMap extends HexGrid<MapHex> {
    readonly regions: readonly RegionDefinition[]
    readonly demandAreas: readonly DemandAreaDefinition[]
    readonly water: readonly AxialCoordinates[]
    readonly peaks: readonly PeakDefinition[]
    readonly tolls: readonly TollDefinition[]
    private readonly tollsById: Map<string, TollDefinition>

    constructor(definition: EditionDefinition) {
        const { map } = definition
        super({ hexDefinition: { orientation: map.orientation } })
        this.regions = map.regions
        this.demandAreas = map.demandAreas
        this.water = map.water
        this.peaks = map.peaks ?? []
        this.tolls = map.tolls ?? []
        this.tollsById = new Map(this.tolls.map((toll) => [toll.id, toll]))
        const regionIds = new Map(
            map.regions.flatMap((region) =>
                region.hexes.map((coords) => [hexKey(coords), region.id] as const)
            )
        )
        const place = (coords: AxialCoordinates, fields: Omit<MapHex, 'id' | 'coords'>) => {
            const id = hexKey(coords)
            const regionId = regionIds.get(id)
            this.setNode({ id, coords, ...fields, ...(regionId ? { regionId } : {}) })
        }
        for (const coords of map.countryside) {
            place(coords, { kind: HexKind.Countryside })
        }
        for (const site of map.sites) {
            place(site.hex, { kind: SITE_HEX_KIND[site.kind], siteId: site.id })
        }
        for (const site of map.industrySites) {
            place(site.hex, { kind: HexKind.Industry, industry: site.industry })
        }
        for (const coords of map.hillside ?? []) {
            place(coords, { kind: HexKind.Hillside })
        }
        for (const toll of this.tolls) {
            for (const coords of toll.hexes) {
                place(coords, { kind: toll.kind, tollId: toll.id })
            }
        }
    }

    toll(tollId: string): TollDefinition {
        const found = this.tollsById.get(tollId)
        assertExists(found, `Unknown toll ${tollId}`)
        return found
    }

    // The hex that holds a toll's track; any other hex is its own.
    anchor(coords: AxialCoordinates): AxialCoordinates {
        const tollId = this.nodeAt(coords)?.tollId
        return tollId === undefined ? coords : this.toll(tollId).hexes[0]
    }

    isAnchor(coords: AxialCoordinates): boolean {
        return hexKey(this.anchor(coords)) === hexKey(coords)
    }

    // How many hexes the track on these coordinates covers: a tunnel's length, else one.
    span(coords: AxialCoordinates): number {
        const tollId = this.nodeAt(coords)?.tollId
        return tollId === undefined ? 1 : this.toll(tollId).hexes.length
    }

    demandAreasBeside(coords: AxialCoordinates): DemandAreaDefinition[] {
        return this.demandAreas.filter((area) => distanceAxial(area.hex, coords) === 1)
    }

    hexes(): MapHex[] {
        return [...this]
    }

    hex(coords: AxialCoordinates): MapHex {
        const found = this.nodeAt(coords)
        assertExists(found, `No hex at ${coords.q},${coords.r}`)
        return found
    }

    // Neighbours as track sees them: a tunnel is one place, reached from beside any of its hexes.
    neighbourCoords(coords: AxialCoordinates): AxialCoordinates[] {
        const tollId = this.nodeAt(coords)?.tollId
        const group = tollId === undefined ? [coords] : this.toll(tollId).hexes
        const own = new Set(group.map(hexKey))
        const found = new Map<number, AxialCoordinates>()
        for (const member of group) {
            for (const neighbour of this.neighborsAt(member)) {
                if (own.has(hexKey(neighbour.coords))) continue
                const anchor = this.anchor(neighbour.coords)
                found.set(hexKey(anchor), anchor)
            }
        }
        return [...found.values()]
    }
}

export class Edition {
    readonly map: EditionMap
    private readonly sitesById: Map<string, SiteDefinition>

    constructor(readonly definition: EditionDefinition) {
        this.map = new EditionMap(definition)
        this.sitesById = new Map(definition.map.sites.map((site) => [site.id, site]))
    }

    get companies(): readonly CompanyDefinition[] {
        return this.definition.companies
    }

    company(companyId: CompanyId): CompanyDefinition {
        const found = this.definition.companies.find((company) => company.id === companyId)
        assertExists(found, `${companyId} is not in ${this.definition.name}`)
        return found
    }

    site(siteId: string): SiteDefinition {
        const found = this.sitesById.get(siteId)
        assertExists(found, `Unknown site ${siteId}`)
        return found
    }

    siteRevenue(siteId: string): number {
        const site = this.site(siteId)
        return site.revenue ?? this.definition.siteRevenue[site.kind]
    }

    homeHex(companyId: CompanyId): AxialCoordinates {
        return this.site(this.company(companyId).homeSiteId).hex
    }

    industrySiteCount(industry: Industry): number {
        return this.definition.map.industrySites.filter((site) => site.industry === industry).length
    }

    obsolescenceDrop(revenue: number): number {
        return this.definition.obsolescence.reduce(
            (drop, band) => (revenue >= band.from ? band.drop : drop),
            0
        )
    }
}

const EDITIONS: Record<EditionId, Edition> = {
    [EditionId.Germany]: new Edition(GERMANY),
    [EditionId.Midwest]: new Edition(MIDWEST),
    [EditionId.Switzerland]: new Edition(SWITZERLAND),
    [EditionId.Denmark]: new Edition(DENMARK)
}

export function edition(id: EditionId): Edition {
    return EDITIONS[id]
}
