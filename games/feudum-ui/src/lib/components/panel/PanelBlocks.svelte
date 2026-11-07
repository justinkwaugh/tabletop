<script lang="ts">
    import type { RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { ActionBlock, ActionPanelView, LineRole } from '$lib/model/actionPanel.js'
    import CardChoice from './CardChoice.svelte'
    import CombatTally from './CombatTally.svelte'
    import DawnSheet from './DawnSheet.svelte'
    import FinaliseRow from './FinaliseRow.svelte'
    import GameEndSummary from './GameEndSummary.svelte'
    import GoodCounts from './GoodCounts.svelte'
    import OrderRow from './OrderRow.svelte'
    import RowChoice from './RowChoice.svelte'
    import WritBacks from './WritBacks.svelte'
    import WritChoice from './WritChoice.svelte'
    import WritOffers from './WritOffers.svelte'

    /** The panel's blocks in the order they stand; left aligned, with the send on the right. */
    let { view, pointer }: { view: ActionPanelView; pointer: RowPointer } = $props()

    const LineClasses: Record<LineRole, string> = {
        turn: 'text-sm font-semibold text-feudum-text',
        flow: 'text-sm text-feudum-text',
        count: 'text-sm text-feudum-text',
        warning: 'text-xs text-feudum-danger',
        note: 'text-xs text-feudum-text-muted',
        waiting: 'text-sm text-feudum-text-muted',
        refusal: 'text-xs text-feudum-text-muted',
        round: 'text-sm font-semibold text-feudum-text'
    }

    function dataOf(role: LineRole) {
        return {
            turn: { 'data-turn-line': '' },
            flow: { 'data-flow-line': '' },
            count: {},
            warning: { 'data-warning': '' },
            note: { 'data-note-line': '' },
            waiting: { 'data-waiting': '' },
            refusal: { 'data-refusal-line': '' },
            round: { 'data-round-line': '' }
        }[role]
    }

    function columns(block: Extract<ActionBlock, { kind: 'cards' }>): string {
        const { count, width } =
            block.tone === 'draft'
                ? { count: 6, width: 88 }
                : { count: Math.max(block.rows.length, 1), width: 72 }
        return `repeat(${count}, minmax(0, ${width}px))`
    }
</script>

<div class="flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-feudum-text" data-action-panel>
    {#each view.blocks as block, index (index)}
        {#if block.kind === 'finalise'}
            <FinaliseRow entries={block.entries} />
        {:else if block.kind === 'line'}
            <p class="w-full {LineClasses[block.role]}" {...dataOf(block.role)}>
                {#if block.lead}{`${block.lead} · `}{/if}<span
                    data-hand-count={block.role === 'count' ? '' : undefined}>{block.text}</span
                >
            </p>
        {:else if block.kind === 'goods-counts'}
            <GoodCounts counts={block.counts} />
        {:else if block.kind === 'cards'}
            <div
                class="grid w-full gap-1.5"
                style:grid-template-columns={columns(block)}
                data-cards={block.tone}
            >
                {#each block.rows as row (row.kind)}
                    <CardChoice {row} paint={block.paint} {pointer} />
                {/each}
            </div>
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
            <OrderRow step={block.step} entries={block.entries} seats={block.seats} />
        {:else if block.kind === 'dawn-sheet'}
            <DawnSheet sheet={block.sheet} seats={block.seats} />
        {:else if block.kind === 'game-end'}
            <GameEndSummary summary={block.summary} seats={block.seats} />
        {:else if block.kind === 'rows'}
            <div class="flex flex-wrap items-center gap-1" data-rows={block.name}>
                {#if block.heading}
                    <span class="text-xs uppercase tracking-wide text-feudum-text-muted"
                        >{block.heading}</span
                    >
                {/if}
                {#each block.rows as row (row.choice.label)}
                    <RowChoice {row} {pointer} />
                {/each}
            </div>
        {:else if block.kind === 'tally'}
            <CombatTally lines={block.lines} note={block.note} />
        {:else if block.kind === 'primary'}
            <button
                type="button"
                class="ml-auto rounded-lg border border-feudum-primary-border bg-feudum-primary px-4 py-1 text-sm font-semibold text-feudum-primary-text
                    {block.enabled ? 'hover:bg-feudum-primary-hover' : 'opacity-50'}"
                disabled={!block.enabled}
                data-primary
                onclick={() => void block.send()}>{block.label}</button
            >
        {/if}
    {/each}
</div>
