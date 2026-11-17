<script lang="ts">
    import type { Point } from '@tabletop/common'
    import {
        cityById,
        noRailroadStartsIn,
        type HexId,
        type RailroadId
    } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCells, hexCenter, hexOutline } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import { printsStartColours } from '$lib/utils/cityMarks.js'
    import { startCues } from '$lib/utils/startCues.js'
    import StartBand from './StartBand.svelte'

    const gameSession = getGameSession()

    const BLACK: RailroadId = 'railroad.black'

    // R-4.2.3: where a newly available railroad could start now but its colour is not printed
    // (Yellow in a westernmost city), the colour joins the city's band until it no longer may.
    const cues = $derived(BOARD_LOOK.startCue === 'band' ? startCues(gameSession.gameState) : [])

    // R-4.2.5: Black may start in any city. A plain city, printed with no colour or with Black alone
    // (the expansion maps list it), keeps an empty list, which StartBand draws as a thin Black band;
    // one where a cue lets another railroad start too is banded Black and that colour at full width.
    function bandColours(
        startColours: readonly RailroadId[],
        cued: readonly RailroadId[]
    ): readonly RailroadId[] {
        const extra = cued.filter((railroadId) => !startColours.includes(railroadId))
        if (printsStartColours(startColours)) return [...startColours, ...extra]
        return extra.length > 0 ? [BLACK, ...extra] : []
    }

    // R-8.5: a city over two cells is banded round its whole outline, from its centre.
    function twinOutline(hexId: HexId, center: Point): Point[] | undefined {
        if (hexCells(hexId).length < 2) return undefined
        return hexOutline(hexId).map((corner) => ({
            x: corner.x - center.x,
            y: corner.y - center.y
        }))
    }

    const cities = $derived(
        cityPieces(gameSession.gameState).map((city) => ({
            ...city,
            center: hexCenter(city.hexId),
            outline: twinOutline(city.hexId, hexCenter(city.hexId)),
            // R-8.2: no railroad starts in a long-distance city (Perth, Brisbane), so it has no
            // band, only the city's own rim.
            startless: noRailroadStartsIn(cityById(city.cityId)),
            bandColours: bandColours(
                city.startColours,
                cues.filter((cue) => cue.hexId === city.hexId).map((cue) => cue.railroadId)
            )
        }))
    )
</script>

<!-- R-4.2: start bands; a $5 city is marked by its bonus pill alone, drawn above the start cues
     (BonusLayer). The look of each mark is the one BOARD_LOOK picks (startMark); other styles are
     drawn beside them. -->
<g class="cities" aria-hidden="true">
    {#each cities as city (city.cityId)}
        <g transform="translate({city.center.x} {city.center.y})" data-city-marks={city.cityId}>
            {#if BOARD_LOOK.startMark === 'band' && !city.startless}
                <StartBand
                    startColours={city.bandColours}
                    frame={gameSession.boardFrame.hexFrame}
                    outline={city.outline}
                />
            {/if}
        </g>
    {/each}
</g>
