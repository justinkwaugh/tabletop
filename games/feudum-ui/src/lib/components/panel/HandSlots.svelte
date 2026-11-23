<script lang="ts">
    import ActionCardFace from '$lib/components/pieces/ActionCardFace.svelte'
    import type { ActionBlock } from '$lib/model/actionPanel.js'

    /** R-3.1 The cards may be played in any order; the numbers are the seat's own plan. */
    let { block }: { block: Extract<ActionBlock, { kind: 'slots' }> } = $props()

    const FaceWidth = 64
</script>

<div class="flex flex-col gap-1" data-plan>
    <div class="flex gap-1.5 max-sm:gap-1" role="list" aria-label="Your hand · {block.caption}">
        {#each block.slots as slot (slot.at)}
            <div class="slot relative" role="listitem" data-slot={slot.at}>
                {#if slot.card}
                    {@const card = slot.card}
                    <span class="block w-full" data-slot-card={card.label}>
                        <ActionCardFace
                            faceShown
                            kind={card.kind}
                            number={card.number}
                            paint={block.paint}
                            width={FaceWidth}
                        />
                    </span>
                {:else}
                    <span
                        class="empty block rounded-md border border-feudum-frame bg-feudum-surface"
                        data-slot-empty
                    ></span>
                {/if}
                <span
                    class="pointer-events-none absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-feudum-accent text-xs font-semibold text-feudum-ink"
                    aria-hidden="true">{slot.at}</span
                >
            </div>
        {/each}
    </div>
</div>

<style>
    .slot {
        flex: 0 0 auto;
        width: var(--slot-width, 64px);
    }

    .slot :global(svg) {
        display: block;
        width: 100%;
        height: auto;
    }

    .empty {
        aspect-ratio: 250 / 380;
    }
</style>
