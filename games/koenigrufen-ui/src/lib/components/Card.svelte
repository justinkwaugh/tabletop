<script lang="ts">
    import { cardArt } from '$lib/utils/cardArt.js'
    import { cardLabel, cardWidthShare, type CardStyle } from '$lib/utils/cardStyle.js'

    let {
        cardId,
        style,
        selectable = false,
        chosen = false,
        dimmed = false,
        onclick
    }: {
        cardId: string
        style: CardStyle
        selectable?: boolean
        chosen?: boolean
        dimmed?: boolean
        onclick?: () => void
    } = $props()

    const label = $derived(cardLabel(cardId, style))
    const art = $derived(cardArt(cardId, style))
    const widthShare = $derived(cardWidthShare(style))
</script>

<svelte:element
    this={onclick ? 'button' : 'div'}
    type={onclick ? 'button' : undefined}
    class="card"
    class:selectable
    class:chosen
    class:dimmed
    style:--width-share={widthShare}
    disabled={onclick ? !selectable : undefined}
    role={onclick ? undefined : 'img'}
    aria-label={label}
    title={label}
    {onclick}
>
    <img src={art} alt="" draggable="false" />
</svelte:element>

<style>
    .card {
        position: relative;
        display: block;
        width: calc(var(--card-w, 80px) * var(--width-share, 1));
        height: calc(var(--card-w, 80px) * 1.8);
        padding: 0;
        overflow: hidden;
        border-radius: calc(var(--card-w, 80px) * 0.07);
        border: 1px solid #b9ae95;
        background: #f7f3ec;
        /* Shadows are unblurred offset shapes, and only the lift is animated, so cards repaint
           cheaply on phones. */
        box-shadow: 0 1px 0 rgb(0 0 0 / 0.45);
        transition: transform 120ms ease;
    }

    .card:disabled {
        cursor: default;
    }

    img {
        display: block;
        width: 100%;
        height: 100%;
        user-select: none;
    }

    .selectable {
        cursor: pointer;
        box-shadow:
            0 0 0 2px #f2c94c,
            0 3px 0 rgb(0 0 0 / 0.4);
    }

    .selectable:hover {
        transform: translateY(-8%);
    }

    .chosen {
        transform: translateY(-14%);
        box-shadow:
            0 0 0 3px #6fcf97,
            0 5px 0 rgb(0 0 0 / 0.4);
    }

    .dimmed {
        filter: brightness(0.6) saturate(0.7);
    }
</style>
