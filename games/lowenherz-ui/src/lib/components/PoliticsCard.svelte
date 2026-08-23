<script lang="ts">
    import { type PoliticsCard, PoliticsCardType } from '@tabletop/lowenherz'
    import allianceImg from '$lib/images/politics-cards/alliance.jpg'
    import renegadeImg from '$lib/images/politics-cards/renegade.jpg'
    import parchment3 from '$lib/images/politics-cards/parchment-3.jpg'
    import parchment4 from '$lib/images/politics-cards/parchment-4.jpg'
    import parchment5 from '$lib/images/politics-cards/parchment-5.jpg'
    import treasure8 from '$lib/images/politics-cards/treasure-8.jpg'
    import treasure10 from '$lib/images/politics-cards/treasure-10.jpg'
    import treasure12 from '$lib/images/politics-cards/treasure-12.jpg'
    import treasure15 from '$lib/images/politics-cards/treasure-15.jpg'
    import cardBackImg from '$lib/images/politics-cards/card-back.jpg'

    // faceDown shows the shared card back instead of this specific card's face - used
    // for the pile you didn't look through, and other players' hands, which are kept
    // hidden by UI convention (see LowenherzPlayerState.politicsCards' comment on why
    // this isn't enforced server-side).
    let { card, faceDown = false }: { card: PoliticsCard; faceDown?: boolean } = $props()

    // One image per value, since every card's number is printed on its own art. Keyed by the value
    // the engine deals - politicsCards.ts types them 3 | 4 | 5 and 8 | 10 | 12 | 15 - so a value
    // with no art draws nothing rather than the wrong card. Louder than a silent fallback, and
    // unreachable unless a deck gains a new value.
    const parchmentImages: Record<number, string> = {
        3: parchment3,
        4: parchment4,
        5: parchment5
    }

    const treasureImages: Record<number, string> = {
        8: treasure8,
        10: treasure10,
        12: treasure12,
        15: treasure15
    }
</script>

<div
    class="@container aspect-[534/832] w-full rounded-md overflow-hidden border border-black/20 shadow-md bg-white relative"
>
    {#if faceDown}
        <img src={cardBackImg} alt="Politics card" class="w-full h-full object-cover" />
    {:else if card.type === PoliticsCardType.Alliance}
        <img src={allianceImg} alt="Alliance" class="w-full h-full object-cover" />
    {:else if card.type === PoliticsCardType.Renegade}
        <img src={renegadeImg} alt="Renegade" class="w-full h-full object-cover" />
    {:else if card.type === PoliticsCardType.Parchment}
        <!-- As with Treasure: the value is printed on the art, one image per card, so nothing is
             drawn over it. -->
        {#if card.value !== undefined && parchmentImages[card.value]}
            <img
                src={parchmentImages[card.value]}
                alt="Parchment worth {card.value} power points"
                class="w-full h-full object-cover"
            />
        {/if}
    {:else if card.type === PoliticsCardType.Treasure}
        <!-- No value drawn over this one: it is printed on the art, one image per card. The CSS
             pill that used to carry the number and its unit label went with it. -->
        {#if card.value !== undefined && treasureImages[card.value]}
            <img
                src={treasureImages[card.value]}
                alt="Treasure worth {card.value} ducats"
                class="w-full h-full object-cover"
            />
        {/if}
    {/if}
</div>
