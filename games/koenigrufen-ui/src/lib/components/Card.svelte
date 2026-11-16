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

    // A card that cannot be chosen stays focusable, so the keyboard can still open it to look.
    function activate() {
        if (selectable) onclick?.()
    }
</script>

<svelte:element
    this={onclick ? 'button' : 'div'}
    type={onclick ? 'button' : undefined}
    class="card"
    class:selectable
    class:chosen
    class:dimmed
    style:--width-share={widthShare}
    aria-disabled={onclick ? !selectable : undefined}
    role={onclick ? undefined : 'img'}
    aria-label={label}
    title={label}
    onclick={onclick ? activate : undefined}
>
    <span class="face"><img src={art} alt="" draggable="false" /></span>
</svelte:element>

<style>
    /* Depth is a flat shape behind the face, the selection rings are outlines, and a dimmed card is
       covered by a flat dark fill: nothing here is drawn offscreen, so cards repaint cheaply on
       phones (docs/phone-rendering.md). Only the lift is animated. */
    .card {
        --radius: calc(var(--card-w, 80px) * 0.07);
        --drop: 1px;
        --drop-color: rgb(0 0 0 / 0.45);
        position: relative;
        display: block;
        width: calc(var(--card-w, 80px) * var(--width-share, 1));
        height: calc(var(--card-w, 80px) * 1.8);
        padding: 0;
        border: none;
        background: none;
        transition: transform 120ms ease;
    }

    .card::before {
        content: '';
        position: absolute;
        inset: var(--drop) 0 calc(-1 * var(--drop));
        border-radius: var(--radius);
        background: var(--drop-color);
    }

    .face {
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
        border-radius: var(--radius);
        border: 1px solid #b9ae95;
        background: #f7f3ec;
    }

    .card[aria-disabled='true'] {
        cursor: default;
    }

    img {
        display: block;
        width: 100%;
        height: 100%;
        user-select: none;
    }

    .selectable {
        --drop: 3px;
        --drop-color: rgb(0 0 0 / 0.4);
        cursor: pointer;
    }

    .selectable .face {
        outline: 2px solid #f2c94c;
    }

    .selectable:hover {
        transform: translateY(-8%);
    }

    .chosen {
        --drop: 5px;
        --drop-color: rgb(0 0 0 / 0.4);
        transform: translateY(-14%);
    }

    .chosen .face {
        outline: 3px solid #6fcf97;
    }

    .dimmed .face::after {
        content: '';
        position: absolute;
        inset: 0;
        background: rgb(0 0 0 / 0.4);
    }
</style>
