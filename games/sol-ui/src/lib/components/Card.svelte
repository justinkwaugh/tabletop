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
    import { Popover } from 'flowbite-svelte'
    import EffectCard from './EffectCard.svelte'

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
    id="abce"
    class="sol-font-bold flex flex-col justify-end items-center bg-gray-900 w-full h-full border-0 {style ===
    'full'
        ? 'bg-center bg-cover'
        : 'bg-right bg-cover'}"
    style="background-image: {cardImageForSuit(card.suit)}"
>
    <div class=" text-black text-xs uppercase tracking-widest">
        {effectNameForSuit(card.suit)}
    </div>
    <Popover
        defaultClass="p-0 rounded-md overflow-hidden dark:border-0"
        placement="right"
        triggeredBy="#abce"
        trigger="click"
        ><EffectCard effectType={gameSession.gameState.effects[card.suit].type} /></Popover
    >
</div>
