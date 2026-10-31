<script lang="ts">
    import { onMount } from 'svelte'
    import { roundNumber } from '@tabletop/common'
    import { RAILROAD_IDS } from '@tabletop/promontory-point'
    import { restMarker } from '$lib/animators/markerMotion.js'
    import { PriceMarkerAnimator, priceMarkerPose } from '$lib/animators/priceMarkerAnimator.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'
    import { boxCentre } from '$lib/utils/boardGeometry.js'
    import { priceMarkerSlot } from '$lib/utils/boardLayout.js'
    import { railroadColour, railroadInk } from '$lib/utils/railroadPalette.js'

    const gameSession = getGameSession()
    // A hex badge like the home hexes, a little wider than its slot's old disc.
    const SIZE = 38
    const hexPoints = (scale: number) =>
        [0, 1, 2, 3, 4, 5]
            .map((corner) => {
                const angle = (Math.PI / 3) * corner - Math.PI / 2
                return `${roundNumber(Math.cos(angle) * SIZE * scale, 1)},${roundNumber(Math.sin(angle) * SIZE * scale, 1)}`
            })
            .join(' ')
    const OUTER = hexPoints(1.1)
    const INNER = hexPoints(0.86)

    const animator = new PriceMarkerAnimator(gameSession)
    onMount(() => {
        animator.register()
        return () => animator.unregister()
    })

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
        <g
            class="motion"
            use:restMarker={{
                motion: animator.motion,
                key: railroadId,
                rest: priceMarkerPose(railroadId, priceIndex)
            }}
        >
            <polygon points={OUTER} transform="translate(0 5)" fill="var(--pp-halo)" opacity="0.4"
            ></polygon>
            <polygon
                points={OUTER}
                data-price-badge
                fill={railroadColour(railroadId)}
                stroke="var(--pp-charcoal)"
                stroke-width={SIZE * 0.14}
                stroke-linejoin="round"
            ></polygon>
            <polygon
                points={INNER}
                fill="none"
                stroke={railroadInk(railroadId)}
                stroke-opacity="0.6"
                stroke-width={SIZE * 0.05}
            ></polygon>
            <text class="pp-board-figure" font-size={SIZE * 0.86} fill={railroadInk(railroadId)}
                >{RAILROAD_TAGS[railroadId]}</text
            >
        </g>
    </g>
{/each}
