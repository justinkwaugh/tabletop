<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import PlaceText from '../places/PlaceText.svelte'
    import { selectionLotDetail, selectionLotName } from './auctionLotDetails.js'
    import {
        lotStandingText,
        saleConsequenceText,
        type PyramidLot,
        type SaleConsequence
    } from './lotPyramid.js'

    let {
        session,
        lot,
        consequence
    }: { session: EighteenXXSessionView; lot: PyramidLot; consequence?: SaleConsequence } = $props()
    const money = $derived(session.presentation.money)
    const detail = $derived(selectionLotDetail(session, lot.lotId))
    const standing = $derived(lotStandingText(lot, (id) => session.getPlayerName(id), money))
    const consequenceText = $derived(
        consequence &&
            saleConsequenceText(
                consequence.tierAfter,
                consequence.removedLotIds.map((lotId) => selectionLotName(session, lotId))
            )
    )
</script>

<div class="detail">
    <span class="heading"
        ><strong class="name">{session.lotName(detail)}</strong>
        <span class="value">{money(detail.price)}</span></span
    >
    {#if detail.company.description}<span class="power"
            ><PlaceText text={detail.company.description} /></span
        >{/if}
    <span class="standing">{standing}</span>
    {#if consequenceText}<span class="consequence"
            >{#each consequenceText as segment, index (index)}{#if segment.emphasis}<strong
                        >{segment.text}</strong
                    >{:else}{segment.text}{/if}{/each}</span
        >{/if}
</div>

<style>
    .detail {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-width: 26rem;
        color: var(--rail-text, #514536);
        font-size: 12px;
        line-height: 1.35;
        text-align: start;
    }
    .heading {
        display: block;
    }
    .name {
        font-size: 13px;
    }
    .value,
    .power {
        color: var(--rail-muted, #887969);
    }
    .value {
        font-variant-numeric: tabular-nums;
    }
    .power {
        font-size: 11px;
    }
    .standing {
        font-size: 11px;
    }
</style>
