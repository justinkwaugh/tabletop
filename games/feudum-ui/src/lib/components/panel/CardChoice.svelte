<script lang="ts">
    import ActionCardFace from '$lib/components/pieces/ActionCardFace.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { CardRow } from '$lib/model/actionPanel.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import Magnifier from './Magnifier.svelte'

    /** A card of the hand: a press on the face picks it, its magnifier enlarges it (Departure 6). */
    let { row, paint, pointer }: { row: CardRow; paint: SeatPaint; pointer: RowPointer } = $props()

    /** The face's drawing width; the column it stands in scales it. */
    const FaceWidth = 88
</script>

{#snippet face()}
    <ActionCardFace faceShown kind={row.kind} number={row.number} {paint} width={FaceWidth} />
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
