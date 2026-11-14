<script lang="ts">
    import type { HexId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cityLabel, cityLabelFontSize, drawsCityLabels } from '$lib/utils/boardGeometry.js'
    import { BOARD_LOOK } from '$lib/utils/boardLook.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import { cityMarkScale, coinOffset, DRAWN_STATION_RADIUS } from '$lib/utils/cityMarks.js'
    import BonusCoin from './BonusCoin.svelte'
    import StartRing from './StartRing.svelte'

    let { viewScale, litHexIds }: { viewScale: number; litHexIds: ReadonlySet<HexId> } = $props()

    const gameSession = getGameSession()

    const cities = $derived(cityPieces(gameSession.gameState))
    const fontSize = $derived(cityLabelFontSize(viewScale))
    const labelled = $derived(drawsCityLabels(viewScale))

    // The capacity written in the station: "1" on an East Coast city, "∞" on Chicago.
    const CAPACITY_TEXT = { '×1': { text: '1', size: 14.4 }, '∞': { text: '∞', size: 16.8 } }
</script>

<!-- R-4.1.4, R-4.2, R-4.3: stations with their capacity, start rings and bonus coins. The look of
     each mark is the one BOARD_LOOK picks (startMark, bonus); other styles are drawn beside them. -->
<g class="cities" aria-hidden="true">
    {#each cities as city (city.cityId)}
        {@const lit = litHexIds.has(city.hexId)}
        {@const coin = coinOffset(city.cityId)}
        <g
            transform="translate({city.station.x} {city.station.y}) scale({cityMarkScale(
                city.cityId
            )})"
            data-city-marks={city.cityId}
        >
            {#if !lit && city.startColours.length > 0 && BOARD_LOOK.startMark === 'ring'}
                <StartRing railroadIds={city.startColours} />
            {/if}
            <circle
                r={DRAWN_STATION_RADIUS}
                fill="var(--rtr-station)"
                stroke="var(--rtr-station-ink)"
                stroke-width="2.4"
            ></circle>
            {#if city.capacityMark}
                {@const capacity = CAPACITY_TEXT[city.capacityMark]}
                <text
                    y={capacity.size * 0.35}
                    font-size={capacity.size}
                    font-weight="800"
                    text-anchor="middle"
                    fill="var(--rtr-station-ink)">{capacity.text}</text
                >
            {:else}
                <path
                    d="M-6 -0.4 L0 -5.8 L6 -0.4 Z M-4.2 -0.4 h8.4 v5 h-8.4 Z"
                    fill="var(--rtr-station-ink)"
                ></path>
            {/if}
            {#if city.bonus && BOARD_LOOK.bonus === 'coin'}
                <g transform="translate({coin.x} {coin.y})">
                    <BonusCoin bonus={city.bonus} />
                </g>
            {/if}
        </g>
        {#if !lit && labelled}
            {@const label = cityLabel(city.cityId, fontSize)}
            <text
                x={label.x}
                y={label.y}
                font-size={label.fontSize}
                font-weight="700"
                text-anchor={label.textAnchor}
                fill="var(--rtr-ink)"
                stroke="var(--rtr-plain)"
                stroke-width={label.fontSize * 0.28}
                stroke-linejoin="round"
                paint-order="stroke">{city.name}</text
            >
        {/if}
    {/each}
</g>
