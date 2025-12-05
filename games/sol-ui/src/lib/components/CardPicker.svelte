<script lang="ts">
    import { getContext, onMount } from 'svelte'
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
    import { animateCard, type CardPickerAnimator } from '$lib/animators/cardPickerAnimator.js'
    import { nanoid } from 'nanoid'

    let gameSession = getContext('gameSession') as SolGameSession

    let {
        animator
    }: {
        animator: CardPickerAnimator
    } = $props()

    const interactable = $derived(gameSession.isMyTurn && gameSession.isChoosingCard)

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
        if (!interactable) {
            return
        }
        await gameSession.chooseCard(suit as Suit)
    }
</script>

<div class="flex flex-row flex-wrap justify-center items-center gap-x-2 h-[100px] mb-2">
    {#each gameSession.drawnCards as card (card.id)}
        <button
            use:animateCard={{ animator, card }}
            onclick={() => chooseCard(card.suit)}
            class="{interactable
                ? 'hover:border-white'
                : ''} box-border border-2 border-black w-[69px] h-[100px] rounded-lg overflow-hidden"
        >
            <Card {card} />
        </button>
    {/each}
    <!-- {#each cardsBySuit as [suit, count] (suit)}
        <div class="flex flex-row justify-center items-center">
            <button
                class="w-[69px] h-[100px] bg-black hover:border-white box-border border-2 border-black rounded-lg overflow-hidden"
                style="z-index: {count};"
                title="{suit} card"
                onclick={() => chooseCard(suit)}><Card card={{ id: nanoid(), suit }} /></button
            >
            {#each { length: count - 1 }, i}
                <div
                    class="w-[20px] h-[100px] bg-black border-t-2 border-e-2 border-b-2 border-black ms-[-5px] overflow-hidden rounded-tr-lg rounded-br-lg bg-right"
                    style="z-index: {count - 1 - i};"
                >
                    <Card card={{ id: nanoid(), suit }} style="partial" />
                </div>
            {/each}
        </div>
    {/each} -->
</div>
