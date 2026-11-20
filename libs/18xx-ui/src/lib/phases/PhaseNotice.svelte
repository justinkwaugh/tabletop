<script lang="ts">
    import { clickedBackdrop } from '../presentation/modalDialog.js'
    import type { PhaseNotice } from '../session/titlePresentation.js'
    let { notice }: { notice: PhaseNotice } = $props()
    let dialog = $state<HTMLDialogElement>()
    const titleId = $props.id()
    function open() {
        dialog?.showModal()
    }
    function closeOutside(event: MouseEvent) {
        if (dialog && clickedBackdrop(dialog, event)) dialog.close()
    }
</script>

<!-- A rule in force under the phase strip; its full rules open in a dialog. -->
<button
    class="phase-notice"
    aria-haspopup="dialog"
    title={`Show the rules of the ${notice.title}`}
    onclick={open}>{notice.label}</button
>

<dialog bind:this={dialog} aria-labelledby={titleId} onclick={closeOutside}>
    <header>
        <h2 id={titleId}>{notice.title}</h2>
        <button class="close" aria-label="Close" onclick={() => dialog?.close()}>
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
    <div class="body">
        {#if notice.summary}<p class="summary">{notice.summary}</p>{/if}
        <ul>
            {#each notice.rules as rule (rule)}<li>{rule}</li>{/each}
        </ul>
    </div>
</dialog>

<style>
    .phase-notice {
        display: block;
        width: 100%;
        padding: 4px 12px;
        border: 0;
        border-top: 1px solid var(--rail-border, #ded4c7);
        background: color-mix(in oklab, #b3261e 26%, var(--rail-surface, #faf7f1));
        color: var(--rail-text, #463e35);
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-decoration: underline;
        text-underline-offset: 3px;
        cursor: pointer;
    }
    .phase-notice:hover {
        background: color-mix(in oklab, #b3261e 36%, var(--rail-surface, #faf7f1));
    }
    .phase-notice:focus-visible,
    .close:focus-visible {
        outline: 2px solid var(--rail-focus, #9e7752);
        outline-offset: -2px;
    }
    dialog {
        margin: auto;
        box-sizing: border-box;
        width: min(520px, calc(100vw - 40px));
        max-height: calc(100dvh - 48px);
        padding: 0;
        border: 1px solid var(--rail-border, #c3b39e);
        border-radius: 10px;
        background: var(--rail-surface, #faf7f1);
        color: var(--rail-text, #463e35);
    }
    dialog::backdrop {
        background: var(--rail-backdrop, #17141099);
    }
    header {
        display: flex;
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
        padding: 12px 18px 16px;
        font-size: 14px;
        line-height: 1.45;
    }
    .summary {
        margin: 0 0 8px;
    }
    ul {
        margin: 0;
        padding-left: 18px;
        list-style: disc;
    }
    li + li {
        margin-top: 6px;
    }
</style>
