<script lang="ts">
    import type { Snippet } from 'svelte'
    import { showModal } from './modalDialog.js'

    let {
        label,
        onclose,
        children
    }: {
        label: string
        onclose: () => void
        children: Snippet
    } = $props()
</script>

<dialog class="lightbox" aria-label={label} use:showModal {onclose} onclick={onclose}>
    <!-- Inert so a read-only view never focuses or activates the controls its content draws. -->
    <div class="lightbox-content" inert>{@render children()}</div>
</dialog>

<style>
    .lightbox[open] {
        display: grid;
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        margin: 0;
        padding: 12px;
        border: 0;
        background: transparent;
        overflow-y: auto;
        overscroll-behavior: contain;
    }
    .lightbox::backdrop {
        background: rgb(0 0 0 / 0.62);
    }
    .lightbox-content {
        margin: auto;
        pointer-events: none;
        animation: rise 140ms ease-out;
    }
    @keyframes rise {
        from {
            transform: translateY(6px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .lightbox-content {
            animation: none;
        }
    }
</style>
