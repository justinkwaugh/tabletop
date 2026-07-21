<script lang="ts">
    import PoliticsCard from '$lib/components/PoliticsCard.svelte'
    import { PoliticsCardDeck } from '@tabletop/lowenherz'
</script>

<div class="p-6 bg-stone-900 min-h-screen">
    <h1 class="text-stone-200 text-xl mb-4">Politics card deck ({PoliticsCardDeck.length} cards)</h1>
    <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
        {#each PoliticsCardDeck as card (card.id)}
            <div class="min-w-0">
                <PoliticsCard {card} />
            </div>
        {/each}
    </div>
</div>
