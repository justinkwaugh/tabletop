<script lang="ts">
    import {
        CITIES,
        CityTier,
        HEXES,
        cityInHex,
        developmentCapacity,
        hasCubeLimit,
        type CompanyId
    } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { HEX_RADIUS, MAP_RECT, hexCenter, hexPoints } from '$lib/utils/boardLayout.js'
    import { COMPANY_STYLE } from '$lib/utils/companyStyle.js'
    import { hexName } from '$lib/utils/describeAction.js'
    import Cube from '../icons/Cube.svelte'
    import House from '../icons/House.svelte'

    const gameSession = getGameSession()

    const TIER_FILL: Record<CityTier, string> = {
        [CityTier.White]: '#ffffff',
        [CityTier.Brown]: '#6b4636',
        [CityTier.Black]: '#1a1512'
    }

    const HOUSE_SIZE = 22
    const HOUSE_STEP = 24
    const CUBE_SIZE = 30

    const hexes = $derived(
        HEXES.map((place) => {
            const center = hexCenter(place.id)
            const found = cityInHex(place.id)
            const companies = gameSession.gameState.companiesIn(place.id)
            const pending = gameSession.chosenHexes.includes(place.id)
            const cubes: { companyId: CompanyId; ghost: boolean }[] = [
                ...companies.map((companyId) => ({ companyId, ghost: false })),
                ...(pending && gameSession.buildCompany
                    ? [{ companyId: gameSession.buildCompany, ghost: true }]
                    : [])
            ]
            return {
                id: place.id,
                center,
                city: found,
                cubes,
                cubeY: found ? center.y + 37 : center.y + 4,
                target: gameSession.hexTargets.includes(place.id),
                pending
            }
        })
    )

    const cities = $derived(
        CITIES.map((place) => {
            const center = hexCenter(place.hexId)
            return {
                ...place,
                center,
                markers: gameSession.gameState.markersIn(place.id),
                capacity: developmentCapacity(place.id),
                target: gameSession.cityTargets.includes(place.id),
                chosen: gameSession.developCity === place.id
            }
        })
    )

    // Starting cities can hold every grocer, so crowded hexes overlap their cubes to fit.
    function cubeX(index: number, count: number, centerX: number): number {
        const spacing = count > 2 ? CUBE_SIZE * 0.78 : CUBE_SIZE + 4
        return centerX + (index - (count - 1) / 2) * spacing
    }

    function onKey(event: KeyboardEvent, action: () => void) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            action()
        }
    }
</script>

<defs>
    <linearGradient id="hcg-land" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#d9c38a" />
        <stop offset="0.55" stop-color="#e3c27a" />
        <stop offset="1" stop-color="#c9a65e" />
    </linearGradient>
    <clipPath id="hcg-map-clip">
        <rect x={MAP_RECT.x} y={MAP_RECT.y} width={MAP_RECT.width} height={MAP_RECT.height} rx="14" />
    </clipPath>
</defs>

<g clip-path="url(#hcg-map-clip)">
    <rect x={MAP_RECT.x} y={MAP_RECT.y} width={MAP_RECT.width} height={MAP_RECT.height} fill="url(#hcg-land)" />
    <g transform="translate(0 {MAP_RECT.y})">
    <path
        d="M0 210 C180 150 320 250 520 190 S860 120 980 170 L980 0 L0 0 Z"
        fill="#b7b07a"
        opacity="0.45"
    />
    <path d="M0 420 C200 360 380 470 600 400 S880 340 980 380" class="furrow" />
    <path d="M0 520 C220 470 420 560 640 500 S900 450 980 490" class="furrow" />
    <path d="M0 620 C240 580 460 650 700 600 S920 560 980 590" class="furrow" />
    </g>
</g>
<rect
    x={MAP_RECT.x}
    y={MAP_RECT.y}
    width={MAP_RECT.width}
    height={MAP_RECT.height}
    rx="14"
    class="map-frame"
/>

