<script lang="ts">
    import type { AxialCoordinates } from '@tabletop/common'
    import type { RoadEnds } from '@tabletop/magna-grecia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { hexCenter } from '$lib/utils/boardGeometry.js'
    import RoadTileArt from './RoadTileArt.svelte'

    let { coords, options }: { coords: AxialCoordinates; options: RoadEnds[] } = $props()

    const gameSession = getGameSession()
    const center = $derived(hexCenter(coords))
    const color = $derived(gameSession.colors.getPlayerUiColor(gameSession.myPlayerId))
    const RADIUS = 104

    let preview: RoadEnds | undefined = $state()

    const placed = $derived(
        options.map((ends, index) => {
            const angle = -Math.PI / 2 + (index * 2 * Math.PI) / options.length
            return { ends, x: Math.cos(angle) * RADIUS, y: Math.sin(angle) * RADIUS }
        })
    )
</script>

<g transform="translate({center.x} {center.y})">
    <circle r={RADIUS + 34} fill="rgba(35, 24, 12, 0.35)"></circle>
    {#if preview}
        <RoadTileArt ends={preview} {color} ghost />
    {/if}
    {#each placed as option, index (index)}
        <g
            role="button"
            tabindex="0"
            aria-label="Place road"
            class="cursor-pointer"
            transform="translate({option.x} {option.y}) scale(0.58)"
            onmouseenter={() => (preview = option.ends)}
            onmouseleave={() => (preview = undefined)}
            onfocus={() => (preview = option.ends)}
            onblur={() => (preview = undefined)}
            onclick={() => gameSession.placeRoad(coords, option.ends)}
            onkeydown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    gameSession.placeRoad(coords, option.ends)
                }
            }}
        >
            <circle r="58" fill="#fbf3dc" stroke="#6b3f1d" stroke-width="3"></circle>
            <RoadTileArt ends={option.ends} {color} />
        </g>
    {/each}
</g>
