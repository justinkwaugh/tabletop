<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { GameAction } from '@tabletop/common'
    import { QueueEnd, type MarketColor } from '@tabletop/marracash'
    import DirhamAmount from '$lib/components/DirhamAmount.svelte'
    import BidSeals from '$lib/components/BidSeals.svelte'
    import HistorySign from '$lib/components/HistorySign.svelte'
    import PawnGroup from '$lib/components/PawnGroup.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { bidsInTableOrder } from '$lib/utils/auctionBids.js'
    import type { HistoryTurn, TurnLine } from '$lib/utils/historyTurns.js'
    import { shortOrdinal } from '$lib/utils/ordinal.js'

    const PawnHeight = 17
    const HeaderSignHeight = 26
    const SmallSignHeight = 16

    let {
        turn,
        when,
        viewerId,
        replaying = false,
        onReplay
    }: {
        turn: HistoryTurn
        when: string
        viewerId: string | undefined
        replaying?: boolean
        onReplay: () => void
    } = $props()
    const gameSession = getGameSession()

    let moverId = $derived(turn.playerId)

    function isMe(playerId: string): boolean {
        return playerId === viewerId
    }

    function nameOf(playerId: string): string {
        return isMe(playerId) ? 'You' : gameSession.getPlayerName(playerId)
    }

    function possessive(playerId: string): string {
        return isMe(playerId) ? 'your' : `${gameSession.getPlayerName(playerId)}’s`
    }

    // Only a mouse or pen highlights a line; a tap anywhere on the card replays the turn.
    function highlightOnHover(event: PointerEvent, action: GameAction | undefined) {
        if (event.pointerType !== 'touch') gameSession.highlightHistory(action)
    }

    function replayOnKey(event: KeyboardEvent) {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onReplay()
    }
</script>

