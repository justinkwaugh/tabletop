<script lang="ts">
    import type { Snippet } from 'svelte'
    let { label, children, disabled, onAccept, onDecline, acceptLabel = 'Accept' }: {
        label: string
        children: Snippet
        disabled: boolean
        onAccept: () => void
        onDecline: () => void
        acceptLabel?: string
    } = $props()
</script>

<div class="response" aria-label={label}>
    <div class="summary">{@render children()}</div>
    <div class="controls">
        <button class="action-button" {disabled} onclick={onAccept}>{acceptLabel}</button>
        <button class="action-button" {disabled} onclick={onDecline}>Decline</button>
    </div>
</div>

<style>
    .response { font-size: 13px; color: var(--rail-text, #514536); }
    .summary, .controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; }
    .controls { margin-top: 8px; }
    button { background: var(--rail-surface-raised, #efe7db); color: inherit; border: 1px solid var(--rail-border, #c7b8a6); border-radius: 4px; padding: 6px 10px; font: inherit; cursor: pointer; }
    button:hover:not(:disabled) { background: var(--rail-surface-raised, #e5d9c8); }
    button:disabled { opacity: .5; cursor: default; }
</style>
