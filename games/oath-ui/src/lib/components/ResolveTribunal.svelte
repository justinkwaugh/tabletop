<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { promiseBy } from '$lib/model/tribunalDeals.js'

    // R-7.6.3-H1 — Resolve Tribunal: a row per open deal, the deal on the left (the other party, the
    // round, each promise) and its buttons on the right. "Ask <other>" is hidden for a deal claimed
    // kept this turn; "Leave it unconfirmed" closes the deal for both, asking no one.
    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)
    let rows = $derived(gameSession.tribunalDealRows)
    let seatId = $derived(gameSession.myPlayer?.id)
    // Every button in the panel is the widest label's width, on a phone as on a desktop.
    const width = new ChoiceWidth()

    const BUTTON =
        'flex items-center justify-center rounded-md border border-oath-frame bg-oath-surface px-3 py-1.5 ' +
        'text-[15px] font-semibold hover:border-oath-accent hover:bg-oath-accent-soft disabled:opacity-40 max-sm:min-h-11'
</script>

<div class="flex flex-col gap-1.5" role="list" aria-label="Open deals">
    {#each rows as { deal, otherPlayerId, canAsk } (deal.id)}
        {@const mine = seatId ? promiseBy(deal, seatId) : undefined}
        {@const theirs = promiseBy(deal, otherPlayerId)}
        <div
            role="listitem"
            data-deal={deal.id}
            class="flex w-fit max-w-full items-center gap-x-4 gap-y-2 rounded-md bg-oath-surface-raised px-3 py-2
                   max-sm:flex-col max-sm:items-start"
        >
            <div class="min-w-0 max-w-[420px]">
                <p class="text-[15px] font-bold" data-deal-heading>
                    With <PlayerName playerId={otherPlayerId} />, round {deal.round}
                </p>
                {#if mine}
                    <p
                        class="whitespace-pre-wrap text-[13px] text-oath-text-muted"
                        data-deal-promise
                    >
                        you: {mine}
                    </p>
                {/if}
                {#if theirs}
                    <p
                        class="whitespace-pre-wrap text-[13px] text-oath-text-muted"
                        data-deal-promise
                    >
                        <PlayerName playerId={otherPlayerId} />: {theirs}
                    </p>
                {/if}
            </div>
            <div class="flex flex-col gap-1.5">
                <div class="flex flex-wrap gap-2">
                    {#if canAsk}
                        <button
                            type="button"
                            class={BUTTON}
                            aria-label="Ask {gameSession.getPlayerName(otherPlayerId)}"
                            disabled={busy}
                            onclick={() => gameSession.claimDealKept(deal.id)}
                        >
                            <span class="flex justify-center" style:min-width="{width.widest}px">
                                <span
                                    class="flex w-max items-center gap-1.5"
                                    {@attach width.measure}
                                    >Ask <PlayerName playerId={otherPlayerId} /></span
                                >
                            </span>
                        </button>
                    {/if}
                    <button
                        type="button"
                        class={BUTTON}
                        disabled={busy}
                        onclick={() => gameSession.leaveDealUnconfirmed(deal.id)}
                    >
                        <span class="flex justify-center" style:min-width="{width.widest}px">
                            <span class="flex w-max" {@attach width.measure}
                                >Leave it unconfirmed</span
                            >
                        </span>
                    </button>
                </div>
                <p class="text-xs text-oath-text-muted">
                    Only on your own turn; it closes the deal for both of you.
                </p>
            </div>
        </div>
    {/each}
</div>
