<script lang="ts">
    import { RAILROADS, type RailroadId } from '@tabletop/promontory-point'
    import { shareFaceImage } from '$lib/images/cardImages.js'
    import { PreviewKind } from '$lib/model/cardPreview.svelte.js'
    import type { MoneyLine, SeatView } from '$lib/model/seatView.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'
    import HandPiece from './HandPiece.svelte'

    let {
        view,
        large = false,
        moneyLines
    }: { view: SeatView; large?: boolean; moneyLines?: MoneyLine[] } = $props()

    const gameSession = getGameSession()

    const name = $derived(gameSession.getPlayerName(view.playerId))
    const headerFill = $derived(gameSession.colors.getPlayerUiColor(view.playerId))
    const headerInk = $derived(gameSession.colors.getPlayerTextColorValue(view.playerId))
    const pieceSize = $derived(large ? 30 : 16)

    function enlargeShare(railroadId: RailroadId) {
        gameSession.cardPreview.show({ kind: PreviewKind.Share, railroadId })
    }

    const signed = (change: number) => (change < 0 ? `−$${-change}` : `+$${change}`)
</script>

<!-- O-10: the brokerage ledger, a tan card ruled twice under a header in the seat colour. -->
<section
    class="seat"
    class:large
    class:active={view.active}
    class:waiting={view.waitingTurn}
    aria-label="{name}'s seat"
    data-seat-card={view.playerId}
    data-active={view.active}
