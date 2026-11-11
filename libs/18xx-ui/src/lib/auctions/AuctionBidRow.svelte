<script lang="ts">
    import type { Snippet } from 'svelte'
    import './auctionLotTable.css'
    let {
        columns,
        label,
        control,
        figures
    }: { columns: number; label: string; control?: Snippet; figures?: Snippet } = $props()
</script>

<tr class="bid-row">
    <td colspan={columns}>
        <div class="bid-line" role="group" aria-label={label}>
            {@render control?.()}
            {#if figures}<span class="figures">{@render figures()}</span>{/if}
        </div>
    </td>
</tr>
