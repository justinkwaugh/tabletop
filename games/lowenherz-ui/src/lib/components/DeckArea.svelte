<script lang="ts">
    import ActionCard from './ActionCard.svelte'
    import PoliticsCard from './PoliticsCard.svelte'
    import { ActionCardDeck as actionCardDeck } from '@tabletop/lowenherz'
    import { politicsCardDeck, dealPoliticsPiles } from '$lib/data/politicsCards.js'
    import actionBack from '$lib/images/action-cards/backs/back-a.jpg'

    const revealedCard = actionCardDeck[0]
    const [politicsPileA, politicsPileB] = dealPoliticsPiles(politicsCardDeck)

    const labelStyle = "font-family: 'Blankenburg', serif; color: #2b1a0a;"
</script>

<div class="w-full flex justify-end gap-10 py-4">
    <!-- Action cards: draw pile -> reveal pile -->
    <div class="flex flex-col items-center gap-2">
        <div class="flex items-center gap-3">
            <div class="w-18">
                <img src={actionBack} alt="Action draw pile" class="w-full rounded-md shadow-md" />
            </div>
            <div class="w-18">
                <ActionCard card={revealedCard} />
            </div>
        </div>
        <span class="text-2xl" style={labelStyle}>Actions</span>
    </div>

    <!-- Politics cards: two piles, top card flipped face-up -->
    <div class="flex flex-col items-center gap-2">
        <div class="flex items-center gap-3">
            <div class="w-18">
                <PoliticsCard card={politicsPileA[0]} />
            </div>
            <div class="w-18">
                <PoliticsCard card={politicsPileB[0]} />
            </div>
        </div>
        <span class="text-2xl" style={labelStyle}>Politics</span>
    </div>
</div>
