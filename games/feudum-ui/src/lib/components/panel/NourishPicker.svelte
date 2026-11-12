<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import PawnPiece from '$lib/components/pieces/PawnPiece.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { ActionBlock, NourishOptionRow } from '$lib/model/actionPanel.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import PrimaryButton from './PrimaryButton.svelte'
    import RowChoice from './RowChoice.svelte'

    /**
     * Contract, Round end: the nourish picker. Each pawn is its cube, its name and the space it
     * stands on, and its feeds as art: food, or wine (R-4.10.2). An unfed pawn's row is rose with
     * what it loses (R-4.10.1). Beside the rows, the summary: what the feeding pays and what is
     * kept, the unfed rule once, R-4.3.3 a tile's rows when one could feed, and the send. A phone's
     * rows are compact, with no preview path (a press is undoable, and the map rings each fed pawn
     * with its payment), its summary stays in sight under them, and its send draws the counts as art.
     */
    let {
        block,
        pointer
    }: { block: Extract<ActionBlock, { kind: 'nourish-picker' }>; pointer: RowPointer } = $props()

    const layout = new PhoneLayout()

    const DeskCube = 38
    const PhoneCube = 32
    const OptionGood = 24
    const SummaryGood = 20
    const SendGood = 16

    /** The phone's short words for the unfed rule, beside its send. */
    const PhoneRule = 'Unfed: back to supply'

    /** A phone draws the send's counts as art while every pawn eats; else its words. */
    let allFed = $derived(block.pawns.every(({ unfed }) => !unfed))

    function optionClasses(option: NourishOptionRow): string {
        const { picked, refusal } = option.choice
        if (option.feed === 'unfed') {
            return picked
                ? 'border-feudum-danger bg-feudum-danger-soft text-feudum-text'
                : 'border-feudum-danger bg-feudum-control text-feudum-danger hover:bg-feudum-control-hover'
        }
        if (picked) {
            return 'border-feudum-accent bg-feudum-primary text-feudum-text'
        }
        return `border-feudum-frame bg-feudum-control text-feudum-text ${
            refusal || option.spent ? 'opacity-60' : 'hover:bg-feudum-control-hover'
        }`
    }
</script>

