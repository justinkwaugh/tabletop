<script lang="ts">
    import { MachineState } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { bonusPillSpot } from '$lib/utils/terrainMarks.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import BonusPill from './BonusPill.svelte'

    const gameSession = getGameSession()

    // R-4.3: bonuses are paid for building, so the journey phase shows none (R-3.3).
    const riding = $derived(gameSession.gameState.machineState === MachineState.Riding)

    // R-4.3.2: a $5 bonus once taken is gone from the map; Chicago's $2 stays.
    const pills = $derived(
        (riding ? [] : cityPieces(gameSession.gameState)).flatMap((city) =>
            city.bonus && !(city.bonus.kind === 'five' && city.bonus.taken)
                ? [{ cityId: city.cityId, bonus: city.bonus, spot: bonusPillSpot(city.hexId) }]
                : []
        )
    )
</script>

<!-- R-4.3.1, R-4.3.2: each city's bonus pill at the bottom centre, below its cubes, above the
     start cues so a cue never covers it; none while journeys are made. The look is the one BOARD_LOOK.bonus picks. -->
<g class="bonuses" aria-hidden="true">
    {#if BOARD_LOOK.bonus === 'pill'}
        {#each pills as pill (pill.cityId)}
            <!-- The bottom centre of the hex, as its map's hexes stand; of Berlin's second cell. -->
            <g transform="translate({pill.spot.x} {pill.spot.y})">
                <BonusPill bonus={pill.bonus} />
            </g>
        {/each}
    {/if}
</g>
