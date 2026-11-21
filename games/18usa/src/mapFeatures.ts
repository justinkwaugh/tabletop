import type { TileEdge } from '@tabletop/18xx'

export const ResourceKinds = ['coal', 'oil', 'ore'] as const
export type ResourceKind = (typeof ResourceKinds)[number]

/** The hexes printed with each resource icon; B10 and B12 carry two (§13). */
export const ResourceLocationIds: Readonly<Record<ResourceKind, readonly string[]>> = {
    coal: [
        'B6',
        'B10',
        'B12',
        'C9',
        'D8',
        'D10',
        'D26',
        'E19',
        'E25',
        'F8',
        'F10',
        'F16',
        'F22',
        'F24'
    ],
    oil: ['B12', 'G15', 'H4', 'I17', 'I21', 'I23', 'J14'],
    ore: ['B10', 'C7', 'C19', 'D16', 'E5', 'E9', 'G21', 'H6']
}

export function resourcesAt(locationId: string): ResourceKind[] {
    return ResourceKinds.filter((kind) => ResourceLocationIds[kind].includes(locationId))
}

/** River cities printed with a bridge icon in their station slot (§4, §13.4). */
export const BridgeCityIds: readonly string[] = [
    'C3',
    'C17',
    'D14',
    'E15',
    'E17',
    'F20',
    'G17',
    'I19'
]

/** The 14 orange cities that each receive a subsidy tile at setup (§2.5). */
export const SubsidyCityIds: readonly string[] = [
    'B8',
    'B14',
    'C3',
    'D6',
    'D14',
    'E3',
    'E7',
    'E23',
    'G7',
    'G11',
    'G27',
    'H8',
    'I13',
    'I25'
]

export const NewYorkId = 'D28'
export const ClevelandId = 'D24'

/** Cities without station slots that routes always pass (§4); four are also red areas. */
export const SmallCityIds: readonly string[] = ['A15', 'B2', 'C23', 'C25', 'E1', 'J24']

/** The six hexes of Mexico, one red area (§12.4.1). */
export const MexicoLocationIds: readonly string[] = ['I5', 'I7', 'I9', 'I11', 'J12', 'K13']

/** The northern-border hexes where P17 Great Northern lays its extra yellow track. */
export const GreatNorthernBorderIds: readonly string[] = [
    'B4',
    'B6',
    'B8',
    'B10',
    'B12',
    'B14',
    'B16',
    'B18'
]

/** P17's two $30 bonuses: a train running to Fargo and Helena, and also to Seattle and Chicago. */
export const GreatNorthernBonusCities: readonly (readonly string[])[] = [
    ['B14', 'B8'],
    ['B14', 'B8', 'B2', 'D20']
]

/** Printed track stubs a yellow tile laid in these hexes must connect to, toward New York. */
export const RequiredTileEdges: Readonly<Record<string, TileEdge>> = {
    D26: 4,
    E27: 3
}
