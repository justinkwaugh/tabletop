<script lang="ts">
    import ActionCardFace from '$lib/components/pieces/ActionCardFace.svelte'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import LockMark from '$lib/components/pieces/LockMark.svelte'
    import type { ActionBlock } from '$lib/model/actionPanel.js'

    /** R-3.1-H1 No other seat sees the pouch until the reveal. */
    let { block }: { block: Extract<ActionBlock, { kind: 'hand-set' }> } = $props()

    const FaceWidth = 64
    const GoodSize = 22
</script>

<div
    class="hand-set rounded-lg border border-feudum-frame bg-feudum-surface-raised"
    role="group"
    aria-label="Your hand and pouch, set"
    data-hand-set
>
    <p class="set-label" data-tray-label="hand">Hand</p>
    <div class="set-cards" role="list" aria-label="Your hand">
        {#each block.cards as card, at (card.kind)}
            <div class="set-card relative" role="listitem" data-set-card={card.label}>
                <ActionCardFace
                    faceShown
                    kind={card.kind}
                    number={card.number}
                    paint={block.paint}
                    width={FaceWidth}
                />
                <span
                    class="at pointer-events-none absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-feudum-accent text-xs font-semibold text-feudum-ink"
                    aria-hidden="true">{at + 1}</span
                >
            </div>
        {/each}
    </div>
    <p class="set-label" data-tray-label="pouch">Pouch</p>
    <div
        class="set-pouch flex items-center gap-2 rounded-lg border px-2 py-1
            {block.pouch
            ? 'border-feudum-accent bg-feudum-primary'
            : 'border-feudum-frame bg-feudum-control text-feudum-text-muted'}"
        data-set-pouch={block.pouch?.good ?? 'none'}
    >
        {#if block.pouch}
            <GoodToken good={block.pouch.good} size={GoodSize} />
            <span class="title text-sm leading-tight text-feudum-text">{block.pouch.title}</span>
            <span class="text-feudum-text-muted"><LockMark label="sealed" /></span>
        {:else}
            <span class="text-sm">none</span>
        {/if}
    </div>
</div>

<style>
    /* Contract, Hand selection: the same tray as the draft's, its labels in one column. */
    .hand-set {
        --slot-width: 62px;
        display: grid;
        grid-template-columns: 62px max-content;
        column-gap: 0.625rem;
        row-gap: 0.5rem;
        align-items: center;
        padding: 0.5rem 0.875rem;
    }

    .set-label {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 700;
        line-height: 1.15;
        color: var(--feudum-heading);
    }

    .set-cards {
        display: flex;
        gap: 0.375rem;
    }

    .set-card {
        flex: 0 0 auto;
        width: var(--slot-width);
    }

    .set-card :global(svg) {
        display: block;
        width: 100%;
        height: auto;
    }

    .set-pouch {
        width: 0;
        min-width: 100%;
    }

    /* Contract, Phone layout: the cards and the pouch in one line, without the labels. */
    @media (width < 40rem), (max-height: 520px) and (orientation: landscape) {
        .hand-set {
            --slot-width: 34px;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.375rem 0.5rem;
        }

        .set-label {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip-path: inset(50%);
            white-space: nowrap;
        }

        .set-cards {
            gap: 0.25rem;
        }

        .at {
            display: none;
        }

        .set-pouch {
            width: auto;
            min-width: 0;
            gap: 0.375rem;
            padding: 0.125rem 0.5rem;
        }

        .title {
            font-size: 0.75rem;
            white-space: nowrap;
        }
    }
</style>
