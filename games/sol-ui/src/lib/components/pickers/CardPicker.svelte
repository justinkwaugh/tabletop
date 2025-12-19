<script lang="ts">
    import { getContext } from 'svelte'
    import type { SolGameSession } from '$lib/model/SolGameSession.svelte'
    import { MachineState, Suit } from '@tabletop/sol'
    import Card from '$lib/components/Card.svelte'
    import { animateCard, type CardPickerAnimator } from '$lib/animators/cardPickerAnimator.js'
    import { Popover } from 'flowbite-svelte'
    import EffectCard from '$lib/components/EffectCard.svelte'

    let gameSession = getContext('gameSession') as SolGameSession

    let {
        animator
    }: {
        animator: CardPickerAnimator
    } = $props()

    const interactable = $derived(gameSession.isMyTurn && gameSession.isChoosingCard)

    const displayableCards = $derived.by(() => {
        let gameSessionCards = gameSession.drawnCards

        if (gameSession.gameState.machineState === MachineState.ChoosingCard) {
            const seenSuits = new Set<Suit>()
            const myPlayerState = gameSession.myPlayerState
            if (myPlayerState && myPlayerState.card) {
                seenSuits.add(myPlayerState.card.suit)
            }
            gameSessionCards = gameSessionCards.filter((card) => {
                if (seenSuits.has(card.suit)) {
                    return false
                }
                seenSuits.add(card.suit)
                return true
            })
        }

        return gameSessionCards
    })

    async function chooseCard(suit: Suit) {
        if (!interactable) {
            return
        }
        await gameSession.chooseCard(suit as Suit)
    }
</script>

<div class="flex flex-row flex-wrap justify-center items-center gap-x-2 h-[100px] mb-2">
    {#each displayableCards as card (card.id)}
        <button
            use:animateCard={{ animator, card }}
            id={card.id}
            data-flip-id={card.id}
            onclick={() => chooseCard(card.suit)}
            class="{interactable
                ? 'hover:border-white'
                : ''} box-border border-2 border-black w-[69px] h-[100px] rounded-lg overflow-hidden"
        >
            <Card {card} />
        </button>
        {#if interactable}
            <Popover
                classes={{ content: 'p-0 rounded-md overflow-hidden dark:border-0' }}
                placement="bottom"
                triggeredBy={`[id='${card.id}']`}
                trigger="hover"
                arrow={false}
                ><EffectCard effectType={gameSession.gameState.effects[card.suit].type} /></Popover
            >
        {/if}
    {/each}
</div>
