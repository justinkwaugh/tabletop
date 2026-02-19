import type { IndonesiaNodeId } from './indonesiaNodes.js'

export const INDONESIA_REGIONS = [
    {
        id: 'R01',
        areaIds: ['A01', 'A02', 'A03', 'A04'] as const
    },
    {
        id: 'R02',
        areaIds: ['A05', 'A07', 'A08', 'A10'] as const
    },
    {
        id: 'R03',
        areaIds: ['A06', 'A09', 'A11', 'A13'] as const
    },
    {
        id: 'R04',
        areaIds: ['A12', 'A16', 'A15', 'A19', 'A26'] as const
    },
    {
        id: 'R05',
        areaIds: ['A18', 'A23', 'A25'] as const
    },
    {
        id: 'R06',
        areaIds: ['A14', 'A17', 'A21'] as const
    },
    {
        id: 'R07',
        areaIds: ['A20', 'A24', 'A27', 'A28', 'A31', 'A32', 'A33'] as const
    },
    {
        id: 'R08',
        areaIds: ['A22', 'A29', 'A30', 'A34'] as const
    },
    {
        id: 'R09',
        areaIds: ['B03', 'B09', 'B13', 'B19'] as const
    },
    {
        id: 'R10',
        areaIds: ['B01', 'B02', 'B04'] as const
    },
    {
        id: 'R11',
        areaIds: ['B18', 'B10', 'B20', 'B16', 'B17'] as const
    },
    {
        id: 'R12',
        areaIds: ['B05', 'B06', 'B07', 'B08', 'B11'] as const
    },
    {
        id: 'R13',
        areaIds: ['B12', 'B15', 'B14'] as const
    },
    {
        id: 'R14',
        areaIds: ['D11', 'D07', 'D08'] as const
    },
    {
        id: 'R15',
        areaIds: ['D09', 'D10', 'D13'] as const
    },
    {
        id: 'R16',
        areaIds: ['D01', 'D04', 'D05', 'D06', 'D12'] as const
    },
    {
        id: 'R17',
        areaIds: ['D02', 'D03'] as const
    },
    {
        id: 'R18',
        areaIds: ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07'] as const
    },
    {
        id: 'R19',
        areaIds: ['C08', 'C09', 'C10', 'C11'] as const
    },
    {
        id: 'R20',
        areaIds: ['C12', 'C13', 'C14', 'C15', 'C16', 'C17'] as const
    },
    {
        id: 'R21',
        areaIds: ['C21', 'C22'] as const
    },
    {
        id: 'R22',
        areaIds: ['C23', 'C24'] as const
    },
    {
        id: 'R23',
        areaIds: ['C26', 'C25', 'C28', 'C27', 'C29', 'C30'] as const
    },
    {
        id: 'R24',
        areaIds: ['C18', 'C19', 'C20'] as const
    },
    {
        id: 'R25',
        areaIds: ['E08', 'E09', 'E07', 'E11', 'E06'] as const
    },
    {
        id: 'R26',
        areaIds: ['E05', 'E04', 'E03', 'E02', 'E10', 'E01'] as const
    },
    {
        id: 'R27',
        areaIds: ['F06', 'F03', 'F05', 'F02', 'F04', 'F01', 'F07'] as const
    }
] as const

export type IndonesiaRegionId = (typeof INDONESIA_REGIONS)[number]['id']

export type IndonesiaRegion = {
    id: IndonesiaRegionId
    areaIds: IndonesiaNodeId[]
}

export const INDONESIA_REGION_BY_AREA_ID: Readonly<
    Partial<Record<IndonesiaNodeId, IndonesiaRegionId>>
> = Object.freeze(
    Object.fromEntries(
        INDONESIA_REGIONS.flatMap((region) =>
            region.areaIds.map((areaId) => [areaId, region.id] as const)
        )
    ) as Partial<Record<IndonesiaNodeId, IndonesiaRegionId>>
)
