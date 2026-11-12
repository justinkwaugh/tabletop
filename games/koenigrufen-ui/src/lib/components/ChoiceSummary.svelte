<script lang="ts">
    let {
        heading,
        summary,
        hint
    }: {
        heading?: string
        summary?: string
        hint: string
    } = $props()
</script>

<p class="summary" aria-live="polite">
    {#if heading && summary}
        <strong>{heading}:</strong>
        {summary}
    {:else}
        <span class="hint">{hint}</span>
    {/if}
</p>

<style>
    .summary {
        min-height: 3.6em;
        font-size: 0.85rem;
        line-height: 1.3;
        opacity: 0.9;
    }

    .hint {
        opacity: 0.7;
        font-style: italic;
    }

    @media (max-width: 640px) {
        .summary {
            min-height: 3.9em;
            font-size: 0.75rem;
        }
    }
</style>
