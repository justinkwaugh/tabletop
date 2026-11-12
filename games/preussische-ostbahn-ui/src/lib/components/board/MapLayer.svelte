<script lang="ts">
    import {
        BERLIN,
        MAP_SPACES,
        RAILROADS,
        SpaceKind,
        Terrain,
        mapSpace,
        type MapSpace
    } from '@tabletop/preussische-ostbahn'
    import { HEX_SIZE, hexCenter, hexPoints, spaceCenter } from '$lib/utils/boardGeometry.js'
    import { RAILROAD_STYLES, homeTint } from '$lib/utils/railroadStyle.js'
    import {
        APPROACH_HATCH_ID,
        BERLIN_FILL,
        CITY_FILL,
        GRID_LINE,
        HOME_INSET,
        TERRAIN_FILLS,
        TERRAIN_MARKS,
        TINT_LINE,
        terrainMarkPath
    } from '$lib/utils/terrainStyle.js'

    const HOMES = new Map(RAILROADS.map((railroad) => [railroad.homeSpaceId, railroad.id]))

    const tinted = (space: MapSpace) =>
        space.kind === SpaceKind.City || space.terrain !== Terrain.Plains

    const hexes = MAP_SPACES.filter((space) => space.id !== BERLIN).flatMap((space) =>
        space.hexes.map((coords) => ({ space, center: hexCenter(coords) }))
    )
    const plainHexes = hexes.filter(({ space }) => !HOMES.has(space.id) && !tinted(space))
    const tintedHexes = hexes.filter(({ space }) => !HOMES.has(space.id) && tinted(space))
    const homeHexes = hexes.filter(({ space }) => HOMES.has(space.id))

    const berlinHexes = mapSpace(BERLIN).hexes.map(hexCenter)
    const cities = MAP_SPACES.filter((space) => space.city !== undefined)

    function fill(space: MapSpace): string {
        return space.kind === SpaceKind.City ? CITY_FILL : TERRAIN_FILLS[space.terrain]
    }

    function homeColor(space: MapSpace): string {
        const home = HOMES.get(space.id)
        return home ? RAILROAD_STYLES[home].fill : CITY_FILL
    }
</script>

<g class="map">
    {#each berlinHexes as center, index (index)}
        <polygon
            points={hexPoints(center)}
            fill={BERLIN_FILL}
            stroke={BERLIN_FILL}
            stroke-width="1.5"
        ></polygon>
    {/each}
    {#each plainHexes as { space, center } (`${space.id}-${center.x}-${center.y}`)}
        <polygon points={hexPoints(center)} fill={fill(space)} stroke={GRID_LINE} stroke-width="0.8"
        ></polygon>
        {#if space.kind === SpaceKind.Approach}
            <polygon points={hexPoints(center)} fill={`url(#${APPROACH_HATCH_ID})`}></polygon>
        {/if}
    {/each}
    {#each tintedHexes as { space, center } (`${space.id}-${center.x}-${center.y}`)}
        <polygon points={hexPoints(center)} fill={fill(space)} stroke={TINT_LINE} stroke-width="1.2"
        ></polygon>
    {/each}
    {#each homeHexes as { space, center } (`${space.id}-${center.x}-${center.y}`)}
        <polygon
            points={hexPoints(center)}
            fill={homeColor(space)}
            stroke={homeColor(space)}
            stroke-width="1"
        ></polygon>
        <polygon points={hexPoints(center, HOME_INSET)} fill={homeTint(homeColor(space))}></polygon>
    {/each}
    {#each [...tintedHexes, ...homeHexes] as { space, center } (`mark-${space.id}-${center.x}-${center.y}`)}
        {@const mark =
            space.kind === SpaceKind.City
                ? terrainMarkPath(space.terrain, center.x, center.y - HEX_SIZE + 22, 1.35)
                : undefined}
        {#if mark}
            <path d={mark} fill={TERRAIN_MARKS[space.terrain]}></path>
        {/if}
    {/each}
    {#each cities as space (space.id)}
        {@const center = spaceCenter(space)}
        {#if (space.city?.value ?? 1) > 1}
            <text
                x={center.x}
                y={space.id === BERLIN ? center.y + 56 : center.y + 28}
                class="value"
                class:berlin={space.id === BERLIN}
                text-anchor="middle">{space.city?.value}</text
            >
        {/if}
        {#if space.id === BERLIN}
            <text x={center.x} y={center.y - 10} class="berlin-name" text-anchor="middle"
                >{space.city?.name}</text
            >
        {/if}
    {/each}
</g>

<style>
    .berlin-name {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 25px;
        font-weight: 700;
        fill: #2b2418;
    }

    .value {
        font-family: 'Ostbahn Baskerville', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
        fill: #2b2418;
    }

    .value.berlin {
        font-size: 22px;
    }
</style>
