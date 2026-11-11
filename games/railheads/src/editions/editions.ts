import {
    HexGrid,
    assertExists,
    coordinatesToNumber,
    distanceAxial,
    type AxialCoordinates,
    type HexGridNode
} from '@tabletop/common'
import { GERMANY } from './germany/edition.js'
import { MIDWEST } from './midwest/edition.js'
import {
    EditionId,
    HexKind,
    SiteKind,
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

    constructor(definition: EditionDefinition) {
        const { map } = definition
        super({ hexDefinition: { orientation: map.orientation } })
        this.regions = map.regions
        this.demandAreas = map.demandAreas
        this.water = map.water
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

    neighbourCoords(coords: AxialCoordinates): AxialCoordinates[] {
        return this.neighborsAt(coords).map((neighbour) => neighbour.coords)
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
    [EditionId.Midwest]: new Edition(MIDWEST)
}

export function edition(id: EditionId): Edition {
    return EDITIONS[id]
}
