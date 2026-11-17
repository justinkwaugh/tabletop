<script lang="ts">
    import type { Snippet } from 'svelte'
    import { clickedBackdrop, showModal } from './modalDialog.js'

    let {
        label,
        title,
        closeLabel,
        maxWidth,
        onclose,
        children
    }: {
        label: string
        title: string
        closeLabel: string
        maxWidth: string
        onclose: () => void
        children: Snippet
    } = $props()
    let dialog = $state<HTMLDialogElement>()

    function closeOutside(event: MouseEvent) {
        if (dialog && clickedBackdrop(dialog, event)) dialog.close()
    }
</script>

<dialog
    class="modal-panel"
    aria-label={label}
    style:--modal-max-width={maxWidth}
    bind:this={dialog}
    use:showModal
    {onclose}
    onclick={closeOutside}
>
    <header>
        <h2>{title}</h2>
        <button class="close" aria-label={closeLabel} onclick={() => dialog?.close()}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
                ><path
                    d="m4 4 8 8m0-8-8 8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                ></path></svg
            >
        </button>
    </header>
    <div class="body">{@render children()}</div>
</dialog>

<style>
    .modal-panel[open] {
        display: flex;
        flex-direction: column;
    }
    .modal-panel {
        margin: auto;
        box-sizing: border-box;
        width: min(var(--modal-max-width), calc(100vw - 40px));
        max-height: calc(100dvh - 48px);
        padding: 0;
        border: 1px solid var(--rail-border, #c3b39e);
        border-radius: 10px;
        background: var(--rail-surface, #faf7f1);
        color: var(--rail-text, #463e35);
        box-shadow: 0 20px 70px var(--rail-shadow, #16120d55);
        overscroll-behavior: contain;
    }
    .modal-panel::backdrop {
        background: var(--rail-backdrop, #17141099);
    }
    header {
        display: flex;
        flex: none;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 10px 16px;
        border-bottom: 1px solid var(--rail-border, #ded4c7);
    }
    h2 {
        margin: 0;
        font-size: 17px;
        font-weight: 650;
    }
    .close {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: var(--rail-text, #766653);
        cursor: pointer;
    }
    .close:hover {
        background: var(--rail-surface-raised, #e9e1d5);
    }
    .body {
        flex: 0 1 auto;
        min-height: 0;
        padding: 12px 12px 20px;
        overflow-y: auto;
    }
    @media (max-height: 560px) {
        .modal-panel {
            width: calc(100vw - 16px);
            max-height: calc(100dvh - 16px);
        }
        header {
            padding: 4px 8px 4px 16px;
        }
        .body {
            padding: 4px 8px 8px;
        }
    }
</style>
