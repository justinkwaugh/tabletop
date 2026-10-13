<script lang="ts">
    import { StageKind } from '$lib/model/battleSelection.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { attackMarkerScale } from '$lib/utils/attackMarker.js'
    import { retreatArrows } from '$lib/utils/retreatArrows.js'
    import AttackArrow from './AttackArrow.svelte'

    const gameSession = getGameSession()

    const attack = $derived(gameSession.attack)
    const retreats = $derived.by(() => {
        const stage = gameSession.battleStage
        const [, from] = gameSession.battleLocales
        return stage?.kind === StageKind.Retreat && from !== undefined
            ? retreatArrows(from, stage.plan.destinations)
            : []
    })
    const scale = $derived(attackMarkerScale(gameSession.zoom))
</script>

{#if attack}
    <AttackArrow approach={attack.attackApproach} {scale} feint={attack.feint === true} />
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
