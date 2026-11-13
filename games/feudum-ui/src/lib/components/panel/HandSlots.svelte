<script lang="ts">
    import ActionCardFace from '$lib/components/pieces/ActionCardFace.svelte'
    import type { ActionBlock } from '$lib/model/actionPanel.js'

    /**
     * R-3.1 The plan: a numbered slot per card the hand needs, filled in the order pressed. A filled
     * slot's press takes its card back. The numbers are the seat's own plan; the cards may be played
     * in any order, as the slots' name says. The tray's label counts them, so they have no caption.
     */
    let { block }: { block: Extract<ActionBlock, { kind: 'slots' }> } = $props()

    /** The slot's drawing width. */
    const FaceWidth = 64
</script>

<div class="flex flex-col gap-1" data-plan>
    <div class="flex gap-1.5 max-sm:gap-1" role="list" aria-label="Your hand · {block.caption}">
        {#each block.slots as slot (slot.at)}
            <div class="slot relative" role="listitem" data-slot={slot.at}>
                {#if slot.card}
                    {@const card = slot.card}
                    <button
                        type="button"
                        class="block w-full rounded-md outline-offset-1 hover:outline-1 hover:outline-feudum-frame"
                        aria-label="{card.label}, slot {slot.at}: take back"
                        data-slot-card={card.label}
                        onclick={() => void card.press()}
                    >
                        <ActionCardFace
                            faceShown
                            kind={card.kind}
                            number={card.number}
                            paint={block.paint}
                            width={FaceWidth}
                        />
                    </button>
                {:else}
                    <span
                        class="empty block rounded-md border border-dashed border-feudum-frame bg-feudum-surface"
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
    /* A slot stands at the tray's slot width and a card's height. */
    .slot {
        flex: 0 0 auto;
        width: var(--slot-width, 64px);
    }

    /* The face is drawn at its own width and scales to the slot's. */
    .slot :global(svg) {
        display: block;
        width: 100%;
        height: auto;
    }

    .empty {
        aspect-ratio: 250 / 380;
    }
</style>