<div class="flex w-full items-stretch gap-3.5 max-sm:flex-col max-sm:gap-2" data-nourish-picker>
    <div class="flex flex-none flex-col gap-2 max-sm:gap-1.5" data-nourish-rows>
        {#each block.pawns as pawn (pawn.n)}
            <div
                data-nourish-pawn={pawn.name}
                class="flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 max-sm:gap-2 max-sm:px-2 max-sm:py-1
                    {pawn.unfed
                    ? 'border-feudum-danger bg-feudum-danger-soft'
                    : 'border-feudum-frame bg-feudum-surface-raised'}"
                data-unfed={pawn.unfed ? '' : undefined}
            >
                <PawnPiece
                    character={pawn.character}
                    paint={pawn.paint}
                    size={layout.phone ? PhoneCube : DeskCube}
                />
                <span class="flex min-w-[5.5rem] flex-col leading-tight">
                    <span class="text-sm font-semibold text-feudum-text" data-pawn-name
                        >{pawn.name}</span
                    >
                    <span class="text-xs text-feudum-text-muted" data-pawn-place
                        >at {pawn.place}</span
                    >
                </span>
                <span class="flex flex-wrap gap-1.5" role="group" aria-label="Feed the {pawn.name}">
                    {#each pawn.options as option (option.feed)}
                        {#snippet optionView()}
                            <span
                                class="inline-flex items-center gap-1.5 rounded-lg border-2 px-2 py-1 text-left max-sm:px-1.5 max-sm:py-0.5
                                    {optionClasses(option)}"
                                data-feed={option.feed}
                                data-picked={option.choice.picked ? '' : undefined}
                                data-spent={option.spent ? '' : undefined}
                            >
                                {#if option.art?.kind === 'good'}
                                    <GoodToken good={option.art.good} size={OptionGood} />
                                {/if}
                                <span class="flex flex-col leading-tight">
                                    <span
                                        class="text-sm {option.feed === 'food'
                                            ? 'max-sm:sr-only'
                                            : 'max-sm:text-xs'}">{option.choice.shown}</span
                                    >
                                    <small
                                        class="text-[0.6875rem] max-sm:hidden {option.feed ===
                                        'unfed'
                                            ? 'text-feudum-danger'
                                            : 'text-feudum-text-muted'}"
                                        data-caption>{option.caption}</small
                                    >
                                </span>
                            </span>
                        {/snippet}
                        <PanelRow
                            choice={option.choice}
                            {pointer}
                            piece={optionView}
                            onPress={() => void option.press()}
                        />
                    {/each}
                </span>
            </div>
        {/each}
    </div>
    <div
        class="flex min-w-0 flex-1 flex-col justify-between gap-2 rounded-lg border border-feudum-frame bg-feudum-surface-raised p-3
            max-sm:border-0 max-sm:p-0"
        data-nourish-summary
    >
        {#if !layout.phone}
            <p class="flex flex-wrap items-center gap-1.5 text-feudum-text" data-nourish-pays>
                <span class="font-semibold">Pays</span>
                {#if block.summary.pays.food > 0}
                    <span class="inline-flex items-center gap-0.5"
                        ><GoodToken good="food" size={SummaryGood} />{block.summary.pays.food}</span
                    >
                {/if}
                {#if block.summary.pays.wine > 0}
                    <span class="inline-flex items-center gap-0.5"
                        ><GoodToken good="sulfur" size={SummaryGood} />{block.summary.pays.wine}
                        <span class="text-xs text-feudum-text-muted">wine</span></span
                    >
                {/if}
                {#if block.summary.pays.food + block.summary.pays.wine === 0}
                    <span>nothing</span>
                {/if}
                <span class="text-xs text-feudum-text-muted">· you keep</span>
                <span class="inline-flex items-center gap-0.5"
                    ><GoodToken good="food" size={SummaryGood} />{block.summary.keeps.food}</span
                >
                <span class="text-xs text-feudum-text-muted">· barrel</span>
                <span class="inline-flex items-center gap-0.5"
                    ><GoodToken good="sulfur" size={SummaryGood} />{block.summary.keeps
                        .barrel}</span
                >
            </p>
            <p class="text-xs text-feudum-text-muted" data-nourish-rule>{block.rule}</p>
        {/if}
        {#if block.covers}
            <div class="flex flex-wrap items-center gap-1" data-nourish-covers>
                <span class="text-xs text-feudum-accent">{block.covers.line}</span>
                {#each block.covers.rows as row (row.choice.label)}
                    <RowChoice {row} {pointer} />
                {/each}
            </div>
        {/if}
        <div class="flex items-center gap-2">
            {#if layout.phone}
                <span class="flex-1 text-xs text-feudum-text-muted" data-nourish-rule
                    >{PhoneRule}</span
                >
            {/if}
            <span class="max-sm:flex-none">
                <PrimaryButton block={block.send}>
                    {#if layout.phone && allFed}
                        <span class="inline-flex items-center gap-1" data-send-phone>
                            Feed {block.send.tally.fed}
                            {#if block.send.tally.food > 0}
                                · <GoodToken good="food" size={SendGood} />{block.send.tally.food}
                            {/if}
                            {#if block.send.tally.wine > 0}
                                · <GoodToken good="sulfur" size={SendGood} />{block.send.tally.wine}
                            {/if}
                        </span>
                    {:else}
                        {block.send.label}
                    {/if}
                </PrimaryButton>
            </span>
        </div>
    </div>
</div>

<style>
    /* Contract, Phone layout: compact rows, and the send in sight in the action area's cap. */
    @media (width < 40rem), (max-height: 520px) and (orientation: landscape) {
        [data-nourish-rows] :global(.touch-preview) {
            display: none;
        }

        [data-nourish-summary] {
            position: sticky;
            bottom: 0;
            background-color: var(--feudum-surface-raised);
        }
    }
</style>
