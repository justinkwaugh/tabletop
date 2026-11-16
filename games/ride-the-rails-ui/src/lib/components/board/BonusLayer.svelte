<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import { BONUS_PILL } from '$lib/utils/cityMarks.js'
    import BonusPill from './BonusPill.svelte'

    const gameSession = getGameSession()

    // R-4.3.2: a $5 bonus once taken is gone from the map; Chicago's $2 stays.
    const pills = $derived(
        cityPieces(gameSession.gameState).flatMap((city) =>
            city.bonus && !(city.bonus.kind === 'five' && city.bonus.taken)
                ? [{ cityId: city.cityId, bonus: city.bonus, center: hexCenter(city.hexId) }]
                : []
        )
    )
</script>

<!-- R-4.3.1, R-4.3.2: each city's bonus pill at the bottom centre, below its cubes, above the
     start cues so a cue never covers it. The look is the one BOARD_LOOK.bonus picks. -->
<g class="bonuses" aria-hidden="true">
    {#if BOARD_LOOK.bonus === 'pill'}
        {#each pills as pill (pill.cityId)}
            <g
                transform="translate({pill.center.x + BONUS_PILL.center.x} {pill.center.y +
                    BONUS_PILL.center.y})"
            >
                <BonusPill bonus={pill.bonus} />
            </g>
        {/each}
    {/if}
</g>
