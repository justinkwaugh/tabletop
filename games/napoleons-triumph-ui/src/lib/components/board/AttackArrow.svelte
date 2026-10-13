<script lang="ts">
    import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
    import { AttackMarkKind, type AttackMark } from '$lib/model/attackMark.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        ATTACK_ARROW_ASIDE,
        ATTACK_ARROW_PATH,
        COUNTER_ARROW_ASIDE,
        COUNTER_ARROW_PATH,
        FEINT_ARROW_FOLD_PATH,
        FEINT_ARROW_PATH,
        attackMarkerAngle
    } from '$lib/utils/attackMarker.js'

    let { mark, scale }: { mark: AttackMark; scale: number } = $props()

    const gameSession = getGameSession()

    const THREAT = { block: '#2b2620', shade: '#14110e' }

    const bar = $derived(APPROACH_GEOMETRY[mark.approach])
    const paint = $derived(
        mark.kind === AttackMarkKind.Threat ? THREAT : gameSession.armyColors(mark.attackerId)
    )
    const countering = $derived(
        mark.counterAttackerId === undefined
            ? undefined
            : gameSession.armyColors(mark.counterAttackerId)
    )
</script>

<g
    transform="translate({bar.centre.x} {bar.centre.y}) scale({scale})"
    class="pointer-events-none"
    data-attack-arrow={mark.kind}
>
    <g
        transform="rotate({attackMarkerAngle(bar)})"
        stroke="#f1ecdc"
        stroke-width="2.5"
        stroke-linejoin="round"
    >
        <g transform={countering ? `translate(0 ${ATTACK_ARROW_ASIDE})` : undefined}>
            {#if mark.kind === AttackMarkKind.Feint}
                <path d={FEINT_ARROW_FOLD_PATH} fill={paint.shade}></path>
                <path d={FEINT_ARROW_PATH} fill={paint.block}></path>
            {:else}
                <path d={ATTACK_ARROW_PATH} fill={paint.block}></path>
            {/if}
        </g>
        {#if countering}
            <path
                d={COUNTER_ARROW_PATH}
                transform="translate(0 {COUNTER_ARROW_ASIDE}) rotate(180)"
                fill={countering.block}
                data-counter-attack-arrow
            ></path>
        {/if}
    </g>
</g>
