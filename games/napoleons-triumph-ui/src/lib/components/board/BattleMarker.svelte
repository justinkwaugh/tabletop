<script lang="ts">
    import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
    import { StageKind } from '$lib/model/battleSelection.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        ATTACK_ARROW_PATH,
        attackMarkerAngle,
        attackMarkerScale
    } from '$lib/utils/attackMarker.js'
    import { retreatArrows } from '$lib/utils/retreatArrows.js'

    const gameSession = getGameSession()

    const bar = $derived(
        gameSession.attack ? APPROACH_GEOMETRY[gameSession.attack.attackApproach] : undefined
    )
    const retreats = $derived.by(() => {
        const stage = gameSession.battleStage
        const [, from] = gameSession.battleLocales
        return stage?.kind === StageKind.Retreat && from !== undefined
            ? retreatArrows(from, stage.plan.destinations)
            : []
    })
    const scale = $derived(attackMarkerScale(gameSession.zoom))
</script>

{#if bar}
    <g
        transform="translate({bar.centre.x} {bar.centre.y}) scale({scale})"
        class="pointer-events-none"
    >
        <g transform="rotate({attackMarkerAngle(bar)})">
            <path
                d={ATTACK_ARROW_PATH}
                fill="#7a1418"
                stroke="#f1ecdc"
                stroke-width="2.5"
                stroke-linejoin="round"
            ></path>
        </g>
    </g>
{/if}
{#each retreats as retreat (retreat.locale)}
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
        <circle r="17" fill="#f1ecdc" stroke="#2b2620" stroke-width="2"></circle>
        <text y="6" text-anchor="middle" font-size="18" font-weight="700" fill="#2b2620"
            >{retreat.unitCount}</text
        >
    </g>
{/each}
