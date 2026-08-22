<script lang="ts">
    import { type PoliticsCard, PoliticsCardType } from '@tabletop/lowenherz'
    import allianceImg from '$lib/images/politics-cards/alliance.jpg'
    import renegadeImg from '$lib/images/politics-cards/renegade.jpg'
    import parchmentFrame from '$lib/images/politics-cards/parchment-frame.jpg'
    import treasureFrame from '$lib/images/politics-cards/treasure-frame.jpg'
    import cardBackImg from '$lib/images/politics-cards/card-back.jpg'

    // faceDown shows the shared card back instead of this specific card's face - used
    // for the pile you didn't look through, and other players' hands, which are kept
    // hidden by UI convention (see LowenherzPlayerState.politicsCards' comment on why
    // this isn't enforced server-side).
    let { card, faceDown = false }: { card: PoliticsCard; faceDown?: boolean } = $props()

    const numeralStyle = "font-family:'DejaVu Serif', 'Liberation Serif', Georgia, 'Times New Roman', serif"
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
        <img src={treasureFrame} alt="Treasure" class="w-full h-full object-cover" />
        <div class="absolute inset-x-0 flex items-center justify-center" style="top:78%; height:18%;">
            <!-- The pill takes the card's own background rather than a yellow of its own. #dbcde4
                 is treasure-frame.jpg's measured background, so the pill reads as part of the card
                 instead of a label stuck onto it - and it is filled rather than removed, since the
                 art underneath this band is not guaranteed to be clear.
                 
                 "Ducats" doubles from 3.5cqw to 7cqw, matching the value beside it. Both are in cqw
                 (container-query width), so they scale with the card: the same card is drawn at
                 72px wide in the deck area and 172px in the pile overlay, and a px size would be
                 unreadable at one end or overbearing at the other. -->
            <div class="bg-[#dbcde4] rounded-lg flex items-baseline gap-[2cqw]" style="padding: 1cqw 3cqw;">
                <span class="font-bold text-[7cqw] text-[#1a1a1a]" style={numeralStyle}>{card.value}</span>
                <span class="text-[7cqw] text-[#1a1a1a]" style={numeralStyle}>Ducats</span>
            </div>
        </div>
    {/if}
</div>
