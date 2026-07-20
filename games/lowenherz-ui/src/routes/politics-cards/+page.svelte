<script lang="ts">
    import PoliticsCard from '$lib/components/PoliticsCard.svelte'
    import { politicsCardDeck } from '$lib/data/politicsCards.js'
</script>

<div class="p-6 bg-stone-900 min-h-screen">
    <h1 class="text-stone-200 text-xl mb-4">Politics card deck ({politicsCardDeck.length} cards)</h1>
    <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
        {#each politicsCardDeck as card (card.id)}
            <div class="min-w-0">
                <PoliticsCard {card} />
            </div>
        {/each}
    </div>
</div>