>
    <div class="frame">
        <header class="nm" style:background={headerFill} style:color={headerInk}>
            <span class="who">
                <button
                    type="button"
                    class="n"
                    aria-expanded={gameSession.openSeat.playerId === view.playerId}
                    aria-label={large ? `Close ${name}'s seat` : `Open ${name}'s seat`}
                    onclick={() => gameSession.openSeat.toggle(view.playerId)}>{name}</button
                >
                {#if view.tag}
                    <span class="tag" data-seat-tag={view.tag}>{view.tag}</span>
                {/if}
            </span>
            <!-- R-1.3-H1: money is public. -->
            <span class="m" data-seat-money={view.money}>${view.money}</span>
        </header>

        <div class="shares">
            {#each view.shares as share (share.railroadId)}
                <button
                    type="button"
                    class="sh"
                    class:zero={share.count === 0}
                    aria-label="{share.count} {RAILROADS[share.railroadId]
                        .name} shares at ${share.price} each; enlarge the share"
                    data-seat-share={share.railroadId}
                    data-count={share.count}
                    onclick={() => enlargeShare(share.railroadId)}
                >
                    <span class="stack">
                        {#each { length: Math.min(Math.max(share.count, 1), 4) }, index (index)}
                            <img
                                src={shareFaceImage(share.railroadId).src}
                                alt=""
                                style:left="{index * 1.5}px"
                                style:top="{index * 1.5}px"
                            />
                        {/each}
                    </span>
                    <span class="cnt">{share.countLabel}</span>
                    <span class="val"
                        ><span class="sr-only"
                            >{RAILROAD_TAGS[share.railroadId]} ·
                        </span>{share.priceLabel}</span
                    >
                </button>
            {/each}
        </div>

        <footer class="foot">
            <span class="hand" data-hand-perspective={view.hand.perspective}>
                {#each view.hand.pieces as piece, index (index)}
                    <HandPiece {piece} size={pieceSize} />
                {/each}
                {#if view.hand.keptPiece}
                    <span class="kept" title="kept piece, face up">
                        <HandPiece
                            piece={{ faceShown: true, railroadId: view.hand.keptPiece }}
                            size={pieceSize}
                        />
                    </span>
                {/if}
                <span class="cap">{view.hand.caption}</span>
            </span>
            <!-- O-9: the shares' worth at today's prices. -->
            <span class="worth" data-seat-worth={view.worth}>shares worth ${view.worth}</span>
        </footer>

        {#if moneyLines}
            <div class="money-lines">
                <div class="money-title">Money this turn</div>
                {#if moneyLines.length === 0}
                    <div class="money-line muted">No change</div>
                {:else}
                    {#each moneyLines as line (line.key)}
                        <div class="money-line">
                            <span>{line.label}</span>
                            <span class="delta" class:loss={line.change < 0}
                                >{signed(line.change)}</span
                            >
                        </div>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>
</section>

<style>
    .seat {
        --u: 1px;
        background: var(--pp-paper);
        color: var(--pp-ink);
        border-radius: 6px;
        padding: 3px;
        text-align: left;
        box-shadow: 0 1px 0 var(--pp-halo);
    }

    .seat.large {
        --u: 1.7px;
        padding: 5px;
    }

    .seat.active {
        box-shadow:
            0 0 0 2px var(--pp-halo),
            0 0 0 4px var(--pp-accent);
    }

    .seat.waiting {
        outline: 2px dashed var(--pp-decided);
        outline-offset: 2px;
    }

    .frame {
        border: 1.5px solid var(--pp-paper-line);
        outline: 1px solid var(--pp-paper-line);
        outline-offset: -5px;
        border-radius: 4px;
        padding: 0 0 calc(7 * var(--u));
    }

    .nm {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: calc(4 * var(--u)) calc(9 * var(--u));
        border-radius: 3px 3px 0 0;
        border-bottom: 1.5px solid var(--pp-paper-line);
    }

    .who {
        display: flex;
        align-items: center;
        min-width: 0;
    }

    .n {
        font-family: Oswald, sans-serif;
        font-weight: 600;
        font-size: calc(17 * var(--u));
        letter-spacing: 0.03em;
        color: inherit;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-decoration: underline dotted transparent;
    }

    .n:hover,
    .n:focus-visible {
        text-decoration-color: currentColor;
        outline: none;
    }

    .m {
        font-family: Oswald, sans-serif;
        font-weight: 600;
        font-size: calc(22 * var(--u));
        line-height: 1.1;
    }

    .tag {
        font-size: calc(10 * var(--u));
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 1px 6px;
        border-radius: 8px;
        background: var(--pp-veil);
        color: var(--pp-text);
        margin-left: 6px;
    }

    .shares {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        padding: calc(7 * var(--u)) calc(9 * var(--u)) 2px;
    }

    .sh {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1px;
        background: none;
        border: none;
        padding: 0;
        color: inherit;
        cursor: zoom-in;
    }

    .sh:focus-visible {
        outline: 2px solid var(--pp-accent);
        outline-offset: 2px;
    }

    .stack {
        position: relative;
        width: calc(34 * var(--u));
        height: calc(48 * var(--u));
    }

    .stack img {
        position: absolute;
        width: calc(30 * var(--u));
        border-radius: 2px;
        box-shadow: 0 0 0 0.5px var(--pp-paper-line);
    }

    .cnt {
        font-family: Oswald, sans-serif;
        font-weight: 600;
        font-size: calc(15 * var(--u));
        line-height: 1;
    }

    .val {
        font-size: calc(10 * var(--u));
        color: var(--pp-ink-sub);
        line-height: 1.1;
    }

    .sh.zero .stack {
        opacity: 0.35;
    }

    .sh.zero .cnt {
        opacity: 0.55;
    }

    .foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
        padding: 3px calc(9 * var(--u)) 0;
        font-size: calc(11 * var(--u));
        color: var(--pp-ink-sub);
    }

    .hand {
        display: flex;
        align-items: center;
        gap: 3px;
        flex-wrap: wrap;
    }

    .kept {
        display: inline-flex;
        padding: 1px;
        border: 1px dashed var(--pp-paper-line);
        border-radius: 999px;
    }

    .cap {
        font-size: calc(10 * var(--u));
        margin-left: 2px;
    }

    .worth {
        white-space: nowrap;
    }

    .money-lines {
        margin: calc(8 * var(--u)) calc(9 * var(--u)) 0;
        padding-top: calc(6 * var(--u));
        border-top: 1px solid var(--pp-paper-line);
        font-size: 14px;
    }

    .money-title {
        font-family: Oswald, sans-serif;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: 12px;
        color: var(--pp-ink-sub);
        margin-bottom: 2px;
    }

    .money-line {
        display: flex;
        justify-content: space-between;
        gap: 8px;
    }

    .money-line.muted {
        color: var(--pp-ink-sub);
    }

    .delta {
        font-family: Oswald, sans-serif;
        font-weight: 600;
    }

    .delta.loss {
        color: var(--pp-cost);
    }
</style>
