<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { Card, Suit } from '@tabletop/sol'
    import CardComponent from '$lib/components/Card.svelte'
    import { nanoid } from 'nanoid'

    let gameSession = getContext('gameSession') as SolGameSession

    const cards = $derived.by(() => {
        return Object.keys(gameSession.gameState.effects).map((suit) => {
            return { id: nanoid(), suit: suit as Suit } satisfies Card
        })
    })

    async function chooseCard(suit: Suit) {
        gameSession.pillarGuess = suit
    }
</script>

<div class="flex flex-row flex-wrap justify-center items-center gap-x-2 h-[100px] mb-2">
    {#each cards as card (card.suit)}
        <button
            onclick={() => chooseCard(card.suit)}
            class="hover:border-white box-border border-2 border-black w-[69px] h-[100px] rounded-lg overflow-hidden"
        >
            <CardComponent {card} />
        </button>
    {/each}
</div>
