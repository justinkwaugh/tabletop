<script lang="ts">
    import { linkOwner, type LinkDefinition } from '@tabletop/texas-special'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { LINK_BOX_SIZE } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const map = $derived(gameSession.gameState.map)

    // Above the settlements, so a short link's arrow is never hidden by the icons at its ends.
    const arrows = $derived(
        map.links
            .filter(
                (trackLink) =>
                    trackLink.oneWayFrom !== undefined &&
                    !linkOwner(gameSession.gameState, trackLink.id)
            )
            .map((trackLink) => ({ id: trackLink.id, transform: arrowTransform(trackLink) }))
    )

    const SETTLEMENT_CLEARANCE = 17

    // Midway between the link's box and the end it is built towards, pointing at that end.
    function arrowTransform(trackLink: LinkDefinition): string {
        const from = trackLink.oneWayFrom ?? trackLink.ends[0]
        const to = map.settlement(map.otherEnd(trackLink, from))
        const dx = to.x - trackLink.box.x
        const dy = to.y - trackLink.box.y
        const length = Math.hypot(dx, dy)
        const along = (LINK_BOX_SIZE / 2 + length - SETTLEMENT_CLEARANCE) / 2
        const x = trackLink.box.x + (dx / length) * along
        const y = trackLink.box.y + (dy / length) * along
        return `translate(${x} ${y}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI})`
    }
</script>

<g class="one-way-layer">
    {#each arrows as arrow (arrow.id)}
        <path d="M-15 -12 L15 0 L-15 12 L-9 0 Z" class="one-way" transform={arrow.transform}>
            <title>One way: built only in the direction of the arrow</title>
        </path>
    {/each}
</g>

<style>
    .one-way {
        fill: #1a1a1a;
        stroke: #fff8e6;
        stroke-width: 2.5;
        stroke-linejoin: round;
        paint-order: stroke;
        filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.55));
    }
</style>
