<script lang="ts">
    import { MaximumWarranties, WarrantyCost } from '@tabletop/1862'
    import { TrainTokenPips } from '@tabletop/18xx-ui'
    import type { Session1862 } from './session.svelte.js'
    let { session, trainId }: { session: Session1862; trainId: string } = $props()
    const money = $derived(session.presentation.money)
    const warranties = $derived(session.warranties(trainId))
</script>

<!-- A train bought this turn: the warranties it holds of the three it may, and one more to buy (§7.10). -->
<span class="warranties" role="img" aria-label="{warranties.held} of {MaximumWarranties} warranties"
    ><TrainTokenPips
        count={warranties.held}
        limit={MaximumWarranties}
        lapsing={warranties.lapsing}
    /></span
>
{#if warranties.offered}
    <button
        class="action-button inline-action"
        disabled={!session.canChooseAction}
        onclick={() => session.buyWarranty(trainId)}>+1 warranty {money(WarrantyCost)}</button
    >
{/if}

<style>
    .warranties {
        display: inline-flex;
        font-size: 18px;
    }
    button {
        font: inherit;
        border: 0;
        padding: 3px 8px;
        border-radius: 4px;
    }
</style>
