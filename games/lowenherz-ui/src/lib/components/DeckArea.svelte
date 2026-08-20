<script lang="ts">
    import ActionCard from './ActionCard.svelte'
    import PoliticsCard from './PoliticsCard.svelte'
    import { ActionCardDeck as actionCardDeck, PoliticsCardDeck } from '@tabletop/lowenherz'
    import actionBack from '$lib/images/action-cards/backs/back-a.jpg'

    const revealedCard = actionCardDeck[0]

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

    <!-- Politics cards: two face-down piles - a player only sees inside one of
         these when they win the Crown and Scepter action. -->
    <div class="flex flex-col items-center gap-2">
        <div class="flex items-center gap-3">
            <div class="w-18">
                <PoliticsCard card={PoliticsCardDeck[0]} faceDown />
            </div>
            <div class="w-18">
                <PoliticsCard card={PoliticsCardDeck[1]} faceDown />
            </div>
        </div>
        <span class="text-2xl" style={labelStyle}>Politics</span>
    </div>
</div>
