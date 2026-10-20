import {
    CoralColors,
    parrotfishPoints,
    type CoralColor,
    type CoralCounts,
    type HydratedReefEncounterPlayerState
} from '@tabletop/reef-encounter'

export type ColorCount = { color: CoralColor; count: number }

export type PlayerPanelView = {
    supply?: ColorCount[]
    hiddenSupplyPolyps: number
    larvaCubes?: ColorCount[]
    consumed: ColorCount[]
    shrimpsInSupply?: number
    shrimpsEaten?: string
    parrotfish?: ColorCount[]
    parrotfishPoints?: number
    hiddenParrotfishPolyps: number
}

// Fields a Concealed game hides from this viewer are left undefined, so the panel can say so.
export function playerPanelView(
    player: HydratedReefEncounterPlayerState,
    values: CoralCounts,
    parrotfishFed: boolean
): PlayerPanelView {
    const parrotfish = player.visibleParrotfishPolyps()
    const supply = player.visibleSupplyPolyps()
    return {
        supply: supply ? colorCounts(supply) : undefined,
        hiddenSupplyPolyps: player.secretSupplyPolyps ? 0 : (player.secretSupplyPolypCount ?? 0),
        larvaCubes: player.larvaCubes ? colorCounts(player.larvaCubes) : undefined,
        consumed: colorCounts(player.consumedPolyps),
        shrimpsInSupply: player.shrimpsInSupply,
        shrimpsEaten: shrimpsEaten(player.shrimpOnOpenSea, player.shrimpsInParrotfish),
        parrotfish: parrotfish ? colorCounts(parrotfish) : undefined,
        parrotfishPoints: parrotfish ? parrotfishPoints(parrotfish, values) : undefined,
        hiddenParrotfishPolyps: !player.secretParrotfishPolyps && parrotfishFed ? 1 : 0
    }
}

// Only the first shrimp, on the open sea, is public; a Concealed game hides the rest.
export function shrimpsEaten(
    onOpenSea: boolean,
    inParrotfish: number | undefined
): string | undefined {
    if (!onOpenSea) return undefined
    if (inParrotfish === undefined) return 'Ate at least 1 shrimp'
    const count = 1 + inParrotfish
    return `ate ${count} shrimp${count > 1 ? 's' : ''}`
}

function colorCounts(counts: CoralCounts): ColorCount[] {
    return CoralColors.filter((color) => counts[color] > 0).map((color) => ({
        color,
        count: counts[color]
    }))
}
