import {
    CoralColors,
    coralCounts,
    type CoralColor,
    type CoralCounts,
    type HydratedReefEncounterPlayerState
} from '@tabletop/reef-encounter'

export type ColorCount = { color: CoralColor; count: number }

export type PlayerPanelView = {
    screen?: ColorCount[]
    hiddenScreenPolyps: number
    larvaCubes?: ColorCount[]
    consumed: ColorCount[]
    shrimpsBehindScreen?: number
    shrimpOnOpenSea: boolean
    shrimpsInParrotfish?: number
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
    const parrotfish = player.knownParrotfishPolyps
        ? combined(player.knownParrotfishPolyps, player.secretParrotfishPolyps)
        : undefined
    return {
        screen: player.knownScreenPolyps
            ? colorCounts(combined(player.knownScreenPolyps, player.secretScreenPolyps))
            : undefined,
        hiddenScreenPolyps: player.secretScreenPolyps ? 0 : (player.secretScreenPolypCount ?? 0),
        larvaCubes: player.larvaCubes ? colorCounts(player.larvaCubes) : undefined,
        consumed: colorCounts(player.consumedPolyps),
        shrimpsBehindScreen: player.shrimpsBehindScreen,
        shrimpOnOpenSea: player.shrimpOnOpenSea,
        shrimpsInParrotfish: player.shrimpsInParrotfish,
        parrotfish: parrotfish ? colorCounts(parrotfish) : undefined,
        parrotfishPoints: parrotfish ? points(parrotfish, values) : undefined,
        hiddenParrotfishPolyps: !player.secretParrotfishPolyps && parrotfishFed ? 1 : 0
    }
}

function combined(shown: CoralCounts, secret?: CoralCounts): CoralCounts {
    const total = coralCounts()
    for (const color of CoralColors) {
        total[color] = shown[color] + (secret?.[color] ?? 0)
    }
    return total
}

function colorCounts(counts: CoralCounts): ColorCount[] {
    return CoralColors.filter((color) => counts[color] > 0).map((color) => ({
        color,
        count: counts[color]
    }))
}

function points(counts: CoralCounts, values: CoralCounts): number {
    return CoralColors.reduce((sum, color) => sum + counts[color] * values[color], 0)
}
