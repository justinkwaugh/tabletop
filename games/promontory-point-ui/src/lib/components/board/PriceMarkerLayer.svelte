<script lang="ts">
    import { RAILROAD_IDS } from '@tabletop/promontory-point'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'
    import { boxCentre } from '$lib/utils/boardGeometry.js'
    import { priceMarkerSlot } from '$lib/utils/boardLayout.js'
    import { railroadColour, railroadInk } from '$lib/utils/railroadPalette.js'

    const gameSession = getGameSession()
    const RADIUS = 38

    const markers = $derived(
        RAILROAD_IDS.map((railroadId) => {
            const priceIndex = gameSession.gameState.priceIndex[railroadId]
            return {
                railroadId,
                priceIndex,
                centre: boxCentre(priceMarkerSlot(railroadId, priceIndex))
            }
        })
    )
</script>

<!-- R-1.2: each railroad in its own slot of its space, so markers on one value never overlap. -->
{#each markers as { railroadId, priceIndex, centre } (railroadId)}
    <g
        transform="translate({centre.x} {centre.y})"
        data-price-marker={railroadId}
        data-price-index={priceIndex}
    >
        <g class="motion">
            <circle cy="5" r={RADIUS} fill="var(--pp-halo)" opacity="0.4"></circle>
            <circle
                r={RADIUS}
                fill={railroadColour(railroadId)}
                stroke="var(--pp-halo)"
                stroke-width="6"
            ></circle>
            <text class="pp-board-figure" font-size="32" fill={railroadInk(railroadId)}
                >{RAILROAD_TAGS[railroadId]}</text
            >
        </g>
    </g>
{/each}
