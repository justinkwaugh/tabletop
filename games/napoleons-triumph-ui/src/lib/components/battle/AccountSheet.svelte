<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { Attachment } from 'svelte/attachments'
    import SwelledRule from '$lib/components/SwelledRule.svelte'

    /** The small sheet, in the middle of the screen, that accounts for a number the action area shows. */
    let {
        label,
        title,
        description,
        children,
        onclose
    }: {
        label: string
        title: Snippet
        description: Snippet
        children: Snippet
        onclose: () => void
    } = $props()

    const shownAsModal: Attachment<HTMLDialogElement> = (dialog) => {
        dialog.showModal()
    }

    function dismiss(event: MouseEvent & { currentTarget: HTMLDialogElement }) {
        if (event.target === event.currentTarget) {
            event.currentTarget.close()
        }
    }
</script>

<dialog class="nt-account" aria-label={label} {@attach shownAsModal} {onclose} onclick={dismiss}>
    <div class="nt-account-sheet">
        <header>
            <h2>{@render title()}</h2>
            <form method="dialog">
                <button class="nt-account-close">Close</button>
            </form>
        </header>
        <SwelledRule />
        <p>{@render description()}</p>
        <SwelledRule />
        {@render children()}
    </div>
</dialog>

<style>
    .nt-account {
        --nt-ground: #f9f6ee;
        width: min(480px, 94vw);
        max-width: none;
        max-height: 94dvh;
        margin: auto;
        padding: 0;
        border: 0;
        border-radius: 5px;
        background: var(--nt-ground);
        color: var(--nt-ink);
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    .nt-account::backdrop {
        background: rgba(43, 38, 32, 0.55);
    }

    .nt-account-sheet {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px 18px 14px;
    }

    header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
    }

    h2 {
        font-size: 19px;
        font-style: italic;
    }

    h2 :global(b) {
        font-size: 21px;
        font-style: normal;
    }

    .nt-account-close {
        font-size: 15px;
        font-style: italic;
        cursor: pointer;
    }

    .nt-account-close:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
    }

    p {
        font-size: 14px;
        line-height: 1.35;
        opacity: 0.75;
    }
</style>
