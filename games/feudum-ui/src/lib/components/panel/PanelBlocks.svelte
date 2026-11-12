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
    import HandSlots from './HandSlots.svelte'
    import NourishPicker from './NourishPicker.svelte'
    import OrderRow from './OrderRow.svelte'
    import PouchChoice from './PouchChoice.svelte'
    import PrimaryButton from './PrimaryButton.svelte'
    import RowChoice from './RowChoice.svelte'
    import TradePickerLayer from '$lib/components/bench/TradePickerLayer.svelte'
    import WritBacks from './WritBacks.svelte'
    import WritChoice from './WritChoice.svelte'
    import WritOffers from './WritOffers.svelte'

    /**
     * The panel's blocks in the order they stand; left aligned, with the send on the right. The hand
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
     * Contract, Hand selection: what stands beside the eleven of a hand draft, each in its place. The
     * finalise row heads it; the hand's count, then its slots with the send beside them, then the
     * pouch; the at-will chips at the count's end.
     */
    type DraftArea = 'order' | 'count' | 'slots' | 'send' | 'pouch' | 'more'
    const DraftAreas: readonly DraftArea[] = ['order', 'count', 'more', 'slots', 'send', 'pouch']

    function areaOf(block: ActionBlock): DraftArea {
        if (block.kind === 'finalise') {
            return 'order'
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

    let draftAreas = $derived(
        DraftAreas.map((area) => ({
            area,
            blocks: view.blocks.filter(
                (block) => block.stands === 'draft' && areaOf(block) === area
            )
        })).filter(({ blocks }) => blocks.length > 0)
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

    /** The draft's eleven stand in rows of six. */
    const DraftColumns = 'repeat(6, minmax(0, 72px))'

    /** The card the tray stands beside: the picked one, or the last while none is picked. */
    function trayAfter(rows: readonly CardRow[]): number {
        const picked = rows.findIndex(({ picked }) => picked)
        return picked >= 0 ? picked : rows.length - 1
    }
</script>

{#snippet blockView(block: ActionBlock, index: number, list: readonly ActionBlock[])}
    {#if block.kind === 'finalise'}
        <FinaliseRow entries={block.entries} caption={block.caption} lead={block.lead} />
    {:else if block.kind === 'slots'}
        <HandSlots {block} />
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
        <div
            class="flex flex-wrap items-start gap-1"
            role="group"
            aria-label="Pouch"
            data-rows="pouch"
        >
            {#each block.rows as row (row.choice.label)}
                <PouchChoice {row} />
            {/each}
        </div>
    {:else if block.kind === 'rows'}
        <div
            class="flex flex-wrap items-center {block.rows.every(({ art }) => art?.kind === 'die')
                ? 'gap-4 max-sm:gap-1'
                : 'gap-1'} {block.name === 'pouch' ? 'pinned max-sm:[&_.beside-art]:sr-only' : ''}"
            data-rows={block.name}
        >
            {#if block.heading}
                <span
                    class="text-xs uppercase tracking-wide text-feudum-text-muted {block.name ===
                    'pouch'
                        ? 'max-sm:sr-only'
                        : ''}">{block.heading}</span
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
    {:else if block.kind === 'nourish-picker'}
        <NourishPicker {block} {pointer} />
    {:else if block.kind === 'tally'}
        <CombatTally lines={block.lines} note={block.note} />
    {:else if block.kind === 'primary' && list[index - 1]?.kind !== 'primary'}
        <div
            class="pinned sends flex flex-wrap gap-2 max-sm:min-w-0 max-sm:flex-[1_1_8rem] max-sm:gap-1
                {block.stands === 'tray' ? '' : 'ml-auto justify-end'}"
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
    Contract, Hand selection: the eleven in rows of six, and beside them the finalise row, the hand's
    count, the plan's slots with the send beside them, and the pouch. A phone stands it in a bottom
    sheet over the board: the count and the order, the slots, the eleven, then the pouch and the send.
-->
{#snippet draftView(block: Extract<ActionBlock, { kind: 'cards' }>)}
    <div class="hand-draft w-full" data-hand-draft>
        <div
            class="draft-cards grid gap-1.5"
            style:grid-template-columns={DraftColumns}
            data-cards={block.tone}
        >
            {#each block.rows as row (row.kind)}
                <CardChoice {row} paint={block.paint} {pointer} />
            {/each}
        </div>
        {#each draftAreas as { area, blocks } (area)}
            <div class="draft-{area} flex flex-wrap items-center gap-1.5" data-draft-area={area}>
                {#each blocks as inner, index (index)}
                    {@render blockView(inner, index, blocks)}
                {/each}
            </div>
        {/each}
    </div>
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
                <div
                    class:holds-picker={tray.some(({ kind }) => kind === 'trade-picker')}
                    class="tray flex flex-wrap items-center gap-2 rounded-lg border border-feudum-frame bg-feudum-surface-raised px-3 py-2 max-sm:gap-1 max-sm:px-2"
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
                    {#each tray as inner, index (index)}
                        {#if inner.kind === 'line' && inner.role === 'flow'}
                            {@render stageLine(inner, row.label)}
                        {:else}
                            {@render blockView(inner, index, tray)}
                        {/if}
                    {/each}
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
    /* Contract, Hand selection: the draft's places on a desk. */
    .hand-draft {
        display: grid;
        /*
         * The eleven, six 72 px faces a row, give way first on a narrow desk; the plan and the send
         * keep their size. The faces scale to their cell, so the column names its width.
         */
        grid-template-columns: minmax(0, calc(6 * 72px + 5 * 0.375rem)) max-content max-content;
        justify-content: start;
        grid-template-areas:
            'order order order'
            'cards count more'
            'cards slots send'
            'cards pouch pouch';
        grid-template-rows: auto auto auto 1fr;
        column-gap: 1rem;
        row-gap: 0.375rem;
        align-items: start;
    }

    .draft-cards {
        grid-area: cards;
    }

    .draft-order {
        grid-area: order;
    }

    .draft-count {
        grid-area: count;
        align-self: end;
    }

    .draft-more {
        grid-area: more;
        justify-content: flex-end;
    }

    .draft-slots {
        grid-area: slots;
    }

    .draft-send {
        grid-area: send;
        align-self: center;
        flex-direction: column;
        align-items: flex-start;
    }

    .draft-pouch {
        grid-area: pouch;
    }

    /* The lines that span columns wrap in what the others leave, rather than widening them. */
    .draft-order,
    .draft-pouch {
        width: 0;
        min-width: 100%;
    }

    /* The hand's 72 px faces, which give way on a narrow line; the picked one lifts. */
    .hand-card {
        flex: 0 1 72px;
        min-width: 0;
        transition: transform 120ms ease-out;
    }

    .hand-card[data-lifted] {
        transform: translateY(-6px);
    }

    /* R-3.2 The tray stands right of the picked card and points at it. */
    .tray {
        position: relative;
        flex: 0 1 36rem;
        min-width: 14rem;
    }

    /* Contract, The trade picker: the board and its cards take the line's room. */
    .tray.holds-picker {
        flex: 1 1 44rem;
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
            margin-top: 0.5rem;
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

        /* Contract, Phone layout: the sheet's hand: count and order, slots, the eleven, pouch and send. */
        .hand-draft {
            grid-template-columns: max-content max-content minmax(0, 1fr);
            grid-template-areas:
                'count order order'
                'slots slots slots'
                'cards cards cards'
                'pouch more send';
            grid-template-rows: none;
            align-content: start;
            column-gap: 0.25rem;
            row-gap: 0.25rem;
        }

        /* A magnifier's 44 px reaches below its card: the rows, and the pouch, stand clear of it. */
        .draft-cards {
            column-gap: 0.25rem;
            row-gap: 0.5rem;
            margin-bottom: 0.5rem;
        }

        .draft-order {
            justify-content: flex-end;
        }

        /* Here the pouch has its column, which it sets. */
        .draft-pouch {
            width: auto;
            min-width: 0;
        }

        /* The sends' line basis is a width; in the draft's column it would be the send's height. */
        .draft-send {
            align-items: stretch;
        }

        .draft-send > .sends {
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