{#snippet money(amount: number, size: 'large' | 'small')}
    <span
        class="money marracash-merchant {size}"
        class:gain={amount > 0}
        class:loss={amount < 0}
        class:none={amount === 0}
    >
        {#if amount === 0}
            —
        {:else}
            {amount > 0 ? '+' : '−'}<DirhamAmount amount={Math.abs(amount)} />
        {/if}
    </span>
{/snippet}

{#snippet swatch(color: MarketColor)}
    <span
        class="swatch"
        style:background={gameSession.marketPalettes[color].fill}
        style:border-color={gameSession.marketPalettes[color].stroke}
    ></span>
{/snippet}

{#snippet highlighted(action: GameAction, content: Snippet)}
    <div
        role="presentation"
        class="line-group"
        class:lit={gameSession.highlightedHistoryActionId === action.id}
        onpointerenter={(event) => highlightOnHover(event, action)}
        onpointerleave={(event) => highlightOnHover(event, undefined)}
    >
        {@render content()}
    </div>
{/snippet}

<div
    class="turn-card"
    class:in-progress={!turn.ended}
    class:replaying
    role="button"
    tabindex="0"
    aria-label="Replay {possessive(moverId)} turn"
    title="Replay this turn"
    onclick={onReplay}
    onkeydown={replayOnKey}
>
    <header class="head">
        <span class="head-sign"><HistorySign playerId={moverId} height={HeaderSignHeight} /></span>
        <span class="who">
            <span class="name marracash-merchant">{nameOf(moverId)}</span>
            <span class="when">{when}</span>
        </span>
        {@render money(turn.moverNet, 'large')}
    </header>
    <div class="body">
        {#each turn.lines as line (line.action.id)}
            {#if line.kind === 'move'}
                {#snippet move()}
                    <div class="line">
                        Moved <PawnGroup colors={line.colors} height={PawnHeight} />
                    </div>
                    {#each line.visits as visit (visit.shopId)}
                        <div class="sub">
                            <span
                                >{visit.customers} into <b>{possessive(visit.ownerId)}</b>
                                {@render swatch(visit.color)} shop</span
                            >
                            {#if visit.moverIncome > 0}{@render money(
                                    visit.moverIncome,
                                    'small'
                                )}{/if}
                        </div>
                    {/each}
                {/snippet}
                {@render highlighted(line.action, move)}
            {:else if line.kind === 'bring'}
                {#snippet bring()}
                    <div class="line">
                        <PawnGroup colors={line.colors} height={PawnHeight} /> from the
                        <b>{line.end === QueueEnd.Front ? 'front' : 'back'}</b>
                        <span class="whitespace-nowrap">entered <b>{line.gate}</b></span>
                    </div>
                {/snippet}
                {@render highlighted(line.action, bring)}
            {:else if line.kind === 'auction'}
                {#snippet auction()}
                    {#if line.result}
                        {@const result = line.result}
                        <div class="line">
                            {#if result.winnerId === moverId}Won{:else}{nameOf(result.winnerId)} won{/if}
                            the {@render swatch(line.color)}
                            {line.color} shop for {result.price}
                        </div>
                        <div class="bids">
                            {#each bidsInTableOrder(result) as bid (bid.playerId)}
                                <span class="bid">
                                    <HistorySign playerId={bid.playerId} height={SmallSignHeight} />
                                    <span class="marracash-merchant"
                                        >{bid.amount === 0 ? 'Pass' : bid.amount}</span
                                    >
                                </span>
                            {/each}
                        </div>
                        {#if line.walkIns.count > 0}
                            <div class="sub">
                                <span>{line.walkIns.count} walked in</span>
                                {#if result.winnerId === moverId}{@render money(
                                        line.walkIns.income,
                                        'small'
                                    )}{/if}
                            </div>
                        {/if}
                        {#if result.auctioneerCut > 0}
                            <div class="sub">
                                <span>Auctioneer’s cut</span>
                                {@render money(result.auctioneerCut, 'small')}
                            </div>
                        {/if}
                    {:else}
                        <div class="line">
                            Auctioning the {@render swatch(line.color)}
                            {line.color} shop
                        </div>
                        <div class="bids"><BidSeals bidders={line.bidders} /></div>
                    {/if}
                {/snippet}
                {@render highlighted(line.action, auction)}
            {:else if line.kind === 'antiqueSet'}
                <div class="sub flush">
                    <span
                        >{#if line.collectorId === moverId}Completed{:else}{nameOf(
                                line.collectorId
                            )}
                            completed{/if} the {shortOrdinal(line.rank)} antique set</span
                    >
                    {#if line.collectorId === moverId}{@render money(line.payout, 'small')}{/if}
                </div>
            {/if}
        {:else}
            <div class="line quiet">Nothing to do</div>
        {/each}
    </div>
    {#if turn.others.length > 0}
        <footer class="foot">
            {#each turn.others as other (other.playerId)}
                <span class="other">
                    <span class="foot-sign"
                        ><HistorySign playerId={other.playerId} height={SmallSignHeight} /></span
                    >
                    <span class="other-name marracash-merchant">{nameOf(other.playerId)}</span>
                    {@render money(other.amount, 'small')}
                </span>
            {/each}
        </footer>
    {/if}
</div>

<style>
    .turn-card {
        overflow: hidden;
        border-radius: 8px;
        background: #e4ddd0;
        color: #2e2a24;
        box-shadow: 0 2px 0 rgb(0 0 0 / 0.35);
        text-align: left;
        cursor: pointer;
    }

    .turn-card:hover .head,
    .turn-card:focus-visible .head {
        background: #dcd2c0;
    }

    .turn-card:focus-visible {
        outline: 2px solid #c9a24a;
        outline-offset: -2px;
    }

    .turn-card.replaying {
        outline: 2px solid #c9a24a;
        outline-offset: -2px;
    }

    .turn-card.in-progress {
        outline: 1.5px dashed #c9a24a;
        outline-offset: -1.5px;
    }

    .head {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 6px 9px 5px;
        background: #d4cab8;
        border-bottom: 1px solid #bfb39d;
    }

    .head-sign {
        display: flex;
        position: relative;
        top: -1px;
    }

    .who {
        display: flex;
        flex-direction: column;
        line-height: 1;
    }

    .name {
        font-size: 17px;
        line-height: 16px;
    }

    .when {
        font-size: 11px;
        line-height: 12px;
        color: #6e6252;
    }

    .money {
        margin-left: auto;
        position: relative;
    }

    .money.large {
        font-size: 14px;
        top: 2px;
    }

    .money.small {
        font-size: 12px;
        top: 1px;
    }

    .gain {
        color: #2e6b34;
    }

    .loss {
        color: #9b2c2c;
    }

    .none {
        color: #6e6252;
    }

    .body {
        padding: 2px 9px 7px;
        font-size: 12.5px;
    }

    .line-group {
        border-radius: 4px;
    }

    .line-group.lit {
        background: rgb(255 255 255 / 0.35);
    }

    .line {
        line-height: 23px;
        padding-left: 12px;
        text-indent: -12px;
    }

    .quiet {
        color: #6e6252;
    }

    .sub {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 20px;
        margin-left: 14px;
        font-size: 12px;
        color: #6e6252;
    }

    .sub.flush {
        margin-left: 0;
        font-size: 12.5px;
        color: inherit;
    }

    .sub b {
        font-weight: 700;
    }

    .swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 1.5px solid;
        border-radius: 3px;
        vertical-align: -2px;
    }

    .bids {
        display: flex;
        align-items: center;
        gap: 9px;
        min-height: 26px;
        font-size: 12px;
    }

    .bid {
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }

    .foot {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 5px 10px;
        background: #dcd3c3;
        border-top: 1px solid #bfb39d;
        font-size: 12px;
        color: #6e6252;
    }

    .other {
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }

    .foot-sign {
        display: flex;
        position: relative;
        top: -1px;
    }

    .other-name {
        position: relative;
        top: 1.25px;
        margin: 0 2px 0 1px;
        font-size: 13px;
    }

    .foot .money.small {
        margin-left: 0;
        top: 1.5px;
    }
</style>
