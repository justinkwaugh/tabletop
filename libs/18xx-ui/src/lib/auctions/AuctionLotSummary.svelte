<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import PlaceText from '../places/PlaceText.svelte'
    import type { PrivateLotDetail } from './auctionLotDetails.js'

    let { session, lot }: { session: EighteenXXSessionView; lot: PrivateLotDetail } = $props()
</script>

<div class="summary">
    <span>Auction <strong>{session.lotName(lot)}</strong></span>
    {#if lot.company.description}<span class="power"
            ><PlaceText text={lot.company.description} /></span
        >{/if}
</div>

<style>
    .summary {
        display: flex;
        flex-direction: column;
        align-items: inherit;
        gap: 2px;
        color: var(--rail-text, #786550);
        font-size: 12px;
        line-height: 1.3;
    }
    .power {
        font-size: 11px;
        line-height: 1.35;
        color: var(--rail-muted, #887969);
    }
</style>