{#each hexes as place (place.id)}
    <polygon points={hexPoints(place.center)} class="hex" class:city={place.city} />
{/each}

{#each cities as place (place.id)}
    {#each place.startOf as companyId, index (companyId)}
        <polygon
            points={hexPoints(place.center, HEX_RADIUS - 6 - index * 6)}
            class="start-ring"
            stroke={COMPANY_STYLE[companyId].fill}
        />
    {/each}
{/each}

{#each cities as place (place.id)}
    <g class="city">
        <text
            x={place.center.x}
            y={place.center.y + 6}
            class="name"
            class:major={place.tier === CityTier.Black}>{place.name}</text
        >
        <circle
            cx={place.center.x - 40}
            cy={place.center.y - 28}
            r="10"
            fill={TIER_FILL[place.tier]}
            class="dot"
        />
        {#each Array.from({ length: place.capacity }, (_, index) => index) as slot (slot)}
            <House
                x={place.center.x - 14 + slot * HOUSE_STEP}
                y={place.center.y - 29}
                size={HOUSE_SIZE}
                built={slot < place.markers}
            />
        {/each}
    </g>
{/each}

{#each hexes as place (place.id)}
    {#each place.cubes as cube, index (`${cube.companyId}-${cube.ghost}`)}
        <Cube
            x={cubeX(index, place.cubes.length, place.center.x)}
            y={place.cubeY}
            size={CUBE_SIZE}
            fill={COMPANY_STYLE[cube.companyId].fill}
            ghost={cube.ghost}
        />
    {/each}
    {#if hasCubeLimit(place.id) && place.cubes.length === 0 && !place.city}
        <circle cx={place.center.x} cy={place.center.y} r="2.5" class="pip" />
    {/if}
{/each}

{#each hexes as place (place.id)}
    {#if place.target}
        <g
            class="target"
            role="button"
            tabindex="0"
            aria-label="Place a cube in {place.city ? place.city.name : `hex ${place.id}`}"
            onclick={() => gameSession.clickHex(place.id)}
            onkeydown={(event) => onKey(event, () => gameSession.clickHex(place.id))}
        >
            <polygon points={hexPoints(place.center, HEX_RADIUS - 4)} class="ring" />
            <title>{hexName(place.id)}</title>
        </g>
    {/if}
{/each}

{#each cities as place (place.id)}
    {#if place.target || place.chosen}
        <g
            class="target"
            class:chosen={place.chosen}
            role="button"
            tabindex="0"
            aria-label="Develop {place.name}"
            onclick={() => gameSession.clickCity(place.id)}
            onkeydown={(event) => onKey(event, () => gameSession.clickCity(place.id))}
        >
            <rect
                x={place.center.x - 56}
                y={place.center.y - 46}
                width={place.capacity * HOUSE_STEP + 46}
                height="32"
                rx="10"
                class="ring"
            />
        </g>
    {/if}
{/each}

<style>
    .furrow {
        fill: none;
        stroke: #b48d4c;
        stroke-width: 2;
        opacity: 0.35;
    }

    .map-frame {
        fill: none;
        stroke: #7a1d22;
        stroke-width: 5;
    }

    .hex {
        fill: rgba(253, 248, 236, 0.72);
        stroke: #2b1a10;
        stroke-width: 4;
        stroke-linejoin: round;
    }

    .hex.city {
        fill: rgba(255, 252, 244, 0.9);
    }

    .start-ring {
        fill: none;
        stroke-width: 5;
        stroke-linejoin: round;
    }

    .name {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 15px;
        fill: #2b1a10;
        paint-order: stroke;
        stroke: rgba(255, 252, 244, 0.9);
        stroke-width: 3px;
        text-anchor: middle;
        pointer-events: none;
    }

    .name.major {
        font-size: 15px;
        font-weight: 700;
    }

    .dot {
        stroke: #1a1512;
        stroke-width: 2.5;
    }


    .pip {
        fill: #8a6a45;
        opacity: 0.4;
    }

    .target {
        cursor: pointer;
        outline: none;
    }

    .ring {
        fill: rgba(255, 230, 140, 0.25);
        stroke: #c8961a;
        stroke-width: 4;
        stroke-dasharray: 8 5;
        animation: hcg-ring 1.4s linear infinite;
    }

    .target:hover .ring,
    .target:focus-visible .ring,
    .target.chosen .ring {
        fill: rgba(255, 220, 110, 0.55);
    }

    @keyframes hcg-ring {
        to {
            stroke-dashoffset: -26;
        }
    }
</style>
