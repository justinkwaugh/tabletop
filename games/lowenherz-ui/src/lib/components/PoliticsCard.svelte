<script lang="ts">
    import { type PoliticsCard, PoliticsCardType } from '@tabletop/lowenherz'
    import allianceImg from '$lib/images/politics-cards/alliance.jpg'
    import renegadeImg from '$lib/images/politics-cards/renegade.jpg'
    import parchmentFrame from '$lib/images/politics-cards/parchment-frame.jpg'
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

    const numeralStyle = "font-family:'DejaVu Serif', 'Liberation Serif', Georgia, 'Times New Roman', serif"

    // One image per Treasure value, since each card's number is printed on its own art. Keyed by
    // the value the engine deals - politicsCards.ts types it 8 | 10 | 12 | 15 - so a value with no
    // art draws nothing rather than the wrong card. Louder than a silent fallback, and unreachable
    // unless the deck gains a new value.
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
        <img src={parchmentFrame} alt="Parchment" class="w-full h-full object-cover" />
        <div class="absolute inset-x-0 flex items-center justify-center gap-[2cqw]" style="top:73%; height:25%;">
            <span class="font-bold text-[9cqw] text-[#1a1a1a]" style={numeralStyle}>{card.value}</span>
            <span class="text-[4.5cqw] text-[#1a1a1a]" style={numeralStyle}>Power points</span>
        </div>
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
