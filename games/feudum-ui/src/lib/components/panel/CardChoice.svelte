<script lang="ts">
    import ActionCardFace from '$lib/components/pieces/ActionCardFace.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { CardRow } from '$lib/model/actionPanel.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import Magnifier from './Magnifier.svelte'

    /** Departure 6: the magnifier. R-3.1 A drafted card stays dimmed among the eleven. */
    let { row, paint, pointer }: { row: CardRow; paint: SeatPaint; pointer: RowPointer } = $props()

    const FaceWidth = 88
</script>

{#snippet face()}
    <span class="block {row.slot === undefined ? '' : 'opacity-40'}">
        <ActionCardFace faceShown kind={row.kind} number={row.number} {paint} width={FaceWidth} />
    </span>
    {#if row.slot !== undefined}
        <span
            class="absolute inset-0 m-auto flex h-7 w-7 items-center justify-center rounded-full bg-feudum-accent text-sm font-semibold text-feudum-ink"
            aria-hidden="true"
            data-slot-badge={row.slot}>{row.slot}</span
        >
    {/if}
{/snippet}

{#snippet corner()}
    <Magnifier
        label="{row.label} card"
        face={() => ({
            kind: 'card',
            faceShown: true,
            card: row.kind,
            number: row.number,
            paint
        })}
    />
{/snippet}

<PanelRow
    choice={{ label: row.label, picked: row.picked, lights: row.lights }}
    {pointer}
    {face}
    {corner}
    onPress={() => void row.press()}
/>
