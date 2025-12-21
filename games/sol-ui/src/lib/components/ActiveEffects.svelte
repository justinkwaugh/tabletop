<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import type { Point } from '@tabletop/common'
    import EffectCardSvg from './EffectCardSvg.svelte'
    import {
        ActiveEffectsAnimator,
        animateDeck,
        animateEffectCard
    } from '$lib/animators/activeEffectsAnimator.js'

    let {
        width = 35,
        height = 50,
        location = { x: 0, y: 0 }
    }: {
        width?: number
        height?: number
        location?: Point
    } = $props()

    let gameSession = getContext('gameSession') as SolGameSession

    let effects = $derived(
        Object.values(gameSession.gameState.effects).map((effect) => effect.type)
    )

    const animator = new ActiveEffectsAnimator()

    function handleCardClick(event: MouseEvent) {
        event.stopPropagation()
        animator.toggle()
    }
</script>

<g
    use:animateDeck={{ animator, location }}
    class="stroke-[#5a5141] hover:stroke-[#ffffff]"
    transform={`translate(${location.x}, ${location.y})`}
>
    {#each effects as effect, index (effect)}
        <g
            use:animateEffectCard={{ animator, effect }}
            onclick={handleCardClick}
            transform={`translate(${effects.length - index * 3}, ${effects.length - index * 3})`}
        >
            <EffectCardSvg effectType={effect} {width} {height} />
        </g>
    {/each}
</g>
