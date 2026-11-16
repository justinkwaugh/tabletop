<script lang="ts">
    import type { RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { ActionBlock, ActionPanelView, CardRow, LineRole } from '$lib/model/actionPanel.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import CardChoice from './CardChoice.svelte'
    import CombatTally from './CombatTally.svelte'
    import DawnSheet from './DawnSheet.svelte'
    import FinaliseRow from './FinaliseRow.svelte'
    import GameEndSummary from './GameEndSummary.svelte'
    import GoodCounts from './GoodCounts.svelte'
    import HandSet from './HandSet.svelte'
    import HandSlots from './HandSlots.svelte'
    import NourishPicker from './NourishPicker.svelte'
    import OrderRow from './OrderRow.svelte'
    import PouchChoice from './PouchChoice.svelte'
    import PrimaryButton from './PrimaryButton.svelte'
    import RowChoice from './RowChoice.svelte'
    import SeatChip from './SeatChip.svelte'
    import StagedMoves from './StagedMoves.svelte'
    import TradePickerLayer from '$lib/components/bench/TradePickerLayer.svelte'
    import WritBacks from './WritBacks.svelte'
    import WritChoice from './WritChoice.svelte'
    import WritOffers from './WritOffers.svelte'

    /**
     * The panel's blocks in the order they stand, left aligned, the send right after the step's last
     * choice (Contract, Spacing). The hand
     * stands in one line: the picked card's tray right after it, holding all the card asks (R-3.2),
     * and the at-will chips at the line's end.
     */
    let { view, pointer }: { view: ActionPanelView; pointer: RowPointer } = $props()

    const layout = new PhoneLayout()

    const LineClasses: Record<LineRole, string> = {
        turn: 'text-sm font-semibold text-feudum-text',
        flow: 'text-sm text-feudum-text',
        count: 'text-sm text-feudum-text',
        warning: 'text-xs text-feudum-danger',
        note: 'text-xs text-feudum-text-muted',
        waiting: 'text-sm text-feudum-text-muted',
        previous: 'text-xs text-feudum-text-muted',
        refusal: 'text-xs text-feudum-text-muted'
    }

    function dataOf(role: LineRole) {
        return {
            turn: { 'data-turn-line': '' },
            flow: { 'data-flow-line': '' },
            count: {},
            warning: { 'data-warning': '' },
            note: { 'data-note-line': '' },
            waiting: { 'data-waiting': '' },
            previous: { 'data-previous-seat': '' },
            refusal: { 'data-refusal-line': '' }
        }[role]
    }

    /** Contract, Playing a card: what stands beside the picked card, and at the hand line's end. */
    let main = $derived(view.blocks.filter(({ stands }) => !stands))
    let tray = $derived(view.blocks.filter(({ stands }) => stands === 'tray'))
    let handEnd = $derived(view.blocks.filter(({ stands }) => stands === 'hand-end'))

    /**
     * Contract, Hand selection: tray A. The heading over the eleven; beside them one tray, its labels
     * in one column and its rows in the other: the hand's slots, the pouch, then the send. The
     * at-will chips stand under the eleven.
     */
    type DraftPlace = 'head' | 'count' | 'slots' | 'pouch' | 'send' | 'more'

    function placeOf(block: ActionBlock): DraftPlace {
        if (block.kind === 'finalise') {
            return 'head'
        }
        if (block.kind === 'slots') {
            return 'slots'
        }
        if (block.kind === 'primary' || (block.kind === 'line' && block.role === 'warning')) {
            return 'send'
        }
        if (block.kind === 'line' && block.role === 'count') {
            return 'count'
        }
        return block.kind === 'rows' && block.name === 'pouch' ? 'pouch' : 'more'
    }

    let draftBlocks = $derived(view.blocks.filter(({ stands }) => stands === 'draft'))

    function draftAt(place: DraftPlace): ActionBlock[] {
        return draftBlocks.filter((block) => placeOf(block) === place)
    }

    let draftCount = $derived(
        draftAt('count').find(
            (block): block is Extract<ActionBlock, { kind: 'line' }> => block.kind === 'line'
        )
    )
    let draftPouch = $derived(
        draftAt('pouch').find(
            (block): block is Extract<ActionBlock, { kind: 'rows' }> => block.kind === 'rows'
        )
    )

    /**
     * The sends that stand together from this block on: one pinned group, so two answers stay in
     * sight together on a phone rather than one pinned over the other.
     */
    function sendsFrom(
        list: readonly ActionBlock[],
        index: number
    ): Extract<ActionBlock, { kind: 'primary' }>[] {
        const sends: Extract<ActionBlock, { kind: 'primary' }>[] = []
        for (const block of list.slice(index)) {
            if (block.kind !== 'primary') {
                break
            }
            sends.push(block)
        }
        return sends
    }

    /**
     * R-3.1-H1 The waiting line once the seat's hand is set: beside tray A on a desk and under it on
     * a phone, in the accent.
     */
    const SetWaitingClasses =
        'w-full sm:w-auto sm:min-w-0 sm:flex-1 text-lg font-bold text-feudum-accent max-sm:text-sm'

    function waitsBesideSet(block: ActionBlock, before: ActionBlock | undefined): boolean {
        return block.kind === 'line' && block.role === 'waiting' && before?.kind === 'hand-set'
    }

    /** The draft's eleven stand in rows of six. */
    const DraftColumns = 'repeat(6, minmax(0, 72px))'

    /** The card the tray stands beside: the picked one, or the last while none is picked. */
    function trayAfter(rows: readonly CardRow[]): number {
        const picked = rows.findIndex(({ picked }) => picked)
        return picked >= 0 ? picked : rows.length - 1
    }
</script>

<!-- R-X.1 "Waiting on <chip>.": each seat waited on as its chip, which reads out its name. -->
{#snippet lineText(block: Extract<ActionBlock, { kind: 'line' }>)}
    {#if block.on}
        <span class="inline-flex flex-wrap items-center gap-1" data-waiting-seats
            >Waiting on {#each block.on as seat, index (seat.playerId)}{#if index > 0}<span
                        class="sr-only">{index === block.on.length - 1 ? ' and ' : ', '}</span
                    >{/if}<SeatChip name={seat.name} paint={seat.paint} ring />{/each}.</span
        >
    {:else}
        {block.text}
    {/if}
{/snippet}

{#snippet blockView(block: ActionBlock, index: number, list: readonly ActionBlock[])}
    {#if block.kind === 'finalise'}
        <FinaliseRow entries={block.entries} caption={block.caption} lead={block.lead} />
    {:else if block.kind === 'hand-set'}
        <HandSet {block} />
    {:else if block.kind === 'slots'}
        <HandSlots {block} />
    {:else if block.kind === 'line' && waitsBesideSet(block, list[index - 1])}
        <p class={SetWaitingClasses} {...dataOf(block.role)}>{@render lineText(block)}</p>
    {:else if block.kind === 'line' && block.on}
        <p class="w-full {LineClasses[block.role]}" {...dataOf(block.role)}>
            {@render lineText(block)}
        </p>
    {:else if block.kind === 'line'}
        <p
            class="w-full {LineClasses[block.role]} {block.role === 'count'
                ? 'max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:text-xs'
                : ''}"
            {...dataOf(block.role)}
        >
            {#if block.lead}{`${block.lead} · `}{/if}<span
                data-hand-count={block.role === 'count' ? '' : undefined}>{block.text}</span
            >
        </p>
    {:else if block.kind === 'goods-counts'}
        <GoodCounts counts={block.counts} />
    {:else if block.kind === 'cards' && block.tone === 'hand'}
        {@render handLine(block)}
    {:else if block.kind === 'cards'}
        {@render draftView(block)}
    {:else if block.kind === 'writs'}
        <div class="flex w-full flex-wrap gap-1.5" data-writs>
            {#each block.rows as row (row.writId)}
                <WritChoice {row} {pointer} />
            {/each}
        </div>
    {:else if block.kind === 'writ-offers'}
        <WritOffers offers={block.offers} {pointer} />
    {:else if block.kind === 'backs'}
        <WritBacks count={block.count} />
    {:else if block.kind === 'order-row'}
        <OrderRow step={block.step} entries={block.entries} seats={block.seats} me={block.me} />
    {:else if block.kind === 'dawn-sheet'}
        <DawnSheet sheet={block.sheet} seats={block.seats} />
    {:else if block.kind === 'game-end'}
        <GameEndSummary summary={block.summary} seats={block.seats} />
    {:else if block.kind === 'rows' && block.name === 'pouch'}
        {@const reasons = block.rows.flatMap(({ choice }) =>
            choice.refusal ? [`${choice.shown ?? choice.label} · ${choice.refusal}`] : []
        )}
        <div class="pouch-rows" role="group" aria-label="Pouch" data-rows="pouch">
            <div class="pouch-choices">
                {#each block.rows as row (row.choice.label)}
                    <PouchChoice {row} />
                {/each}
            </div>
            <!-- Contract, Phone layout: the choices drop the line beneath, so the reason stands here. -->
            {#if reasons.length > 0}
                <p
                    class="pouch-reason text-xs text-feudum-danger"
                    aria-hidden="true"
                    data-pouch-reason
                >
                    {reasons.join(' ')}
                </p>
            {/if}
        </div>
    {:else if block.kind === 'rows'}
        <div
            class="flex flex-wrap items-center {block.line ? 'w-full' : ''} {block.rows.every(
                ({ art }) => art?.kind === 'die'
            )
                ? 'gap-4 max-sm:gap-1'
                : 'gap-1'}"
            data-rows={block.name}
        >
            {#if block.heading}
                <span class="text-xs uppercase tracking-wide text-feudum-text-muted"
                    >{block.heading}</span
                >
            {/if}
            {#each block.rows as row (row.choice.label)}
                <RowChoice {row} {pointer} />
            {/each}
        </div>
    {:else if block.kind === 'trade-picker'}
        <!-- Contract, The trade picker: a phone's stands in the bench's sheet instead. -->
        {#if !layout.phone}
            <TradePickerLayer {block} />
        {/if}
    {:else if block.kind === 'staged'}
        <!-- R-4.6 A phone's stands in the bench's sheet, above the send. -->
        {#if !layout.phone}
            <StagedMoves {block} {pointer} />
        {/if}
    {:else if block.kind === 'nourish-picker'}
        <NourishPicker {block} {pointer} />
    {:else if block.kind === 'tally'}
        <CombatTally lines={block.lines} note={block.note} />
    {:else if block.kind === 'primary' && list[index - 1]?.kind !== 'primary'}
        <!-- Contract, Spacing: the sends follow the step's last choice, the group gap after it. -->
        <div
            class="pinned sends flex flex-wrap gap-2 max-sm:min-w-0 max-sm:flex-[1_1_8rem] max-sm:gap-1"
        >
            {#each sendsFrom(list, index) as send, at (at)}
                <PrimaryButton block={send} />
            {/each}
        </div>
    {/if}
{/snippet}

<!--
    The tray's stage line. A desk heads the tray with the card's name; a phone puts the name at the
    line's head and, where the flow has one, says it in its shorter words, so the line stays one.
-->
{#snippet stageLine(block: Extract<ActionBlock, { kind: 'line' }>, card: string)}
    {#if layout.phone}
        <p class="stage-line w-full text-feudum-text" data-tray-line>
            <span class="font-semibold text-feudum-accent">{card}:</span>
            <span data-flow-line>{block.short ?? block.text}</span>
        </p>
    {:else}
        <p class="w-full {LineClasses.flow}" data-flow-line data-tray-line>{block.text}</p>
    {/if}
{/snippet}

<!--
    Contract, Hand selection: tray A. The round's heading, then the eleven in rows of six and, beside
    them, one tray: "Hand" over its count and the slots, "Pouch" and its two choices under them, and
    the send under those, each as wide as the slots. A phone stands it in a bottom sheet over the
    board: the heading, the eleven, then the tray.
-->
{#snippet draftView(block: Extract<ActionBlock, { kind: 'cards' }>)}
    {@const head = draftAt('head')}
    {@const more = draftAt('more')}
    {@const send = draftAt('send')}
    <div class="hand-draft w-full" data-hand-draft>
        {#if head.length > 0}
            <div class="draft-head" data-draft-area="head">
                {#each head as inner, index (index)}
                    {@render blockView(inner, index, head)}
                {/each}
            </div>
        {/if}
        <div
            class="draft-cards grid gap-1.5"
            style:grid-template-columns={DraftColumns}
            data-cards={block.tone}
        >
            {#each block.rows as row (row.kind)}
                <CardChoice {row} paint={block.paint} {pointer} />
            {/each}
        </div>
        {#if more.length > 0}
            <div class="draft-more flex flex-wrap items-center gap-1.5" data-draft-area="more">
                {#each more as inner, index (index)}
                    {@render blockView(inner, index, more)}
                {/each}
            </div>
        {/if}
        <div
            class="hand-tray rounded-lg border border-feudum-frame bg-feudum-surface-raised"
            role="group"
            aria-label="Your hand, pouch and finalise"
            data-hand-tray
        >
            {#each draftAt('slots') as inner, index (index)}
                <p class="tray-label" data-tray-label="hand">
                    {draftCount?.lead ?? 'Hand'}
                    {#if draftCount}<small data-hand-count>{draftCount.text}</small>{/if}
                </p>
                <div class="tray-row" data-tray-row="hand">
                    {@render blockView(inner, index, [inner])}
                </div>
            {/each}
            {#if draftPouch}
                <p class="tray-label" data-tray-label="pouch">
                    {draftPouch.heading ?? 'Pouch'}
                    {#if draftPouch.hint}<small>{draftPouch.hint}</small>{/if}
                </p>
                <div class="tray-row" data-tray-row="pouch">
                    {@render blockView(draftPouch, 0, [draftPouch])}
                </div>
            {/if}
            {#if send.length > 0}
                <div class="tray-row tray-send" data-tray-row="send">
                    {#each send as inner, index (index)}
                        {@render blockView(inner, index, send)}
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/snippet}

<!--
    Contract, The trade picker: one control row heads the tray, the card's choices then Forfeit, the
    group gap between them; any refusal under it; then the picker, left aligned under the row.
-->
{#snippet pickerTray(list: readonly ActionBlock[])}
    {@const controls = list.filter(({ kind }) => kind === 'rows')}
    {@const rest = list.filter(({ kind }) => kind !== 'rows')}
    <div class="flex flex-wrap items-center gap-2 max-sm:gap-1" data-tray-controls>
        {#each controls as inner, index (index)}
            {@render blockView(inner, index, controls)}
        {/each}
    </div>
    {#each rest as inner, index (index)}
        {@render blockView(inner, index, rest)}
    {/each}
{/snippet}

{#snippet handLine(block: Extract<ActionBlock, { kind: 'cards' }>)}
    <div
        class="flex w-full flex-wrap items-start gap-1.5 max-sm:mb-2 max-sm:gap-1"
        data-cards={block.tone}
        data-hand-line
    >
        {#each block.rows as row, at (row.kind)}
            <div class="hand-card" data-lifted={row.picked ? '' : undefined}>
                <CardChoice {row} paint={block.paint} {pointer} />
            </div>
            {#if tray.length > 0 && at === trayAfter(block.rows)}
                {@const holdsPicker = tray.some(({ kind }) => kind === 'trade-picker')}
                <div
                    class:holds-picker={holdsPicker}
                    class="tray flex gap-2 rounded-lg border border-feudum-frame bg-feudum-surface-raised px-3 py-2 max-sm:gap-1 max-sm:px-2
                        {holdsPicker ? 'flex-col' : 'flex-wrap items-center'}"
                    role="group"
                    aria-label="{row.label}: what the card does"
                    style:--at={at}
                    data-card-tray={row.label}
                >
                    {#if !layout.phone && tray.some(({ kind }) => kind === 'line')}
                        <p class="w-full text-sm font-semibold text-feudum-text" data-tray-heading>
                            {row.label}
                        </p>
                    {/if}
                    {#if holdsPicker}
                        {@render pickerTray(tray)}
                    {:else}
                        {#each tray as inner, index (index)}
                            {#if inner.kind === 'line' && inner.role === 'flow'}
                                {@render stageLine(inner, row.label)}
                            {:else}
                                {@render blockView(inner, index, tray)}
                            {/if}
                        {/each}
                    {/if}
                </div>
            {/if}
        {/each}
        {#if handEnd.length > 0}
            <div class="ml-auto flex flex-wrap items-center gap-1" data-hand-end>
                {#each handEnd as inner, index (index)}
                    {@render blockView(inner, index, handEnd)}
                {/each}
            </div>
        {/if}
    </div>
{/snippet}

<div
    class="flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-feudum-text max-sm:gap-1 max-sm:px-1 max-sm:py-1"
    data-action-panel
>
    {#each main as block, index (index)}
        {@render blockView(block, index, main)}
    {/each}
</div>

<style>
    /* Contract, Hand selection: tray A's places on a desk. */
    .hand-draft {
        display: grid;
        /*
         * The eleven, six 72 px faces a row, give way first on a narrow desk; the tray keeps its
         * size. The faces scale to their cell, so the column names its width. The last column takes
         * what is left, so the heading runs the panel's width with the seats at its end.
         */
        grid-template-columns: minmax(0, calc(6 * 72px + 5 * 0.375rem)) max-content minmax(0, 1fr);
        justify-content: start;
        grid-template-areas:
            'head head head'
            'cards tray .'
            'more tray .';
        grid-template-rows: auto auto 1fr;
        column-gap: 1rem;
        row-gap: 0.375rem;
        align-items: start;
    }

    /* The heading spans both columns: it wraps in what they leave, rather than widening the tray's. */
    .draft-head {
        grid-area: head;
        width: 0;
        min-width: 100%;
    }

    .draft-cards {
        grid-area: cards;
    }

    .draft-more {
        grid-area: more;
    }

    /* One grid: the labels' column, then the rows', every edge lined up with the slots. */
    .hand-tray {
        --slot-width: 62px;
        grid-area: tray;
        display: grid;
        grid-template-columns: 62px max-content;
        column-gap: 0.625rem;
        row-gap: 0.5rem;
        align-items: center;
        padding: 0.5rem 0.875rem;
    }

    .tray-label {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 700;
        line-height: 1.15;
        color: var(--feudum-heading);
    }

    .tray-label small {
        display: block;
        font-size: 0.75rem;
        font-weight: 400;
        color: var(--feudum-text-muted);
    }

    /* The rows under the slots take the slots' width rather than widening the column. */
    .tray-row[data-tray-row='pouch'],
    .tray-send {
        width: 0;
        min-width: 100%;
    }

    /* R-3.3 The two choices stack, each as wide as the slots, each saying what it does. */
    .pouch-choices {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
    }

    .pouch-reason {
        display: none;
        margin: 0.1875rem 0 0;
    }

    .tray-send {
        grid-column: 2;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .tray-send > :global(.sends),
    .tray-send :global([data-primary]) {
        width: 100%;
    }

    /*
     * Contract, Desk layout: on a desk the hand's 48 px faces keep card play's row about 120 px tall,
     * so the board has the height; a phone's are 72 px. They give way on a narrow line; the picked
     * one lifts.
     */
    .hand-card {
        flex: 0 1 48px;
        min-width: 0;
        transition: transform 120ms ease-out;
    }

    .hand-card[data-lifted] {
        transform: translateY(-6px);
    }

    /*
     * R-3.2 The tray stands right of the picked card and points at it, as wide as what it holds, up
     * to 36rem; the rest of the hand stands at the line's right end, so no card moves as the tray's
     * contents change from step to step.
     */
    .tray {
        position: relative;
        flex: 0 1 auto;
        max-width: 36rem;
    }

    .tray + .hand-card {
        margin-left: auto;
    }

    /*
     * Contract, The trade picker: the board and its cards take the line's room, so the cards stand in
     * one row; what it holds stays left aligned in it.
     */
    .tray.holds-picker {
        flex: 1 1 44rem;
        max-width: none;
    }

    .tray::before {
        content: '';
        position: absolute;
        left: -9px;
        top: 2rem;
        border: 8px solid transparent;
        border-right-color: var(--feudum-frame);
        border-left: 0;
    }

    @media (prefers-reduced-motion: reduce) {
        .hand-card {
            transition: none;
        }
    }

    /* Contract, Phone layout: the send, and the hand's pouch beside it, stay in sight in the cap. */
    @media (width < 40rem), (max-height: 520px) and (orientation: landscape) {
        .pinned {
            position: sticky;
            bottom: 0;
            background-color: var(--feudum-surface-raised);
        }

        /*
         * Each send takes its own width and the line's spare room: two that fit share a line, and one
         * that would wrap beside the other takes a line of its own, reading on one line there.
         */
        .sends > :global([data-primary]) {
            flex: 1 1 auto;
            width: auto;
        }

        /* The tray takes the line under the hand, pointing up at the picked card. */
        .tray {
            order: 1;
            flex-basis: 100%;
            max-width: none;
            margin-top: 0.5rem;
        }

        .tray + .hand-card {
            margin-left: 0;
        }

        .hand-card {
            flex-basis: 72px;
        }

        /*
         * Contract, Phone layout: the tray fits the cap without scrolling. Its name stands at the
         * line's head in place of a heading, the line in its short words; an unpayable mode says why
         * in its name and tooltip, not beneath it. No hover, so no preview path: a press on a card
         * or a mode is undoable and itself lights the places.
         */
        .tray :global([data-preview]),
        .tray :global([data-reason]) {
            display: none;
        }

        .stage-line {
            font-size: 0.6875rem;
            line-height: 1rem;
        }

        /* Contract, Phone layout: the sheet's hand: the heading, the eleven, then tray A. */
        .hand-draft {
            grid-template-columns: minmax(0, 1fr);
            grid-template-areas:
                'head'
                'cards'
                'more'
                'tray';
            grid-template-rows: none;
            align-content: start;
            row-gap: 0.25rem;
        }

        /* A magnifier's 44 px reaches below its card: the tray stands clear of it. */
        .draft-cards {
            column-gap: 0.25rem;
            row-gap: 0.5rem;
            margin-bottom: 0.5rem;
        }

        .hand-tray {
            --slot-width: 44px;
            grid-template-columns: 48px minmax(0, 1fr);
            column-gap: 0.5rem;
            row-gap: 0.375rem;
            padding: 0.375rem 0.5rem;
        }

        .tray-label {
            font-size: 0.75rem;
        }

        .tray-label small {
            font-size: 0.6875rem;
        }

        .tray-row[data-tray-row='pouch'],
        .tray-send {
            width: auto;
            min-width: 0;
        }

        /* Side by side, without the line beneath: a dimmed one's reason stands under the pair. */
        .pouch-choices {
            flex-direction: row;
        }

        .pouch-choices > :global(*) {
            flex: 1 1 0;
        }

        .pouch-reason {
            display: block;
        }

        .tray-send > :global(.sends) {
            flex: none;
        }

        .tray::before {
            left: calc(var(--at) * (25% - 0.1875rem) + 1.5rem);
            top: -9px;
            border: 8px solid transparent;
            border-bottom-color: var(--feudum-frame);
            border-top: 0;
        }
    }
</style>
