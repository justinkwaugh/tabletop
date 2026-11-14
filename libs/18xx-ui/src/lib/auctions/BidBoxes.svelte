<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import type { BidBoxLot } from '../session/bidBoxModule.svelte.js'
    import { currencyAffixes } from '../presentation/money.js'
    import PlayerName from '../table/PlayerName.svelte'

    /** The boxes of one kind of lot, in the order the board prints them, with the stack they fill from. */
    export type BidBoxGroup = {
        id: string
        label: string
        boxIds: readonly string[]
        /** The lots still in the stack, the next to enter a box first. */
        upcoming: readonly string[]
        /**
         * The stack each box fills from, in the order of the boxes, where each has its own, as
         * 1822+ deals its private companies. `upcoming` then holds them all.
         */
        boxStacks?: readonly (readonly string[])[]
        /** Lots of the kind taken out of the game during setup, named under its stack. */
        removed?: readonly string[]
        /**
         * What becomes of the lot in each box, in the order of the boxes, if no one has bid on it
         * when the round ends, as 1822's minor boxes remove trains. Shown while it has no bid.
         */
        unsoldNotes?: readonly (string | undefined)[]
    }

    let {
        session,
        groups,
        lot,
        lotName,
        board = false
    }: {
        session: EighteenXXSessionView
        groups: readonly BidBoxGroup[]
        /** What a lot is, as the title shows it in a box. */
        lot: Snippet<[string]>
        lotName: (lotId: string) => string
        /** Drawn on the board: every box and bid, without the bidder's controls. */
        board?: boolean
    } = $props()
    const money = $derived(session.presentation.money)
    const bidding = $derived(session.bidBoxes)
    const interactive = $derived(!board && bidding.canBid)
    const viewerId = $derived(session.myPlayer?.id)
    const lots = $derived(new Map(bidding.lots.map((entry) => [entry.boxId, entry])))
    let openStack = $state<string>()
    const playerColor = (playerId: string) => session.colors.getPlayerBgColorValue(playerId)

    const currency = $derived(currencyAffixes(money))
    // Typed text that is not a bid the player may prepare; any change to the prepared bids clears it.
    let rejected = $derived.by((): { lotId: string; text: string; reason: string } | undefined => {
        void bidding.drafted
        return undefined
    })

    function step(entry: BidBoxLot, amount: number) {
        if (bidding.canDraft(entry.lotId, amount)) bidding.draft(entry.lotId, amount)
    }
    function type(entry: BidBoxLot, field: HTMLInputElement) {
        const amount = field.valueAsNumber
        const reason = bidding.typedBidReason(entry, amount, money)
        if (reason) rejected = { lotId: entry.lotId, text: field.value, reason }
        else if (amount === entry.drafted) rejected = undefined
        else bidding.draft(entry.lotId, amount)
    }
</script>

