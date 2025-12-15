<script lang="ts">
    import ExpansionCard from '$lib/images/expansionCard.png'
    import CondensationCard from '$lib/images/condensationCard.png'
    import OscillationCard from '$lib/images/oscillationCard.png'
    import RefractionCard from '$lib/images/refractionCard.png'
    import ReverberationCard from '$lib/images/reverberationCard.png'
    import SolarFlareCard from '$lib/images/solarFlareCard.png'
    import SubductionCard from '$lib/images/subductionCard.png'
    import { ActionType, Card, EffectType, HydratedActivateEffect, Suit } from '@tabletop/sol'
    import type { HTMLAttributes } from 'svelte/elements'
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'

    let {
        card,
        showActivate,
        style = 'full',
        ...htmlProps
    }: {
        card: Card
        showActivate?: boolean
        style?: 'full' | 'partial'
    } & HTMLAttributes<HTMLDivElement> = $props()

    let gameSession = getContext('gameSession') as SolGameSession

    function cardImageForSuit(suit: Suit) {
        switch (suit) {
            case Suit.Condensation:
                return `url(${CondensationCard})`
            case Suit.Oscillation:
                return `url(${OscillationCard})`
            case Suit.Refraction:
                return `url(${RefractionCard})`
            case Suit.Reverberation:
                return `url(${ReverberationCard})`
            case Suit.Expansion:
                return `url(${ExpansionCard})`
            case Suit.Subduction:
                return `url(${SubductionCard})`
            case Suit.Flare:
                return `url(${SolarFlareCard})`
            default:
                return ''
        }
    }

    function effectForSuit(suit: Suit): EffectType {
        return gameSession.gameState.effects[suit].type
    }

    function onActivate() {
        if (!gameSession.isMyTurn) {
            return
        }

        gameSession.activateEffect(effectForSuit(card.suit))
    }

    function labelSize(name: string): string {
        return name.length > 8 ? `card-label-${name.length}` : ''
    }
</script>

<div
    {...htmlProps}
    id={card.id}
    class="card-container px-2 py-1 sol-font-bold flex flex-col justify-between items-center bg-gray-900 w-full h-full border-0 {style ===
    'full'
        ? 'bg-center bg-cover'
        : 'bg-right bg-cover'}"
    style="background-image: {cardImageForSuit(card.suit)}"
>
    <div>
        {#if showActivate}
            <button
                onclick={onActivate}
                class="rounded-lg bg-black/80 text-[#cccccc] text-xs tracking-widest p-2 hover:border-white border-transparent border-2"
                >ACTIVATE</button
            >
        {/if}
    </div>
    <div
        class="card-label {labelSize(effectForSuit(card.suit))} w-full text-center {card.suit ===
        Suit.Flare
            ? 'text-[#fdfdfd]'
            : 'text-black'} text-xs uppercase tracking-widest"
    >
        {effectForSuit(card.suit)}
    </div>
</div>

<style>
    .card-container {
        container-type: inline-size;
    }

    .card-label {
        font-size: clamp(0.2rem, 15cqi, 2rem);
        line-height: 1.1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .card-label-9 {
        font-size: clamp(0.25rem, 13cqi, 2rem);
    }

    .card-label-10 {
        font-size: clamp(0.25rem, 12cqi, 2rem);
    }

    .card-label-11 {
        font-size: clamp(0.25rem, 11cqi, 2rem);
    }
</style>
