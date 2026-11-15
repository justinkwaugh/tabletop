<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import { BONUS_PILL, CAPACITY_ONE, fiveRing } from '$lib/utils/cityMarks.js'
    import BonusPill from './BonusPill.svelte'
    import StartBand from './StartBand.svelte'

    const gameSession = getGameSession()

    const cities = $derived(
        cityPieces(gameSession.gameState).map((city) => ({
            ...city,
            center: hexCenter(city.hexId),
            fiveRing: fiveRing(city.bonus)
        }))
    )
</script>

<!-- R-4.1.4, R-4.2, R-4.3: start bands, East Coast capacities, bonus pills, and a green ring just
     outside each $5 city whose bonus is still to be had (R-4.3.2); the names are
     drawn above the track (CityLabelLayer). The look of each mark is the one BOARD_LOOK picks
     (startMark, bonus); other styles are drawn beside them. -->
<g class="cities" aria-hidden="true">
    {#each cities as city (city.cityId)}
        <g transform="translate({city.center.x} {city.center.y})" data-city-marks={city.cityId}>
            {#if city.fiveRing}
                <polygon
                    points={city.fiveRing.points}
                    fill="none"
                    stroke="var(--rtr-five)"
                    stroke-width={city.fiveRing.width}
                    stroke-linejoin="round"
                    data-five-ring
                ></polygon>
            {/if}
            {#if BOARD_LOOK.startMark === 'band'}
                <StartBand startColours={city.startColours} />
            {/if}
            {#if city.capacityMark === '×1'}
                <text
                    class="rtr-serif"
                    x={CAPACITY_ONE.x}
                    y={CAPACITY_ONE.y + CAPACITY_ONE.fontSize * 0.35}
                    font-size={CAPACITY_ONE.fontSize}
                    text-anchor="middle"
                    fill="var(--rtr-ink)"
                    data-capacity>1</text
                >
            {/if}
            {#if city.bonus && BOARD_LOOK.bonus === 'pill'}
                <g transform="translate({BONUS_PILL.center.x} {BONUS_PILL.center.y})">
                    <BonusPill bonus={city.bonus} />
                </g>
            {/if}
        </g>
    {/each}
</g>
