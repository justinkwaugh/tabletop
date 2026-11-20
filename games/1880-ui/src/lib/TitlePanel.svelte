<script lang="ts">
    import type { Snippet } from 'svelte'
    let { label, children }: { label: string; children: Snippet } = $props()
</script>

<section class="title-panel centered-panel" aria-label={label}>{@render children()}</section>

<style>
    .title-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
        text-align: center;
    }
    .title-panel :global(p) {
        margin: 4px 12px 0;
        max-width: 34rem;
    }
    .title-panel :global(.action-button) {
        padding: 6px 14px;
        border: 1px solid var(--rail-border, #aebfb4);
        border-radius: 4px;
        background: var(--rail-surface, #edf3eb);
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .title-panel :global(.action-button:disabled) {
        opacity: 0.5;
        cursor: default;
    }
    .title-panel :global(.choices) {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
</style>
