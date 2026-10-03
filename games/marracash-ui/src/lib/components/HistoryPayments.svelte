<script lang="ts">
    import PlayerTag from '$lib/components/PlayerTag.svelte'
    import PawnIcon from '$lib/components/PawnIcon.svelte'
    import { signedAmount, type Payment } from '$lib/utils/moneyReport.js'
    import { HistoryPawnHeight } from '$lib/utils/pawnShape.js'

    let { payments }: { payments: Payment[] } = $props()

    const PawnHeight = HistoryPawnHeight
</script>

<span class="mt-1 flex flex-col gap-0.5">
    {#each payments as payment, index (index)}
        <span class="flex items-center gap-1.5">
            <PlayerTag playerId={payment.playerId} />
            <span
                class="marracash-display tabular-nums"
                class:text-[#7ed389]={payment.amount > 0}
                class:text-[#f28b82]={payment.amount < 0}>{signedAmount(payment.amount)}</span
            >
            {#if payment.kind === 'customers'}
                <span class="flex items-center">
                    {#each Array.from({ length: payment.count }) as _, pawn (pawn)}
                        <PawnIcon color={payment.color} height={PawnHeight} />
                    {/each}
                </span>
                <span class="sr-only"
                    >{payment.count} customer{payment.count === 1 ? '' : 's'}{payment.walkedIn
                        ? ' walked in'
                        : ''}</span
                >
            {:else if payment.kind === 'moverCut'}
                <span aria-hidden="true">→</span>
                <span class="sr-only">mover's cut to</span>
                <PlayerTag playerId={payment.toPlayerId} />
            {:else if payment.kind === 'auctioneerCut'}
                <span class="opacity-70">cut</span>
            {:else if payment.kind === 'antiqueSet'}
                <span class="sr-only">for the antique set</span>
            {/if}
        </span>
    {/each}
</span>
