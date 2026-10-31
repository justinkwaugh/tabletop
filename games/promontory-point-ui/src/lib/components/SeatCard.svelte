<script lang="ts">
    import { RAILROADS, type RailroadId } from '@tabletop/promontory-point'
    import { shareFaceImage } from '$lib/images/cardImages.js'
    import { PreviewKind } from '$lib/model/cardPreview.svelte.js'
    import { STACK_CARDS, type MoneyLine, type SeatView } from '$lib/model/seatView.js'
    import { moneyChipText } from '$lib/animators/moneyChips.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'
    import HandPiece from './HandPiece.svelte'
    import MoneyChange from './MoneyChange.svelte'

    let {
        view,
        large = false,
        moneyLines
    }: { view: SeatView; large?: boolean; moneyLines?: MoneyLine[] } = $props()

    const gameSession = getGameSession()

    const name = $derived(gameSession.getPlayerName(view.playerId))
    const seatColour = $derived(gameSession.colors.getPlayerUiColor(view.playerId))
    const seatNumber = $derived(
        gameSession.gameState.players.findIndex((player) => player.playerId === view.playerId) + 1
    )
    const pieceSize = $derived(large ? 30 : 16)

    // While a transition plays, a hand or share count shows what has landed (Pattern C).
    const hand = $derived(gameSession.flights.hands[view.playerId] ?? view.hand)
    const shares = $derived(
        view.shares.map((share) => {
            const count = gameSession.flights.seatShareCount(view.playerId, share.railroadId)
            return count === undefined ? share : { ...share, count, countLabel: `×${count}` }
        })
    )

    function enlargeShare(railroadId: RailroadId) {
        gameSession.cardPreview.show({ kind: PreviewKind.Share, railroadId })
    }
</script>

<!-- O-10: the stock certificate: a paper card with an engraved double rule in the seat colour. -->
<section
    class="seat"
    class:large
    class:active={view.active}
    class:waiting={view.waitingTurn}
    style:--seat={seatColour}
    aria-label="{name}'s seat"
    data-seat-card={view.playerId}
    data-active={view.active}
>
    <div class="frame" data-seat-frame>
        <header class="top">
            <span class="no" data-seat-number={seatNumber}>No. {seatNumber}</span>
            <span class="who">
                <span class="dot" aria-hidden="true" data-seat-dot></span>
                <button
                    type="button"
                    class="n"
                    aria-expanded={gameSession.openSeat.playerId === view.playerId}
                    aria-label={large ? `Close ${name}'s seat` : `Open ${name}'s seat`}
                    onclick={() => gameSession.openSeat.toggle(view.playerId)}>{name}</button
                >
            </span>
            <!-- R-1.3-H1: money is public. -->
            <span class="m" data-seat-money={view.money}
                >${view.money}{#if !large}<MoneyChange playerId={view.playerId} />{/if}</span
            >
        </header>

        <div class="shares">
            {#each shares as share (share.railroadId)}
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
                        {#each { length: Math.min(Math.max(share.count, 1), STACK_CARDS) }, index (index)}
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

        <footer class="foot" data-seat-foot>
            <span class="hand" data-hand-perspective={hand.perspective} data-piece-size={pieceSize}>
                {#each hand.pieces as piece, index (index)}
                    <HandPiece {piece} size={pieceSize} />
                {/each}
                {#if hand.keptPiece}
                    <span class="kept" title="kept piece, face up">
                        <HandPiece
                            piece={{ faceShown: true, railroadId: hand.keptPiece }}
                            size={pieceSize}
                        />
                    </span>
                {/if}
                <span class="cap">{hand.caption}</span>
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
                                >{moneyChipText(line.change)}</span
                            >
                        </div>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>
    {#if view.tag}
        <span class="tag" data-seat-tag={view.tag}>{view.tag}</span>
    {/if}
</section>

<style>
    .seat {
        --u: 1px;
        position: relative;
        background: var(--pp-paper);
        color: var(--pp-ink);
        border-radius: 4px;
        padding: 5px;
        text-align: left;
        box-shadow: 0 2px 0 color-mix(in srgb, var(--pp-halo) 35%, transparent);
    }

    .seat.large {
        --u: 1.7px;
        padding: 7px;
    }

    .seat.active {
        box-shadow:
            0 0 0 3px var(--pp-accent),
            0 2px 0 color-mix(in srgb, var(--pp-halo) 35%, transparent);
    }

    .seat.waiting {
        outline: 2px dashed var(--pp-decided);
        outline-offset: 3px;
    }

    /* The engraved double rule in the seat colour, over a faint diagonal hatch. */
    .frame {
        border: 2px solid var(--seat);
        outline: 1px solid var(--seat);
        outline-offset: 2px;
        border-radius: 2px;
        padding: calc(6 * var(--u)) calc(9 * var(--u)) calc(6 * var(--u));
        background: repeating-linear-gradient(
            45deg,
            color-mix(in srgb, var(--pp-brown) 5%, transparent) 0 2px,
            transparent 2px 6px
        );
    }

    .top {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: calc(5 * var(--u));
        margin-bottom: calc(5 * var(--u));
        border-bottom: 1px solid color-mix(in srgb, var(--pp-ink) 25%, transparent);
    }

    .no {
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
        font-size: calc(11 * var(--u));
        color: var(--pp-brown);
        white-space: nowrap;
    }

    .who {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .dot {
        flex: none;
        width: calc(11 * var(--u));
        height: calc(11 * var(--u));
        border-radius: 50%;
        background: var(--seat);
        border: 1.5px solid var(--pp-halo);
    }

    .n {
        font-family: Oswald, sans-serif;
        font-weight: 600;
        font-size: calc(18 * var(--u));
        line-height: 1.1;
        letter-spacing: 0.02em;
        text-transform: uppercase;
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

    /* The cash in a dashed coupon. */
    .m {
        margin-left: auto;
        font-family: Oswald, sans-serif;
        font-weight: 600;
        font-size: calc(20 * var(--u));
        line-height: 1;
        padding: calc(3 * var(--u)) calc(8 * var(--u));
        border-radius: 999px;
        border: 1.5px dashed var(--pp-brown);
        background: var(--pp-paper-deep);
        white-space: nowrap;
    }

    .tag {
        position: absolute;
        top: -8px;
        right: 12px;
        font-family: Oswald, sans-serif;
        font-weight: 600;
        font-size: calc(10 * var(--u));
        line-height: 1;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        padding: 3px 7px;
        border-radius: 3px;
        background: var(--pp-accent);
        color: var(--pp-accent-ink);
    }

    .shares {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
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
        margin-top: calc(5 * var(--u));
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
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
        border: 1px dashed var(--pp-brown);
        border-radius: 999px;
    }

    .cap {
        margin-left: 2px;
    }

    .worth {
        white-space: nowrap;
    }

    .money-lines {
        margin-top: calc(8 * var(--u));
        padding-top: calc(6 * var(--u));
        border-top: 1px solid color-mix(in srgb, var(--pp-ink) 25%, transparent);
        font-size: 14px;
    }

    .money-title {
        font-family: Oswald, sans-serif;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: 12px;
        color: var(--pp-brown);
        margin-bottom: 2px;
    }

    .money-line {
        display: flex;
        justify-content: space-between;
        gap: 8px;
    }

    .money-line.muted {
        font-family: 'Libre Caslon Text', serif;
        font-style: italic;
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
