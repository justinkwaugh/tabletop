<script lang="ts">
    import ExpansionCard from '$lib/images/expansionCard.png'
    import CondensationCard from '$lib/images/condensationCard.png'
    import OscillationCard from '$lib/images/oscillationCard.png'
    import RefractionCard from '$lib/images/refractionCard.png'
    import ReverberationCard from '$lib/images/reverberationCard.png'
    import SolarFlareCard from '$lib/images/solarFlareCard.png'
    import SubductionCard from '$lib/images/subductionCard.png'
    import { Card, Suit } from '@tabletop/sol'
    import type { HTMLAttributes } from 'svelte/elements'
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte.js'

    let {
        card,
        style = 'full',
        ...htmlProps
    }: {
        card: Card
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

    function effectNameForSuit(suit: Suit) {
        return gameSession.gameState.effects[suit]?.type ?? 'unknown'
    }
</script>

<div
    {...htmlProps}
    id={card.id}
    class="card-container px-2 pb-1 sol-font-bold flex flex-col justify-end items-center bg-gray-900 w-full h-full border-0 {style ===
    'full'
        ? 'bg-center bg-cover'
        : 'bg-right bg-cover'}"
    style="background-image: {cardImageForSuit(card.suit)}"
>
    <div
        class="card-label w-full text-center {card.suit === Suit.Flare
            ? 'text-[#fdfdfd]'
            : 'text-black'} text-xs uppercase tracking-widest"
    >
        {effectNameForSuit(card.suit)}
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
</style>
