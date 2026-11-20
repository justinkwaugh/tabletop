<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import type { Color } from '@tabletop/common'
    import type { HydratedFeudumGameState, KnightRowId } from '@tabletop/feudum'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import PrimaryButton from '$lib/components/panel/PrimaryButton.svelte'
    import StagedMoves from '$lib/components/panel/StagedMoves.svelte'
    import type { ActionBlock } from '$lib/model/actionPanel.js'
    import type { BenchChoice, BenchOffer } from '$lib/model/benchOffer.js'
    import { benchViewOf } from '$lib/model/benchView.js'
    import type { PanelChoice } from '$lib/model/cardFlows.js'
    import { ownerPaint, type SeatPaint } from '$lib/model/seatPaint.js'
    import { BenchFit } from '$lib/model/benchFit.svelte.js'
    import BenchArea from './BenchArea.svelte'
    import BenchGhostPiece from './BenchGhostPiece.svelte'

    /**
     * The guild bench (contract: Guild and Feast, Render ownership): over the board's container,
     * outside the scaled SVG, drawing the guild areas with the board's own component. It reads the
     * bench offer and decides nothing. For a map pick it closes down to its header. Undo closes it,
     * never Escape: it is not one of the layers Escape walks.
     */
    let {
        bench,
        sheet = false,
        primary,
        staged,
        state,
        playerId,
        paintOf,
        colourPaintOf,
        pointer,
        onPress,
        picker
    }: {
        bench: BenchOffer
        /** On a phone: a bottom sheet, its footer in view, and collapsed to a header over the board's foot. */
        sheet?: boolean
        /** The send, when it stands in the footer here. */
        primary?: Extract<ActionBlock, { kind: 'primary' }>
        /** R-4.6 The staged moves, when they stand in the footer here, above the send. */
        staged?: Extract<ActionBlock, { kind: 'staged' }>
        state: HydratedFeudumGameState
        playerId: string
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
        pointer: RowPointer
        onPress: (choice: PanelChoice) => void
        /** Contract, The trade picker: on a phone's sheet, in place of the areas and the footer. */
        picker?: Snippet
    } = $props()

    const TrayToken = 28

    let view = $derived(benchViewOf(bench, state, playerId))

    function rowPaint(row: KnightRowId): SeatPaint | undefined {
        const held = state.guilds.knight.rows[row]
        return held && ownerPaint(held.owner, paintOf, colourPaintOf)
    }

    /** The long side at which every area stands whole above the footer, side by side. */
    const fit = new BenchFit()

    /** Stands where the board's container is, in the page or in the full screen dialog. */
    function overTheBoard(fillsIt: boolean): Attachment<HTMLElement> {
        return (node) => {
            if (fillsIt && sheet) {
                return
            }
            const surface = node.ownerDocument
                .querySelector('[data-board-surface]')
                ?.closest('.scaling-surface')
            if (!surface) {
                return
            }
            const place = () => {
                const { left, top, width, height } = surface.getBoundingClientRect()
                node.style.left = `${left}px`
                node.style.top = `${top}px`
                node.style.width = `${width}px`
                if (sheet) {
                    node.style.top = `${top + height - node.offsetHeight}px`
                }
                if (fillsIt) {
                    node.style.height = `${height}px`
                }
            }
            const observer = new ResizeObserver(place)
            observer.observe(surface)
            // The board moves, not only resizes, when the action panel above it grows or shrinks.
            const panel = node.ownerDocument.querySelector('[data-action-panel]')
            if (panel) {
                observer.observe(panel)
            }
            window.addEventListener('resize', place)
            window.addEventListener('scroll', place, true)
            place()
            return () => {
                observer.disconnect()
                window.removeEventListener('resize', place)
                window.removeEventListener('scroll', place, true)
            }
        }
    }
</script>

