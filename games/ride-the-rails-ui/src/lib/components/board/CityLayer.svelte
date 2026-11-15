<script lang="ts">
    import type { HexId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        cityLabel,
        cityLabelFontSize,
        drawsCityLabels,
        hexCenter
    } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import { BONUS_PILL, CAPACITY_ONE } from '$lib/utils/cityMarks.js'
    import BonusPill from './BonusPill.svelte'
    import StartBand from './StartBand.svelte'

    let { viewScale, litHexIds }: { viewScale: number; litHexIds: ReadonlySet<HexId> } = $props()

    const gameSession = getGameSession()

    const cities = $derived(
        cityPieces(gameSession.gameState).map((city) => ({
            ...city,
            center: hexCenter(city.hexId)
        }))
    )
    const fontSize = $derived(cityLabelFontSize(viewScale))
    const labelled = $derived(drawsCityLabels(viewScale))

    // A name's halo, in the plain's colour, as a share of its size.
    const LABEL_HALO = 0.3
</script>

<!-- R-4.1.4, R-4.2, R-4.3: start bands, East Coast capacities, bonus pills and names. The look of
     each mark is the one BOARD_LOOK picks (startMark, bonus); other styles are drawn beside them. -->
<g class="cities" aria-hidden="true">
    {#each cities as city (city.cityId)}
        <g transform="translate({city.center.x} {city.center.y})" data-city-marks={city.cityId}>
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
        {#if !litHexIds.has(city.hexId) && labelled}
            {@const label = cityLabel(city.cityId, fontSize)}
            <text
                class="rtr-serif"
                x={label.x}
                y={label.y}
                font-size={label.fontSize}
                text-anchor={label.textAnchor}
                fill="var(--rtr-ink)"
                stroke="var(--rtr-plain)"
                stroke-width={label.fontSize * LABEL_HALO}
                stroke-linejoin="round"
                paint-order="stroke">{city.name}</text
            >
        {/if}
    {/each}
</g>
