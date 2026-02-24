import { INDONESIA_REGIONS } from '@tabletop/indonesia'

type RegionDefinition = (typeof INDONESIA_REGIONS)[number]

const REGION_BY_ID: ReadonlyMap<string, RegionDefinition> = new Map(
    INDONESIA_REGIONS.map((region) => [region.id, region] as const)
)

export function getRegionName(regionId: string): string {
    return REGION_BY_ID.get(regionId)?.name ?? regionId
}

export function getRegionAreaIds(regionId: string): readonly string[] {
    return REGION_BY_ID.get(regionId)?.areaIds ?? []
}

export function* iterateRegionAreaIds(): Iterable<readonly string[]> {
    for (const region of INDONESIA_REGIONS) {
        yield region.areaIds
    }
}

export function* iterateRegionAreaIdsByRegion(): Iterable<[string, readonly string[]]> {
    for (const region of INDONESIA_REGIONS) {
        yield [region.id, region.areaIds]
    }
}