{#snippet toggle(choice: BenchChoice)}
    {#if choice.press}
        <PanelRow {choice} {pointer} {onPress} />
    {:else}
        <!-- The logic takes the higher by itself: the toggle shows it, with nothing to set. -->
        <span
            class="rounded-lg border px-3 py-1 text-sm text-feudum-text
                {choice.picked
                ? 'border-feudum-accent bg-feudum-primary'
                : 'border-feudum-frame opacity-50'}"
            data-row={choice.label}
            data-picked={choice.picked ? '' : undefined}>{choice.label}</span
        >
    {/if}
{/snippet}

{#if bench.collapsed}
    <div
        class="fixed z-40 border-b border-feudum-frame bg-feudum-surface-raised px-3 py-1 text-sm font-semibold text-feudum-heading"
        data-bench-header
        {@attach overTheBoard(false)}
    >
        {bench.collapsed}
    </div>
{:else if picker && sheet}
    <div
        class="bench-sheet picker-sheet fixed z-40 overflow-auto bg-feudum-surface-raised p-2 text-feudum-text"
        data-bench-sheet="trade"
    >
        {@render picker()}
    </div>
{:else}
    <div
        class="fixed z-40 flex flex-col bg-feudum-surface-raised text-feudum-text"
        class:bench-sheet={sheet}
        role="group"
        aria-label={bench.title}
        data-bench={bench.title}
        {@attach overTheBoard(true)}
        {@attach fit.attach}
    >
        <div class="px-3 pt-2 text-sm font-semibold text-feudum-heading" data-bench-title>
            {bench.title}
        </div>
        <div
            class="flex min-h-0 grow flex-wrap content-start justify-center gap-3 overflow-auto p-3 max-sm:gap-1 max-sm:px-0.5"
            data-bench-areas
        >
            {#each view.areas as area (area.guild)}
                <BenchArea
                    {area}
                    fit={fit.long}
                    {state}
                    {paintOf}
                    {colourPaintOf}
                    {rowPaint}
                    {pointer}
                    {onPress}
                />
            {/each}
        </div>
        <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-feudum-divider px-3 py-2 text-sm"
            data-bench-footer
        >
            {#if view.tray.length > 0}
                <span class="flex items-center gap-1" data-bench-tray>
                    <span class="text-xs text-feudum-text-muted">To you</span>
                    {#each view.tray as { key, item, at, piece } (key)}
                        <span class="inline-flex opacity-70" data-ghost={item} data-ghost-at={at}>
                            <BenchGhostPiece {piece} size={TrayToken} {rowPaint} />
                        </span>
                    {/each}
                </span>
            {/if}
            {#if bench.result}
                <span class="font-semibold" data-bench-result>{bench.result.line}</span>
                {#if bench.result.moved}
                    <span data-bench-moved>{bench.result.moved}</span>
                {/if}
                {#if bench.result.payment}
                    <span class="text-feudum-danger" data-bench-payment>{bench.result.payment}</span
                    >
                {/if}
                {#if bench.result.split}
                    <span data-bench-split>{bench.result.split}</span>
                {/if}
                {#if bench.result.reeve}
                    <span class="text-feudum-accent" data-bench-reeve>{bench.result.reeve}</span>
                {/if}
            {/if}
            {#if bench.refused}
                <span class="text-feudum-danger" data-bench-refused>{bench.refused}</span>
            {/if}
            {#if bench.count}
                <span class="flex items-center gap-1" data-bench-count-toggle>
                    {#each bench.count as choice (choice.label)}
                        {@render toggle(choice)}
                    {/each}
                </span>
            {/if}
            {#if bench.rows.length > 0}
                <span class="flex items-center gap-1" data-bench-rows>
                    {#each bench.rows as choice (choice.label)}
                        <PanelRow {choice} {pointer} {onPress} />
                    {/each}
                </span>
            {/if}
            {#if staged}
                <StagedMoves block={staged} />
            {/if}
            {#if primary}
                <span class="min-w-0 grow" data-bench-send>
                    <PrimaryButton block={primary} />
                </span>
            {/if}
        </div>
    </div>
{/if}

<style>
    /* Contract, The bench: up to 80 % of the dynamic viewport, and the footer always in view. */
    .bench-sheet {
        left: 0;
        right: 0;
        bottom: 0;
        max-height: 80dvh;
        padding-bottom: env(safe-area-inset-bottom);
        border-radius: 12px 12px 0 0;
        border-top: 1px solid var(--feudum-frame);
    }
</style>
