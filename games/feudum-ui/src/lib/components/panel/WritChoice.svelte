<script lang="ts">
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import PanelRow, { type RowPointer } from '$lib/components/table/PanelRow.svelte'
    import type { WritRow } from '$lib/model/actionPanel.js'
    import Magnifier from './Magnifier.svelte'

    /** R-4.4.1 A drawn writ: a press picks it, its magnifier enlarges it. */
    let { row, pointer }: { row: WritRow; pointer: RowPointer } = $props()

    const FaceWidth = 110
</script>

{#snippet face()}
    <WritFace faceShown writId={row.writId} width={FaceWidth} />
{/snippet}

{#snippet corner()}
    <Magnifier
        label={row.choice.label}
        face={() => ({ kind: 'writ', faceShown: true, writId: row.writId })}
    />
{/snippet}

<div style:width="{FaceWidth}px">
    <PanelRow choice={row.choice} {pointer} {face} {corner} onPress={() => void row.press()} />
</div>