{#snippet bidder(playerId: string)}
    <PlayerName
        name={session.getPlayerName(playerId)}
        color={playerColor(playerId)}
        dotSize={8}
        maxWidth="92px"
    />
{/snippet}

<section class="bid-boxes" class:board class:centered-panel={!board} aria-label="Bidding boxes">
    {#each groups as group (group.id)}
        <div class="group">
            <header class="group-heading">
                <h3>{group.label}</h3>
                {#if group.upcoming.length}
                    <button
                        class="stack-toggle"
                        aria-expanded={openStack === group.id}
                        onclick={() => (openStack = openStack === group.id ? undefined : group.id)}
                        >{group.upcoming.length} more in the {group.boxStacks
                            ? 'stacks'
                            : 'stack'}</button
                    >
                {:else}<span class="stack-empty"
                        >{group.boxStacks ? 'stacks empty' : 'stack empty'}</span
                    >{/if}
            </header>
            {#if openStack === group.id && !board}
                {#if group.boxStacks}
                    {#each group.boxStacks as stack, index (index)}
                        <h4 class="stack-box">Box {index + 1}</h4>
                        {#if stack.length}
                            <ol
                                class="stack"
                                aria-label={`${group.label} still to come to box ${index + 1}`}
                            >
                                {#each stack as lotId (lotId)}<li>{lotName(lotId)}</li>{/each}
                            </ol>
                        {:else}<p class="stack-none">Nothing more</p>{/if}
                    {/each}
                {:else}
                    <ol class="stack" aria-label={`${group.label} still to come`}>
                        {#each group.upcoming as lotId (lotId)}<li>{lotName(lotId)}</li>{/each}
                    </ol>
                {/if}
                {#if group.removed?.length}
                    <p class="stack-removed">
                        Not in this game: {group.removed.map(lotName).join('; ')}
                    </p>
                {/if}
            {/if}
            <div class="boxes">
                {#each group.boxIds as boxId, index (boxId)}
                    {@const entry = lots.get(boxId)}
                    <article
                        class="box"
                        class:empty={!entry}
                        class:drafted={entry?.drafted !== undefined}
                        aria-label={entry
                            ? `Box ${index + 1}: ${lotName(entry.lotId)}`
                            : `Box ${index + 1}: empty`}
                    >
                        <span class="box-number" aria-hidden="true">{index + 1}</span>
                        {#if entry}
                            <div class="lot">{@render lot(entry.lotId)}</div>
                            {#if entry.bids.length}
                                <ol class="bids" aria-label="Bids">
                                    {#each entry.bids as bid, place (bid.playerId)}
                                        <li class:leading={place === 0}>
                                            {@render bidder(bid.playerId)}
                                            <strong>{money(bid.amount)}</strong>
                                        </li>
                                    {/each}
                                </ol>
                            {:else}<p class="no-bids">No bids</p>
                                {#if group.unsoldNotes?.[index]}<p class="unsold">
                                        {group.unsoldNotes[index]}
                                    </p>{/if}{/if}
                            {#if interactive}
                                {#if entry.drafted !== undefined}
                                    {@const amount = entry.drafted}
                                    {@const typed =
                                        rejected?.lotId === entry.lotId ? rejected : undefined}
                                    <div class="drafted-bid" role="group" aria-label="Your bid">
                                        <div class="stepper">
                                            <button
                                                aria-label="Lower the bid"
                                                disabled={!bidding.canDraft(
                                                    entry.lotId,
                                                    amount - bidding.increment
                                                )}
                                                onclick={() =>
                                                    step(entry, amount - bidding.increment)}
                                                >−</button
                                            >
                                            <label class="amount"
                                                >{currency.before}<input
                                                    type="number"
                                                    inputmode="numeric"
                                                    aria-label={`Bid on ${lotName(entry.lotId)}`}
                                                    aria-invalid={typed ? 'true' : undefined}
                                                    step={bidding.increment}
                                                    value={typed?.text ?? amount}
                                                    oninput={(event) =>
                                                        type(entry, event.currentTarget)}
                                                />{currency.after}</label
                                            >
                                            <button
                                                aria-label="Raise the bid"
                                                disabled={!bidding.canDraft(
                                                    entry.lotId,
                                                    amount + bidding.increment
                                                )}
                                                onclick={() =>
                                                    step(entry, amount + bidding.increment)}
                                                >+</button
                                            >
                                        </div>
                                        {#if typed}<p class="rejected" role="alert">
                                                {typed.reason}
                                            </p>{/if}
                                        <button
                                            class="action-button place"
                                            disabled={!bidding.canPlace || !!typed}
                                            onclick={() => bidding.place()}>Place bid</button
                                        >
                                    </div>
                                {:else if entry.bids[0]?.playerId === viewerId}
                                    <p class="reason">Your bid leads</p>
                                {:else if entry.lowest === undefined}
                                    <p class="reason">{entry.reason}</p>
                                {:else}
                                    {@const lowest = entry.lowest}
                                    <button
                                        class="start-bid"
                                        onclick={() => bidding.draft(entry.lotId, lowest)}
                                        >Bid {money(lowest)}</button
                                    >
                                {/if}
                            {/if}
                        {:else}<p class="no-bids">Empty</p>{/if}
                    </article>
                {/each}
            </div>
        </div>
    {/each}
    {#if !board && viewerId && bidding.available}
        <footer class="bidder" aria-label="Your bidding">
            <span
                >Tokens <strong>{bidding.tokensFree(viewerId)} of {bidding.tokens(viewerId)}</strong
                > free</span
            >
            <span
                >Reserved <strong>{money(bidding.reserved(viewerId))}</strong> of
                {money(bidding.cash(viewerId))}</span
            >
            {#if interactive}
                <span
                    >Bids this turn <strong>{bidding.bidsThisTurn} of {bidding.bidsPerTurn}</strong
                    ></span
                >
            {/if}
        </footer>
    {/if}
</section>

<style>
    .bid-boxes {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        color: var(--rail-text, #443c34);
        font-size: 12px;
    }
    .group {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .group-heading {
        display: flex;
        align-items: baseline;
        gap: 10px;
    }
    h3 {
        margin: 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--rail-muted, #887664);
    }
    .stack-toggle,
    .stack-empty {
        border: 0;
        padding: 0;
        background: none;
        color: var(--rail-muted, #887664);
        font: inherit;
        font-size: 11px;
    }
    .stack-toggle {
        cursor: pointer;
        text-decoration: underline dotted;
        text-underline-offset: 2px;
    }
    .stack-toggle:hover {
        color: var(--rail-text, #443c34);
    }
    .stack-removed {
        margin: 0;
        color: var(--rail-muted, #887664);
        font-size: 11px;
    }
    .stack-box,
    .stack-none {
        margin: 0;
        color: var(--rail-muted, #887664);
        font-size: 11px;
        font-weight: 600;
    }
    .stack-none {
        padding-left: 22px;
        font-weight: 400;
    }
    .stack {
        margin: 0;
        padding: 0 0 0 22px;
        list-style: decimal;
        columns: 2;
        column-gap: 18px;
        color: var(--rail-text, #443c34);
        font-size: 11px;
    }
    .boxes {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
        gap: 6px;
    }
    .box {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
        padding: 7px 7px 7px 23px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 6px;
        background: var(--rail-surface-raised, #eae1d5);
    }
    .box.empty {
        border-style: dashed;
        background: transparent;
    }
    .box.drafted {
        border-color: var(--rail-focus, #443e35);
    }
    .box-number {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 17px;
        display: grid;
        place-items: center;
        border-right: 1px solid var(--rail-border, #c7b8a6);
        color: var(--rail-muted, #887664);
        font-size: 11px;
        font-weight: 600;
    }
    .lot {
        min-width: 0;
    }
    .bids {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .bids li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        color: var(--rail-muted, #887664);
    }
    .bids strong {
        font-weight: 500;
        font-variant-numeric: tabular-nums;
    }
    .bids li.leading {
        color: var(--rail-text, #443c34);
    }
    .bids li.leading strong {
        font-weight: 700;
    }
    .unsold {
        margin: 0;
        color: var(--rail-text, #443c34);
        font-size: 11px;
    }
    .no-bids,
    .reason {
        margin: 0;
        color: var(--rail-muted, #887664);
        font-size: 11px;
    }
    .box button {
        height: 32px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 5px;
        background: var(--rail-surface, #faf7f1);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .box button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .drafted-bid {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    /* The amount sits between its two halves, so each press has a third of the box to land on. */
    .stepper {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: stretch;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 5px;
        overflow: hidden;
        background: var(--rail-surface, #faf7f1);
    }
    .stepper button {
        height: 34px;
        min-width: 34px;
        padding: 0;
        border: 0;
        border-radius: 0;
        font-size: 18px;
    }
    .stepper button:hover:enabled {
        background: var(--rail-surface-raised, #eae1d5);
    }
    .stepper .amount {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0 2px;
        border-inline: 1px solid var(--rail-border, #c7b8a6);
        font-size: 13px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        cursor: text;
    }
    .stepper input {
        width: 4ch;
        min-width: 0;
        padding: 2px 0;
        border: 0;
        border-bottom: 1px dashed var(--rail-border, #c7b8a6);
        background: transparent;
        color: inherit;
        font: inherit;
        appearance: textfield;
        -moz-appearance: textfield;
    }
    .stepper input::-webkit-inner-spin-button,
    .stepper input::-webkit-outer-spin-button {
        appearance: none;
        margin: 0;
    }
    .stepper input:focus {
        outline: none;
        box-shadow: none;
    }
    .stepper .amount:focus-within {
        outline: 2px solid var(--rail-focus, #443e35);
        outline-offset: -2px;
    }
    .stepper input[aria-invalid='true'] {
        border-bottom-color: var(--rail-negative, #b33a32);
        color: var(--rail-negative, #b33a32);
    }
    .rejected {
        margin: -3px 0 0;
        color: var(--rail-negative, #b33a32);
        font-size: 11px;
    }
    .box .place {
        border-color: transparent;
        font-weight: 600;
        white-space: nowrap;
    }
    .bidder {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 16px;
        padding-top: 8px;
        border-top: 1px solid var(--rail-border, #c7b8a6);
    }
    .bidder strong {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
    .board {
        width: 760px;
        font-size: 13px;
    }
    .board .boxes {
        grid-template-columns: repeat(4, 1fr);
    }
    .board .stack-toggle {
        cursor: default;
        text-decoration: none;
    }
    @media (pointer: coarse) {
        .box button,
        .stepper button {
            height: 40px;
        }
    }
    @media (max-width: 600px) {
        .boxes {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .stack {
            columns: 1;
        }
    }
</style>
