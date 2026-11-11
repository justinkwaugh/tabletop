<script lang="ts">
    import type { Color } from '@tabletop/common'
    import type { HydratedFeudumGameState } from '@tabletop/feudum'
    import GuildArea from '$lib/components/guilds/GuildArea.svelte'
    import RoseChip from '$lib/components/pieces/RoseChip.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import { guildTarget } from '$lib/model/boardOffer.js'
    import type { BenchItem } from '$lib/model/benchOffer.js'
    import type { BenchAreaView, BenchBox, GhostPiece, PlacedGhost } from '$lib/model/benchView.js'
    import type { PanelChoice } from '$lib/model/cardFlows.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { BenchAreaWidth, GuildBox, GuildSizes } from '$lib/utils/boardGeometry.js'
    import BenchGhostPiece from './BenchGhostPiece.svelte'

    /**
     * One guild area on the bench: the board's own component at the bench's fixed width. Each lit,
     * picked or dimmed item is a press over where it stands, in percent of the area, so it follows
     * the width; the area itself is an image, so a press can't be inside it. Ghosts draw inside it.
     * `fit` narrows it further, so a phone's sheet holds both areas whole.
     */
    let {
        area,
        fit,
        state,
        paintOf,
        colourPaintOf,
        rowPaint,
        pointer,
        onPress
    }: {
        area: BenchAreaView
        fit?: number
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
        rowPaint: (row: number) => SeatPaint | undefined
        pointer: RowPointer
        onPress: (choice: PanelChoice) => void
    } = $props()

    const percent = (value: number, whole: number) => `${(value / whole) * 100}%`

    function sizeOf(piece: GhostPiece): number {
        switch (piece.kind) {
            case 'good':
                return GuildSizes.good
            case 'vessel':
                return GuildSizes.vessel
            case 'seal':
                return GuildSizes.seal
            case 'monster':
                return GuildSizes.monster
            case 'marker':
                return GuildSizes.marker
        }
    }
</script>

{#snippet ghost({ item, at, piece, point }: PlacedGhost)}
    {@const size = sizeOf(piece)}
    <g
        transform="translate({point?.x ?? 0} {point?.y ?? 0})"
        opacity="0.7"
        pointer-events="none"
        data-ghost={item}
        data-ghost-at={at}
    >
        <BenchGhostPiece {piece} {size} x={-size / 2} y={-size / 2} {rowPaint} />
    </g>
{/snippet}

{#snippet ghosts()}
    {#each area.ghosts as placed (placed.key)}
        {@render ghost(placed)}
    {/each}
{/snippet}

{#snippet ring(item: BenchItem, box: BenchBox)}
    <span
        class="ring block h-full w-full {item.role}"
        class:round={box.round}
        class:wide={box.width > box.height * 2}
    >
        {#if item.note}
            <span class="note" data-bench-note={item.note.kind}
                ><RoseChip label={item.note.label} /></span
            >
        {/if}
        {#if item.count !== undefined}
            <span class="left" data-bench-count>{item.count}</span>
        {/if}
    </span>
{/snippet}

<div
    class="flex flex-col gap-1"
    style:width="min({fit ?? BenchAreaWidth}px, {BenchAreaWidth}px, 100%)"
    data-bench-area={area.guild}
>
    <div class="relative" data-pick={guildTarget(area.guild)}>
        <GuildArea
            guild={area.guild}
            {state}
            {paintOf}
            {colourPaintOf}
            width={BenchAreaWidth}
            over={ghosts}
        />
        {#each area.placed as { item, box, presses } (item.id)}
            <div
                class="item absolute"
                style:left={percent(box.x, GuildBox.width)}
                style:top={percent(box.y, GuildBox.height)}
                style:width={percent(box.width, GuildBox.width)}
                style:height={percent(box.height, GuildBox.height)}
                data-bench-place={item.id}
                data-bench-role={item.role}
            >
                {#if presses}
                    <PanelRow choice={item} {pointer} {onPress}>
                        {#snippet face()}
                            {@render ring(item, box)}
                        {/snippet}
                    </PanelRow>
                {:else}
                    <span class="pointer-events-none block h-full w-full">
                        {@render ring(item, box)}
                    </span>
                {/if}
            </div>
        {/each}
    </div>
    {#if area.buttons.length > 0}
        <div class="flex flex-wrap items-center gap-1" data-rows="bench-buttons">
            {#each area.buttons as item (item.id)}
                <span class="inline-flex" data-bench-button={item.id} data-bench-role={item.role}>
                    <PanelRow choice={item} {pointer} {onPress} />
                </span>
            {/each}
        </div>
    {/if}
</div>

<style>
    /* The area follows the sheet's width on a phone; the presses over it are in percent. */
    [data-pick] > :global(svg) {
        display: block;
        width: 100%;
        height: auto;
    }

    .item :global([data-row]) {
        display: block;
        height: 100%;
    }

    .item :global(button.face) {
        height: 100%;
    }

    /* A used row refuses a second press, and it stays the brightest thing there. */
    .item[data-bench-role='picked'] :global(.opacity-50) {
        opacity: 1;
    }

    .item :global([data-refusal]) {
        position: absolute;
        z-index: 1;
        left: 0;
        top: 100%;
        width: max-content;
        max-width: 240px;
        padding: 2px 8px;
        border-radius: 8px;
        background: var(--feudum-surface-raised);
    }

    .ring {
        position: relative;
        border-radius: 8px;
    }

    .ring.round {
        border-radius: 50%;
    }

    .ring.lit {
        outline: 3px solid var(--feudum-accent);
        outline-offset: -3px;
        box-shadow: 0 0 0 2px var(--feudum-halo);
    }

    .ring.picked {
        outline: 5px solid var(--feudum-accent);
        outline-offset: -5px;
        background: color-mix(in srgb, var(--feudum-accent) 35%, transparent);
        box-shadow: 0 0 0 2px var(--feudum-halo);
    }

    .ring.dimmed {
        background: var(--feudum-dim);
    }

    .note {
        position: absolute;
        top: -8px;
        right: -4px;
        line-height: 1;
    }

    /* Beside the printed prices, not over them: a bin's swatch, above a bead. */
    .wide .note {
        top: 50%;
        right: auto;
        left: 4px;
        transform: translateY(-50%);
    }

    .round .note {
        top: -20px;
        right: auto;
        left: 50%;
        transform: translateX(-50%);
    }

    .left {
        position: absolute;
        bottom: 2px;
        right: 2px;
        min-width: 16px;
        padding: 0 4px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
        line-height: 16px;
        text-align: center;
        color: var(--feudum-text);
        background: var(--feudum-surface-raised);
    }
</style>
