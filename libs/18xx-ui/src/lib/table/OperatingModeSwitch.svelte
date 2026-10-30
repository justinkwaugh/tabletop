<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import SlidingToggle from './SlidingToggle.svelte'
    let { session }: { session: EighteenXXSessionView } = $props()
    const modes = $derived(session.operatingMode)
</script>

<nav aria-label="Operating mode" class="operating-mode">
    <SlidingToggle
        count={modes.options.length}
        selectedIndex={modes.options.findIndex((option) => option.selected)}
    >
        {#each modes.options as option (option.label)}<button
                aria-pressed={option.selected}
                disabled={!modes.canChoose}
                onclick={option.choose}>{option.label}</button
            >{/each}
    </SlidingToggle>
</nav>

<style>
    .operating-mode {
        display: flex;
        justify-content: center;
        margin-bottom: 16px;
    }
    .operating-mode :global(.sliding-toggle) {
        background: var(--rail-surface-inset, #1b232d);
        box-shadow: inset 0 0 0 1px var(--rail-border, #c7b8a6);
    }
    .operating-mode :global(.sliding-toggle > button) {
        position: relative;
        padding: 6px 18px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: var(--rail-muted, #7f8e9e);
        font: inherit;
        font-size: 13px;
        line-height: 18px;
        cursor: pointer;
    }
    .operating-mode :global(.sliding-toggle > button:hover:not(:disabled)) {
        background: transparent;
        color: var(--rail-text, #e3e9ef);
    }
    .operating-mode :global(.sliding-toggle > button[aria-pressed='true']) {
        background: transparent;
        color: #ffffff;
        font-weight: 600;
    }
    .operating-mode :global(.sliding-toggle > button:focus-visible) {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    .operating-mode :global(.sliding-toggle > button:disabled) {
        opacity: 0.35;
        cursor: default;
    }
</style>
