<script lang="ts">
    import ActionCard from '$lib/components/ActionCard.svelte'
    import { ActionCardDeck as actionCardDeck } from '@tabletop/lowenherz'
</script>

<div class="p-6 bg-stone-900 min-h-screen">
    <h1 class="text-stone-200 text-xl mb-4">Action card deck ({actionCardDeck.length} cards)</h1>
    <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
        {#each actionCardDeck as card (card.id)}
            <div class="min-w-0">
                <ActionCard {card} />
                <div class="text-stone-400 text-xs text-center mt-1">back {card.back}</div>
            </div>
        {/each}
    </div>
</div>
