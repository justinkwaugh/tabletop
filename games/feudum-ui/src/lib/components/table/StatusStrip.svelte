<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import { seatPaint } from '$lib/model/seatPaint.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { EpochNumerals } from '$lib/model/turnDraft.svelte.js'

    /**
     * A phone's status strip: epoch and round, and this seat's goods, shillings, barrel and free
     * discs, all from the one derivation of the seat. Someone with no seat sees the epoch and round.
     */
    const gameSession = getGameSession()

    const Token = 15

    let myId = $derived(gameSession.myPlayerId)
    let view = $derived(myId === undefined ? undefined : gameSession.seatPanel(myId))
    let round = $derived(gameSession.gameState.roundManager.currentRound?.number ?? 1)
    let paint = $derived(
        myId === undefined
            ? undefined
            : seatPaint(gameSession.colors, myId, gameSession.getPlayerName(myId))
    )
</script>

<div
    class="flex h-[28px] items-center gap-x-1.5 overflow-hidden whitespace-nowrap border-y border-feudum-divider px-1 text-xs text-feudum-text"
    data-status-strip
>
    <span class="font-semibold" data-status-epoch
        >{EpochNumerals[gameSession.gameState.epoch]}·R{round}</span
    >
    {#if view}
        {#each view.supply.goods as { good, count } (good)}
            <span class="inline-flex items-center" data-status-good={good}>
                <GoodToken {good} size={Token} />{count}
            </span>
        {/each}
        <span class="inline-flex items-center" data-status-shillings>
            <ShillingToken value={1} size={Token} />{view.supply.shillings}
        </span>
        <span class="inline-flex items-center" data-status-barrel>
            <GoodToken good="sulfur" size={Token} />{view.barrel.sulfur}/{view.barrel.capacity}
        </span>
        {#if paint}
            <span class="inline-flex items-center" data-status-discs>
                <SeatToken kind="disc" {paint} size={Token} />{view.supply.freeDiscs}
            </span>
        {/if}
    {/if}
</div>
