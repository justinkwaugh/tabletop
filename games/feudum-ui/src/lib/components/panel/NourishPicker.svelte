<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import PawnPiece from '$lib/components/pieces/PawnPiece.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { ActionBlock, NourishOptionRow } from '$lib/model/actionPanel.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import PrimaryButton from './PrimaryButton.svelte'
    import RowChoice from './RowChoice.svelte'

    /** Contract, Round end: the nourish picker. R-4.10.1 An unfed pawn's row is rose. */
    let {
        block,
        pointer
    }: { block: Extract<ActionBlock, { kind: 'nourish-picker' }>; pointer: RowPointer } = $props()

    const layout = new PhoneLayout()

    const DeskCube = 38
    const PhoneCube = 32
    const OptionGood = 24
    const SendGood = 16

    let allFed = $derived(block.pawns.every(({ unfed }) => !unfed))

    function optionClasses(option: NourishOptionRow): string {
        const { picked } = option.choice
        if (option.feed === 'unfed') {
            return picked
                ? 'border-feudum-danger bg-feudum-danger-soft text-feudum-text'
                : 'border-feudum-danger bg-feudum-control text-feudum-danger hover:bg-feudum-control-hover'
        }
        if (picked) {
            return 'border-feudum-accent bg-feudum-primary text-feudum-text'
        }
        return `border-feudum-frame bg-feudum-control text-feudum-text ${
            option.spent ? 'opacity-60' : 'hover:bg-feudum-control-hover'
        }`
    }
</script>

<div
    class="flex w-full flex-col items-start gap-2 max-sm:items-stretch max-sm:gap-1"
    data-nourish-picker
>
    <div class="flex flex-none flex-col gap-2 max-sm:gap-1" data-nourish-rows>
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
                    <span class="text-xs text-feudum-text-muted" data-pawn-place>{pawn.place}</span>
                </span>
                <span class="flex flex-wrap gap-1" role="group" aria-label="Feed the {pawn.name}">
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
                                {#if option.choice.shown || option.caption}
                                    <span class="flex flex-col leading-tight">
                                        {#if option.choice.shown}
                                            <span class="text-sm max-sm:text-xs"
                                                >{option.choice.shown}</span
                                            >
                                        {/if}
                                        {#if option.caption}
                                            <small
                                                class="text-[0.6875rem] text-feudum-text-muted max-sm:hidden"
                                                data-caption>{option.caption}</small
                                            >
                                        {/if}
                                    </span>
                                {/if}
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
    <div class="flex flex-col gap-2 max-sm:gap-1" data-nourish-send>
        {#if block.covers}
            <div class="flex flex-wrap items-center gap-1" data-nourish-covers>
                <span class="text-xs text-feudum-accent">{block.covers.line}</span>
                {#each block.covers.rows as row (row.choice.label)}
                    <RowChoice {row} {pointer} />
                {/each}
            </div>
        {/if}
        <!-- Contract, Spacing: the send right after the line before it, the group gap from it. -->
        {#if block.send}
            {@const send = block.send}
            <span class="max-sm:self-end">
                <PrimaryButton block={send}>
                    {#if allFed}
                        <span class="inline-flex items-center gap-1" data-send-art>
                            Feed {send.tally.fed}
                            {#if send.tally.food > 0}
                                · <GoodToken good="food" size={SendGood} />{send.tally.food}
                            {/if}
                            {#if send.tally.wine > 0}
                                · <GoodToken good="sulfur" size={SendGood} />{send.tally.wine}
                            {/if}
                        </span>
                    {:else}
                        {send.label}
                    {/if}
                </PrimaryButton>
            </span>
        {/if}
    </div>
</div>

<style>
    /* Contract, Phone layout: no preview, as a press is undoable; the send stays in sight. */
    @media (width < 40rem), (max-height: 520px) and (orientation: landscape) {
        [data-nourish-rows] :global(.touch-preview) {
            display: none;
        }

        [data-nourish-send] {
            position: sticky;
            bottom: 0;
            background-color: var(--feudum-surface-raised);
        }
    }
</style>
