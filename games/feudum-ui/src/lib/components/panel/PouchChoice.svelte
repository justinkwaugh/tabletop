<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import type { ActionRow } from '$lib/model/actionPanel.js'

    /**
     * R-3.3 One pouch choice: its good, its short name, and what it does beneath; the full words are
     * its accessible name. The chosen one is ringed, and a second press clears it. One that can't be
     * chosen is dimmed and says why in place of what it does, once: a press adds nothing. A phone
     * drops the line beneath; the pouch says why under the pair instead.
     */
    let { row }: { row: ActionRow } = $props()

    const GoodSize = 22

    let refused = $derived(row.choice.refusal !== undefined)

    function press() {
        if (!refused) {
            void row.press()
        }
    }
</script>

<span
    class="flex min-w-0 flex-col"
    data-row={row.choice.label}
    data-picked={row.choice.picked ? '' : undefined}
>
    <button
        type="button"
        class="choice flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left text-feudum-text
            {row.choice.picked
            ? 'border-feudum-accent bg-feudum-primary ring-2 ring-feudum-accent'
            : 'border-feudum-frame bg-feudum-control'}
            {refused ? 'opacity-50' : 'hover:bg-feudum-control-hover'}"
        aria-label={refused ? `${row.choice.label}: ${row.choice.refusal}` : row.choice.label}
        title={row.choice.refusal}
        aria-pressed={row.choice.picked}
        aria-disabled={refused}
        data-pouch-choice
        onclick={press}
    >
        {#if row.art?.kind === 'good'}
            <GoodToken good={row.art.good} size={GoodSize} />
        {/if}
        <span class="flex flex-col leading-tight">
            <span class="title text-sm" data-pouch-title
                >{row.choice.shown ?? row.choice.label}</span
            >
            <span class="caption text-xs text-feudum-text-muted" data-pouch-caption
                >{row.choice.refusal ?? row.caption}</span
            >
        </span>
    </button>
</span>

<style>
    /*
     * Contract, Phone layout: the art beside its short name, without the line beneath, so the two
     * share a line; the pouch says a dimmed one's reason under them.
     */
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

        .caption {
            display: none;
        }
    }
</style>
