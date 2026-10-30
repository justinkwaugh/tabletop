<script lang="ts">
    import { BOARD_GRID } from '@tabletop/promontory-point'
    import { townTileImage } from '$lib/images/tileImages.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        TOWN_TILE_SCALE,
        localHexPoints,
        pointsAttribute,
        spaceCentre,
        townTileRotation
    } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()
    const uid = $props.id()
    const clipId = `pp-town-tile-${uid}`
    const tileHex = localHexPoints(TOWN_TILE_SCALE)
    const side = 2 * Math.max(...tileHex.map((point) => Math.abs(point.y)))

    const towns = $derived(
        BOARD_GRID.spaces().flatMap((space) =>
            space.spaceId in gameSession.gameState.towns
                ? [{ spaceId: space.spaceId, kindId: gameSession.gameState.towns[space.spaceId] }]
                : []
        )
    )
</script>

<defs>
    <clipPath id={clipId}>
        <polygon points={pointsAttribute(tileHex)}></polygon>
    </clipPath>
</defs>
<!-- R-1.3: every town tile stays face up, under a piece too; O-6: the number tiles turn upright. -->
{#each towns as { spaceId, kindId } (spaceId)}
    {@const centre = spaceCentre(spaceId)}
    <g transform="translate({centre.x} {centre.y})" data-town-tile={kindId}>
        <g clip-path="url(#{clipId})">
            <image
                href={townTileImage(kindId).src}
                x={-side / 2}
                y={-side / 2}
                width={side}
                height={side}
                transform="rotate({townTileRotation(kindId)})"
            ></image>
        </g>
        <polygon
            points={pointsAttribute(tileHex)}
            fill="none"
            stroke="var(--pp-halo)"
            stroke-opacity="0.55"
            stroke-width="4"
        ></polygon>
    </g>
{/each}
