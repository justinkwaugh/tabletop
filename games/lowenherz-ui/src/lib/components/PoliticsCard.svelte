<script lang="ts">
    import { type PoliticsCard, PoliticsCardType } from '@tabletop/lowenherz'
    import cardBackImg from '$lib/images/politics-cards/card-back.jpg'
    import { politicsCardFaceImage } from '$lib/model/politicsCardImages'

    // faceDown shows the shared card back instead of this specific card's face - used
    // for the pile you didn't look through, and other players' hands, which are kept
    // hidden by UI convention (see LowenherzPlayerState.politicsCards' comment on why
    // this isn't enforced server-side).
    let { card, faceDown = false }: { card: PoliticsCard; faceDown?: boolean } = $props()

    const faceImage = $derived(politicsCardFaceImage(card))
    const faceAlt = $derived.by(() => {
        switch (card.type) {
            case PoliticsCardType.Alliance:
                return 'Alliance'
            case PoliticsCardType.Renegade:
                return 'Renegade'
            case PoliticsCardType.Parchment:
                return `Parchment worth ${card.value} power points`
            case PoliticsCardType.Treasure:
                return `Treasure worth ${card.value} ducats`
            default:
                return ''
        }
    })
</script>

<div
    class="@container aspect-[534/832] w-full rounded-md overflow-hidden border border-black/20 shadow-md bg-white relative"
>
    {#if faceDown}
        <img src={cardBackImg} alt="Politics card" class="w-full h-full object-cover" />
    {:else if faceImage}
        <!-- Parchment/Treasure draw nothing over the art itself - the value is printed on the
             card, one image per value, so a value with no art (see politicsCardFaceImage) shows
             blank rather than the wrong card. -->
        <img src={faceImage} alt={faceAlt} class="w-full h-full object-cover" />
    {/if}
</div>
