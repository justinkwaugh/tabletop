<script lang="ts">
    import BenchGhostPiece from '$lib/components/bench/BenchGhostPiece.svelte'
    import type { ActionBlock } from '$lib/model/actionPanel.js'

    /** R-4.6 What a push or a pull has staged. */
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
