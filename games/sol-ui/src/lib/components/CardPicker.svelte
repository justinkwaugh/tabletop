<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import ExpansionCard from '$lib/images/expansionCard.png'
    import CondensationCard from '$lib/images/condensationCard.png'
    import OscillationCard from '$lib/images/oscillationCard.png'
    import RefractionCard from '$lib/images/refractionCard.png'
    import ReverberationCard from '$lib/images/reverberationCard.png'
    import SolarFlareCard from '$lib/images/solarFlareCard.png'
    import SubductionCard from '$lib/images/subductionCard.png'
    import { Suit } from '@tabletop/sol'
    import Card from './Card.svelte'
    import { card } from 'flowbite-svelte'

    let gameSession = getContext('gameSession') as SolGameSession

    const cardsBySuit = $derived.by(() => {
        const myPlayerState = gameSession.myPlayerState
        if (!myPlayerState || !myPlayerState.drawnCards) {
            return new Map()
        }

        const suits: Map<Suit, number> = new Map()
        for (const card of myPlayerState.drawnCards) {
            if (!suits.has(card.suit)) {
                suits.set(card.suit, 0)
            }
            suits.set(card.suit, suits.get(card.suit)! + 1)
        }
        return suits
    })

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

    async function chooseCard(suit: Suit) {
        await gameSession.chooseCard(suit as Suit)
    }
</script>

<div class="flex flex-row flex-wrap justify-center items-center gap-x-2">
    {#each cardsBySuit as [suit, count] (suit)}
        <div class="flex flex-row justify-center items-center">
            <button
                class="w-[69px] h-[100px] bg-black hover:border-white box-border border-2 border-black rounded-lg overflow-hidden"
                style="z-index: {count};"
                title="{suit} card"
                onclick={() => chooseCard(suit)}><Card {suit} /></button
            >
            {#each { length: count - 1 }, i}
                <div
                    class="w-[20px] h-[100px] bg-black border-t-2 border-e-2 border-b-2 border-black ms-[-5px] overflow-hidden rounded-tr-lg rounded-br-lg bg-right"
                    style="z-index: {count - 1 - i};"
                >
                    <Card {suit} style="partial" />
                </div>
            {/each}
        </div>
    {/each}
</div>
