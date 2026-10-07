<script lang="ts">
    import AidCard from '$lib/components/AidCard.svelte'
    import AidLadder from '$lib/components/AidLadder.svelte'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import {
        auctionBonusRows,
        customerPayoutRows,
        moverBonusRows,
        type AidAmountRow
    } from '$lib/utils/playerAid.js'

    const PayoutRungs = customerPayoutRows().map((row) => ({
        label: row.label,
        value: String(row.amount)
    }))
</script>

{#snippet bonusTable(heading: string, rows: AidAmountRow[])}
    <table class="aid-table full-width">
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
    <AidLadder rungs={PayoutRungs}>
        {#snippet label()}<PawnIcon height={13} />{/snippet}
    </AidLadder>
    <h3 class="aid-heading">Mover's bonus</h3>
    <p class="aid-lead">Per customer you send to a rival:</p>
    {@render bonusTable('If owner earns', moverBonusRows())}
    <h3 class="aid-heading">Auction bonus</h3>
    <p class="aid-lead">When a rival wins your auction:</p>
    {@render bonusTable('Winning bid', auctionBonusRows())}
</AidCard>
