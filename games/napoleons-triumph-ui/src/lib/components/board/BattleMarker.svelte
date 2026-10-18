<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { attackMarkerScale } from '$lib/utils/attackMarker.js'
    import { COUNT_EDGE, COUNT_RADIUS } from '$lib/utils/retreatArrows.js'
    import AttackArrow from './AttackArrow.svelte'

    const gameSession = getGameSession()

    const mark = $derived(gameSession.attackMark)
    const scale = $derived(attackMarkerScale(gameSession.zoom))
</script>

{#if mark}
    <AttackArrow {mark} {scale} />
{/if}
{#each gameSession.retreatArrows as retreat (retreat.locale)}
    <g
        transform="translate({retreat.start.x} {retreat.start.y}) rotate({retreat.angle})"
        class="pointer-events-none"
    >
        <path d={retreat.path} fill="#2b2620" opacity="0.8"></path>
    </g>
    <g
        transform="translate({retreat.end.x} {retreat.end.y}) rotate({-gameSession.boardRotation})"
        class="pointer-events-none"
    >
        <circle r={COUNT_RADIUS} fill="#f1ecdc" stroke="#2b2620" stroke-width={COUNT_EDGE}></circle>
        <text y="6" text-anchor="middle" font-size="18" font-weight="700" fill="#2b2620"
            >{retreat.unitCount}</text
        >
    </g>
{/each}
