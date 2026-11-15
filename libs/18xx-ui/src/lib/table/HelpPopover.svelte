<script lang="ts">
    import type { Snippet } from 'svelte'
    import { popoverAbove } from '../presentation/popoverPlacement.js'
    let {
        label,
        width = 380,
        children
    }: { label: string; width?: number; children: Snippet } = $props()
    const id = $props.id()
    let button: HTMLButtonElement | undefined = $state()
    let open = $state(false)
    let bounds = $state({ left: 0, bottom: 0 })
    function prepare(event: ToggleEvent) {
        open = event.newState === 'open'
        if (open && button) bounds = popoverAbove(button, width)
    }
</script>

<button
    class="help"
    bind:this={button}
    popovertarget={id}
    aria-expanded={open}
    aria-controls={id}
    aria-label={label}>?</button
>
<div
    {id}
    class="help-panel"
    popover="auto"
    onbeforetoggle={prepare}
    style:left={`${bounds.left}px`}
    style:bottom={`${bounds.bottom}px`}
    style:width={`min(${width}px, calc(100vw - 16px))`}
>
    {@render children()}
</div>

<style>
    .help {
        width: 20px;
        height: 20px;
        padding: 0;
        border: 1px solid var(--rail-border, #485666);
        border-radius: 999px;
        background: transparent;
        color: var(--rail-muted, #7f8e9e);
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        line-height: 18px;
        text-align: center;
        cursor: pointer;
    }
    .help:hover,
    .help[aria-expanded='true'] {
        color: var(--rail-text, #e3e9ef);
        border-color: var(--rail-focus, #b8cddd);
    }
    .help:focus-visible {
        outline: 2px solid var(--rail-focus, #b8cddd);
        outline-offset: 1px;
    }
    .help-panel {
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 10px 12px;
        border: 1px solid var(--rail-border, #485666);
        border-radius: 8px;
        background: var(--rail-surface-raised, #222c37);
        color: var(--rail-text, #e3e9ef);
        box-shadow: 0 6px 18px var(--rail-shadow, #00000066);
        font-size: 12px;
        line-height: 1.4;
    }
</style>
