<script lang="ts">
    import type { Color, BoundingBox } from '@tabletop/common'
    import type { HydratedFeudumGameState, KnightRowId } from '@tabletop/feudum'
    import GuildArea from '$lib/components/guilds/GuildArea.svelte'
    import UprightArea from '$lib/components/guilds/UprightArea.svelte'
    import RoseChip from '$lib/components/pieces/RoseChip.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import { guildTarget } from '$lib/model/boardOffer.js'
    import type { BenchItem } from '$lib/model/benchOffer.js'
    import type { BenchAreaView, BenchBox, GhostPiece, PlacedGhost } from '$lib/model/benchView.js'
    import type { PanelChoice } from '$lib/model/cardFlows.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { BenchAreaWidth, GuildBox, GuildSizes, uprightTurn } from '$lib/utils/boardGeometry.js'
    import { widenedBoxes } from '$lib/utils/benchPresses.js'
    import BenchGhostPiece from './BenchGhostPiece.svelte'

    /** R-1.2.3 The area stands upright; presses lie over it, since an image holds no children. */
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
        rowPaint: (row: KnightRowId) => SeatPaint | undefined
        pointer: RowPointer
        onPress: (choice: PanelChoice) => void
    } = $props()

    const percent = (value: number, whole: number) => `${(value / whole) * 100}%`

    /** Contract, Upright guild areas: a press reaches 44 px. */
    const Target = 44

    /** S68 A Knight row is smaller than a finger at bench scale, so its press reaches past it. */
    let long = $derived(Math.min(fit ?? BenchAreaWidth, BenchAreaWidth))
    let short = $derived((long * GuildBox.height) / GuildBox.width)
    let ghostTurn = $derived(-uprightTurn(area.guild))

    const reaches = $derived.by(() => {
        const rows = area.placed.filter(
            ({ item, presses }) => presses && item.id.startsWith('row:')
        )
        if (rows.length === 0) {
            return new Map<string, BoundingBox>()
        }
        const spans = widenedBoxes(
            rows.map(({ box }) => box),
            GuildBox,
            (Target * GuildBox.width) / long
        )
        return new Map(rows.map(({ item }, at) => [item.id, spans[at]!]))
    })

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
        transform="translate({point?.x ?? 0} {point?.y ?? 0}) rotate({ghostTurn})"
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

<div class="flex flex-col gap-1" style:width="{short}px" data-bench-area={area.guild}>
    <UprightArea guild={area.guild} {long} data-pick={guildTarget(area.guild)}>
        <GuildArea
            guild={area.guild}
            {state}
            {paintOf}
            {colourPaintOf}
            width={long}
            over={ghosts}
        />
        {#each area.placed as { item, box, presses } (item.id)}
            {@const reach = reaches.get(item.id) ?? box}
            <div
                class="item absolute"
                class:still={!presses}
                style:left={percent(reach.x, GuildBox.width)}
                style:top={percent(reach.y, GuildBox.height)}
                style:width={percent(reach.width, GuildBox.width)}
                style:height={percent(reach.height, GuildBox.height)}
                data-bench-place={item.id}
                data-bench-role={item.role}
            >
                {#if presses}
                    <PanelRow choice={item} {pointer} {onPress}>
                        {#snippet face()}
                            <span
                                class="absolute block"
                                style:left={percent(box.x - reach.x, reach.width)}
                                style:top={percent(box.y - reach.y, reach.height)}
                                style:width={percent(box.width, reach.width)}
                                style:height={percent(box.height, reach.height)}
                            >
                                {@render ring(item, box)}
                            </span>
                        {/snippet}
                    </PanelRow>
                {:else}
                    <span class="pointer-events-none block h-full w-full">
                        {@render ring(item, box)}
                    </span>
                {/if}
            </div>
        {/each}
    </UprightArea>
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
    .item :global([data-row]) {
        display: block;
        height: 100%;
    }

    .item :global(button.face) {
        height: 100%;
    }

    .item.still {
        pointer-events: none;
    }

    .item[data-bench-role='picked'] :global(.opacity-50) {
        opacity: 1;
    }

    /* R-1.2.3 Our words over a turned area read upright. */
    .item :global([data-refusal]),
    .note,
    .left {
        rotate: var(--piece-turn, 0deg);
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
