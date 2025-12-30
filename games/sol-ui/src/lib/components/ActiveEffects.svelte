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
    import type { Effect, Suit } from '@tabletop/sol'

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

    let effects = $derived(Object.entries(gameSession.gameState.effects) as [Suit, Effect][])
    let isOpen = $state(false)

    const animator = new ActiveEffectsAnimator()

    function handleCardClick(event: MouseEvent) {
        event.stopPropagation()
        animator.toggle()
        if (!isOpen) {
            isOpen = true
            document.addEventListener('click', closeOnClickAnywhere)
            document.addEventListener('keydown', closeOnEscape)
        } else {
            close()
        }
    }

    function close() {
        isOpen = false
        document.removeEventListener('keydown', closeOnEscape)
        document.removeEventListener('click', closeOnClickAnywhere)
    }

    function closeOnEscape(event: KeyboardEvent) {
        if (isOpen && event.key === 'Escape') {
            animator.toggle()
            close()
        }
    }

    function closeOnClickAnywhere(event: MouseEvent) {
        animator.toggle()
        close()
    }
</script>

<g
    use:animateDeck={{ animator, location }}
    class="stroke-[#5a5141] hover:stroke-[#ffffff]"
    transform={`translate(${location.x}, ${location.y})`}
>
    {#each effects as [suit, effect], index (effect)}
        <g
            use:animateEffectCard={{ animator, effect: effect.type }}
            onclick={handleCardClick}
            transform={`translate(${effects.length - index * 3}, ${effects.length - index * 3})`}
        >
            <EffectCardSvg effectType={effect.type} effectSuit={suit} {width} {height} />
        </g>
    {/each}
</g>
