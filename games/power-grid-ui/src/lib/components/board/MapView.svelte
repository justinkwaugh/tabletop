<script lang="ts">
    import { gameMap } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { mapArt, OUT_OF_PLAY_FILL, REGION_FILLS } from '$lib/maps/boardArt.js'
    import { cityPoint } from '$lib/maps/mapArt.js'
    import { connectionGeometry } from '$lib/utils/mapGeometry.js'
    import City from './City.svelte'

    const session = getGameSession()

    const map = $derived(gameMap(session.gameState.mapId))
    const art = $derived(mapArt(session.gameState.mapId))
    const inPlay = $derived(new Set(session.gameState.regions))
    const regionOf = $derived(new Map(map.cities.map((city) => [city.id, city.region])))

    const connections = $derived(
        map.connections.map((connection) => ({
            ...connection,
            ...connectionGeometry(cityPoint(art, connection.a), cityPoint(art, connection.b)),
            active:
                inPlay.has(regionOf.get(connection.a) ?? '') &&
                inPlay.has(regionOf.get(connection.b) ?? '')
        }))
    )
</script>

<svg
    width={art.width}
    height={art.height}
    viewBox="0 0 {art.width} {art.height}"
    class="block select-none"
    role="img"
    aria-label="Map of {map.name}"
>
    <defs>
        <clipPath id="pg-land">
            <path d={art.land}></path>
        </clipPath>
        <pattern
            id="pg-out-of-play"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
        >
            <rect width="10" height="10" fill={OUT_OF_PLAY_FILL}></rect>
            <line x1="0" y1="0" x2="0" y2="10" stroke="#8f8b7c" stroke-width="3"></line>
        </pattern>
    </defs>

    <rect width={art.width} height={art.height} fill="#46708f"></rect>
    <path d={art.neighbours} fill="#9da17f" stroke="#80856a" stroke-width="1"></path>

    <g clip-path="url(#pg-land)">
        {#each Object.entries(art.regions) as [region, d] (region)}
            <path
                {d}
                fill={inPlay.has(region) ? REGION_FILLS[region] : 'url(#pg-out-of-play)'}
                stroke={inPlay.has(region) ? REGION_FILLS[region] : 'none'}
                stroke-width="1"
            ></path>
        {/each}
        <path d={art.regionBorders} fill="none" stroke="#2c2722" stroke-width="2" opacity="0.55"
        ></path>
    </g>
    <path d={art.lakes} fill="#46708f"></path>
    <path d={art.rivers} fill="none" stroke="#4d7ba0" stroke-width="1.8" stroke-linecap="round"
    ></path>
    <path d={art.land} fill="none" stroke="#2a251f" stroke-width="2.5" stroke-linejoin="round"
    ></path>

    <g class="connections">
        {#each connections as connection (`${connection.a}-${connection.b}`)}
            <g opacity={connection.active ? 1 : 0.28}>
                <line
                    x1={connection.start.x}
                    y1={connection.start.y}
                    x2={connection.end.x}
                    y2={connection.end.y}
                    stroke="#4c5256"
                    stroke-width="8"
                    stroke-linecap="round"
                ></line>
                <line
                    x1={connection.start.x}
                    y1={connection.start.y}
                    x2={connection.end.x}
                    y2={connection.end.y}
                    stroke="#c5cacd"
                    stroke-width="5"
                    stroke-linecap="round"
                ></line>
            </g>
        {/each}
        {#each connections as connection (`badge-${connection.a}-${connection.b}`)}
            {#if connection.active && connection.badge}
                <g transform="translate({connection.mid.x} {connection.mid.y})">
                    <circle r={connection.badge} fill="#f1ede2" stroke="#3a3632" stroke-width="1.6"
                    ></circle>
                    <text
                        class="cost"
                        text-anchor="middle"
                        dominant-baseline="central"
                        font-size={connection.badge * 1.15}>{connection.cost}</text
                    >
                </g>
            {/if}
        {/each}
    </g>

    {#each map.cities as city (city.id)}
        <City {city} point={cityPoint(art, city.id)} active={inPlay.has(city.region)} />
    {/each}
</svg>

<style>
    .cost {
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 700;
        fill: #26221e;
    }
</style>
