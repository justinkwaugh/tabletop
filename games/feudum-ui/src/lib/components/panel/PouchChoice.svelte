<script lang="ts">
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import type { ActionRow } from '$lib/model/actionPanel.js'

    /**
     * R-3.3 One pouch choice: its goods art, its short name, and what it does beneath; the full words
     * are its accessible name. One that can't be chosen is dimmed and says why in place of what it
     * does, once: a press adds nothing. A phone drops the line beneath, so there a press says why.
     */
    let { row }: { row: ActionRow } = $props()

    const GoodSize = 22

    let refused = $derived(row.choice.refusal !== undefined)
    let refusalShown = $state(false)

    function press() {
        if (refused) {
            refusalShown = true
        } else {
            void row.press()
        }
    }
</script>

<span
    class="inline-flex flex-col"
    data-row={row.choice.label}
    data-picked={row.choice.picked ? '' : undefined}
>
    <button
        type="button"
        class="choice inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-left text-feudum-text
            {row.choice.picked
            ? 'border-feudum-accent bg-feudum-primary'
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
        {:else}
            <span
                class="inline-block shrink-0 rounded-full border border-dashed border-feudum-text-muted"
                style:width="{GoodSize}px"
                style:height="{GoodSize}px"
                data-empty-pouch
            ></span>
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
    {#if refusalShown && row.choice.refusal}
        <span class="phone-refusal text-xs text-feudum-danger" data-refusal
            >{row.choice.refusal}</span
        >
    {/if}
</span>

<style>
    .phone-refusal {
        display: none;
    }

    /*
     * Contract, Phone layout: the art over its short name, without the line beneath, so the three
     * share the send's line; a refused press says why.
     */
    @media (width < 40rem), (max-height: 520px) and (orientation: landscape) {
        .choice {
            flex-direction: column;
            justify-content: center;
            gap: 0.125rem;
            padding: 0.125rem 0.375rem;
            text-align: center;
        }

        .title {
            font-size: 0.6875rem;
            line-height: 0.875rem;
            white-space: nowrap;
        }

        .caption {
            display: none;
        }

        .phone-refusal {
            display: block;
        }
    }
</style>
