<script lang="ts">
    import type { HexId } from '@tabletop/ride-the-rails'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cityLabel, cityLabelFontSize } from '$lib/utils/boardGeometry.js'
    import { cityPieces } from '$lib/utils/boardPieces.js'
    import { railroadStyle } from '$lib/utils/railroadStyle.js'

    let { viewScale, litHexIds }: { viewScale: number; litHexIds: ReadonlySet<HexId> } = $props()

    const gameSession = getGameSession()

    const cities = $derived(cityPieces(gameSession.gameState))
    const fontSize = $derived(cityLabelFontSize(viewScale))

    // The station's drawn shapes are laid out for a disc of this radius and scaled to each city's.
    const DRAWN_RADIUS = 10.6
    const START_PIP_GAP = 8.6
</script>

<!-- R-4.1.4, R-4.2, R-4.3: stations, capacity marks, start colours, bonuses and coast ends. -->
<g class="cities" aria-hidden="true">
    {#each cities as city (city.cityId)}
        {@const lit = litHexIds.has(city.hexId)}
        <g
            transform="translate({city.station.x} {city.station.y}) scale({city.station.radius /
                DRAWN_RADIUS})"
        >
            {#if city.transcontinentalEnd}
                <rect
                    x="-13"
                    y="11.2"
                    width="26"
                    height="4"
                    rx="2"
                    fill="var(--rtr-gold)"
                    stroke="var(--rtr-halo)"
                    stroke-width="1"
                ></rect>
            {/if}
            <circle
                r={DRAWN_RADIUS}
                fill="var(--rtr-station)"
                stroke="var(--rtr-station-ink)"
                stroke-width="2.2"
            ></circle>
            <path
                d="M-6 -0.4 L0 -5.8 L6 -0.4 Z M-4.2 -0.4 h8.4 v5 h-8.4 Z"
                fill="var(--rtr-station-ink)"
            ></path>
            {#if city.capacityMark === '×1'}
                <text
                    x="-22.4"
                    y="4.4"
                    font-size="12.4"
                    font-weight="800"
                    text-anchor="middle"
                    fill="var(--rtr-ink)"
                    stroke="var(--rtr-plain)"
                    stroke-width="3.2"
                    paint-order="stroke">×1</text
                >
            {:else if city.capacityMark === '∞'}
                <text
                    x="23.2"
                    y="6"
                    font-size="16"
                    font-weight="800"
                    text-anchor="middle"
                    fill="var(--rtr-ink)"
                    stroke="var(--rtr-plain)"
                    stroke-width="3.2"
                    paint-order="stroke">∞</text
                >
            {/if}
            {#if city.bonus?.kind === 'chicago'}
                <circle
                    cx="-23"
                    cy="1"
                    r="8.8"
                    fill="var(--rtr-coin)"
                    stroke="var(--rtr-halo)"
                    stroke-width="1.6"
                ></circle>
                <text
                    x="-23"
                    y="4.6"
                    font-size="9.6"
                    font-weight="800"
                    text-anchor="middle"
                    fill="var(--rtr-halo)">${city.bonus.amount}</text
                >
            {:else if city.bonus?.kind === 'five'}
                <g opacity={city.bonus.taken ? 0.32 : 1}>
                    <path d="M-31 -9 v22" stroke="var(--rtr-ink)" stroke-width="1.8"></path>
                    <path
                        d="M-31 -9 l20 5.8 l-20 5.8 Z"
                        fill="var(--rtr-five)"
                        stroke="var(--rtr-halo)"
                        stroke-width="1"
                    ></path>
                    <text
                        x="-24.8"
                        y="-0.6"
                        font-size="8.4"
                        font-weight="800"
                        fill="var(--rtr-station)">${city.bonus.amount}</text
                    >
                </g>
            {/if}
            {#if !lit}
                {#each city.startColours as railroadId, index (railroadId)}
                    <circle
                        cx={(index - (city.startColours.length - 1) / 2) * START_PIP_GAP}
                        cy="-17"
                        r="3.7"
                        fill={railroadStyle(railroadId).fill}
                        stroke="var(--rtr-halo)"
                        stroke-width="0.9"
                    ></circle>
                {/each}
            {/if}
        </g>
        {#if !lit}
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
