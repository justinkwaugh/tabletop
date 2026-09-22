<script lang="ts">
    let {
        imageUrl,
        name,
        onclose
    }: {
        imageUrl: string
        name: string
        onclose: () => void
    } = $props()
    function showModal(node: HTMLDialogElement) {
        node.showModal()
    }
</script>

<!-- Published card art centred over a full-screen mask; the size follows the viewport. -->
<dialog
    class="card-lightbox"
    aria-label={name}
    data-card-image
    use:showModal
    {onclose}
    onclick={onclose}
>
    <img src={imageUrl} alt={name} />
</dialog>

<style>
    .card-lightbox {
        margin: auto;
        padding: 0;
        border: 0;
        background: transparent;
        max-width: none;
        max-height: none;
        overflow: visible;
    }
    .card-lightbox::backdrop {
        background: rgb(0 0 0 / 0.62);
    }
    .card-lightbox img {
        display: block;
        /* Portrait cards (about 3:5): fill the shorter viewport dimension with a margin. */
        width: min(92vw, calc((100dvh - 48px) * 0.6));
        max-height: calc(100dvh - 48px);
        height: auto;
        border-radius: 14px;
        box-shadow: 0 18px 48px rgb(0 0 0 / 0.5);
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
        .card-lightbox img {
            animation: none;
        }
    }
</style>
