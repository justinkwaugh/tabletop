<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import type { ActionRow } from '$lib/model/actionPanel.js'

    /** R-3.3 A pouch choice the seat can't commit is not drawn. */
    let { row }: { row: ActionRow } = $props()

    const GoodSize = 22
</script>

<span
    class="flex min-w-0 flex-col"
    data-row={row.choice.label}
    data-picked={row.choice.picked ? '' : undefined}
>
    <button
        type="button"
        class="choice flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left text-feudum-text hover:bg-feudum-control-hover
            {row.choice.picked
            ? 'border-feudum-accent bg-feudum-primary ring-2 ring-feudum-accent'
            : 'border-feudum-frame bg-feudum-control'}"
        aria-label={row.choice.label}
        aria-pressed={row.choice.picked}
        data-pouch-choice
        onclick={() => void row.press()}
    >
        {#if row.art?.kind === 'good'}
            <GoodToken good={row.art.good} size={GoodSize} />
        {/if}
        <span class="title text-sm" data-pouch-title>{row.choice.shown ?? row.choice.label}</span>
    </button>
</span>

<style>
    /* Contract, Phone layout: the art beside its short name, so the two share a line. */
    @media (width < 40rem), (max-height: 520px) and (orientation: landscape) {
        .choice {
            justify-content: center;
            gap: 0.375rem;
            padding: 0.125rem 0.375rem;
        }

        .title {
            font-size: 0.6875rem;
            line-height: 0.875rem;
            white-space: nowrap;
        }
    }
</style>
