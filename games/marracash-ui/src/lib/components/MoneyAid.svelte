<script lang="ts">
    import AidCard from '$lib/components/AidCard.svelte'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import {
        auctionBonusRows,
        customerPayoutRows,
        moverBonusRows,
        type AidAmountRow
    } from '$lib/utils/playerAid.js'

    const PayoutRows = customerPayoutRows()
    const DividerClasses = 'border-l border-[#6b4f30]/20'
</script>

{#snippet bonusTable(heading: string, rows: AidAmountRow[])}
    <table class="aid-table">
        <thead><tr><th>{heading}</th><th></th></tr></thead>
        <tbody>
            {#each rows as row (row.label)}
                <tr>
                    <td>{row.label}</td>
                    <td class="aid-gain text-right">+{row.amount}</td>
                </tr>
            {/each}
        </tbody>
    </table>
{/snippet}

<AidCard title="Money">
    <h3 class="aid-heading">Customer payout</h3>
    <div
        class="grid overflow-hidden rounded-md border border-[#6b4f30]/35 text-center"
        style:grid-template-columns="repeat({PayoutRows.length}, 1fr)"
    >
        {#each PayoutRows as row, index (row.label)}
            <div
                class="bg-[#6b4f30]/8 py-[3px] text-[10.5px] whitespace-nowrap text-[#6b4f30] {index >
                0
                    ? DividerClasses
                    : ''}"
            >
                {row.label}
                <PawnIcon height={13} />
            </div>
        {/each}
        {#each PayoutRows as row, index (row.label)}
            <div class="marracash-display py-[3px] {index > 0 ? DividerClasses : ''}">
                {row.amount}
            </div>
        {/each}
    </div>
    <h3 class="aid-heading">Mover's bonus</h3>
    <p class="aid-lead">Per customer you send into another player's shop:</p>
    {@render bonusTable('If owner earns', moverBonusRows())}
    <h3 class="aid-heading">Auction bonus</h3>
    <p class="aid-lead">When another player wins your auction:</p>
    {@render bonusTable('Winning bid', auctionBonusRows())}
</AidCard>
