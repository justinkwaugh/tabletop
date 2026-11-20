<script lang="ts">
    import BenchGhostPiece from '$lib/components/bench/BenchGhostPiece.svelte'
    import type { ActionBlock } from '$lib/model/actionPanel.js'

    /**
     * R-4.6 What a push or a pull has staged: a line for each thing moved, its piece and count and
     * where it goes, said in words to a screen reader; then the count against the step's limit. A
     * line has no press of its own: a staged row comes off by pressing it again on the bench, and Undo
     * takes back the latest press. In the tray on a desk, above the send in the bench's sheet on a
     * phone.
     */
    let { block }: { block: Extract<ActionBlock, { kind: 'staged' }> } = $props()

    const PieceSize = 20
</script>

<div class="flex w-full flex-col gap-1" role="group" aria-label="Staged moves" data-staged>
    <ul class="flex flex-col gap-1">
        {#each block.lines as line (line.item)}
            <li class="flex flex-wrap items-center gap-2" data-staged-line={line.item}>
                {#if line.piece}
                    <span class="inline-flex" aria-hidden="true">
                        <BenchGhostPiece
                            piece={line.piece}
                            size={PieceSize}
                            rowPaint={() => line.paint}
                        />
                    </span>
                {/if}
                <span class="text-sm text-feudum-text" aria-hidden="true">{line.text}</span>
                <span class="sr-only">{line.words}</span>
            </li>
        {/each}
    </ul>
    {#if block.tally}
        <p class="text-xs text-feudum-text-muted" data-staged-tally>{block.tally}</p>
    {/if}
</div>
