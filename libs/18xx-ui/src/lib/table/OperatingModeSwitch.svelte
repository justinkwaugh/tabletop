<script lang="ts">
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import SlidingToggle from './SlidingToggle.svelte'
    let { session }: { session: EighteenXXSessionView } = $props()
    const modes = $derived(session.operatingMode)
</script>

<nav
    aria-label="Operating mode"
    class="operating-mode"
    class:crowded={modes.options.length === 3}
    class:packed={modes.options.length > 3}
>
    <SlidingToggle
        count={modes.options.length}
        selectedIndex={modes.options.findIndex((option) => option.selected)}
    >
        {#each modes.options as option (option.label)}<button
                aria-pressed={option.selected}
                aria-label={option.label}
                disabled={!modes.canChoose}
                onclick={option.choose}
                ><span class="long">{option.label}</span><span class="short"
                    >{option.shortLabel}</span
                ></button
            >{/each}
    </SlidingToggle>
</nav>

<style>
    .operating-mode {
        container: operating-mode / inline-size;
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
    .short {
        display: none;
    }
    /* Three or more modes outgrow a phone's action pane; short labels keep them on one line. */
    @container operating-mode (max-width: 360px) {
        .crowded .long {
            display: none;
        }
        .crowded .short {
            display: inline;
        }
    }
    @container operating-mode (max-width: 460px) {
        .packed .long {
            display: none;
        }
        .packed .short {
            display: inline;
        }
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
