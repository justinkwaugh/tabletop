<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import { contrastingTextColor } from '../colors/contrastingTextColor.js'
    import { ArtworkLoad } from '../presentation/artworkLoad.svelte.js'
    let {
        money,
        name,
        price,
        color,
        disabled = false,
        upcoming = false,
        market = false,
        definitionId,
        onclick,
        imageUrl,
        listPrice
    }: {
        money: MoneyFormat
        name: string
        price: number
        color: string
        disabled?: boolean
        upcoming?: boolean
        market?: boolean
        definitionId: string
        onclick: () => void
        /** Published card art; once it has loaded it replaces the coloured button. */
        imageUrl?: string
        /** The printed price on the card; the price is overlaid only when it differs. */
        listPrice?: number
    } = $props()
    const artwork = new ArtworkLoad(() => imageUrl)
</script>

<button
    class:card={artwork.shown}
    class:awaiting-image={artwork.awaiting}
    class:upcoming
    style:background={artwork.shown ? undefined : color}
    style:color={artwork.shown ? undefined : contrastingTextColor(color)}
    data-depot-train={market ? undefined : definitionId}
    aria-label={`${name} for ${money(price)}${upcoming ? ', upcoming' : market ? ' from Market' : ''}`}
    disabled={disabled || upcoming}
    {onclick}
>
    {#if imageUrl}
        <img
            src={imageUrl}
            alt=""
            hidden={!artwork.shown}
            onload={artwork.markLoaded}
            {@attach artwork.markLoadedIfCached}
        />
    {/if}
    {#if !artwork.shown}
        <span>{name}</span><span class="price">{money(price)}</span>
    {:else if listPrice === undefined || price !== listPrice}
        <span class="card-price">{money(price)}</span>
    {/if}
</button>

<style>
    /* Held back so artwork that arrives quickly from cache replaces it unseen. */
    button.awaiting-image {
        animation: reveal-stand-in 1ms 200ms backwards;
    }
    @keyframes reveal-stand-in {
        from {
            visibility: hidden;
        }
    }
    button {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 28px;
        min-width: 100px;
        padding: 4px 8px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        font: inherit;
        font-size: 15px;
        font-weight: 400;
        line-height: 1.25;
        filter: var(--rail-phase-filter, saturate(0.6));
        cursor: pointer;
    }
    button > span {
        font-size: 15px;
    }
    .price {
        font-weight: 600;
    }
    button:disabled {
        opacity: var(--rail-phase-opacity, 0.5);
        cursor: default;
    }
    button.upcoming {
        border-style: dashed;
        cursor: not-allowed;
    }
    button:hover:not(:disabled) {
        filter: var(--rail-phase-filter, saturate(0.6) brightness(0.95));
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    button.card {
        position: relative;
        display: block;
        min-width: 0;
        padding: 0;
        border: 0;
        border-radius: 8px;
        background: none;
        overflow: hidden;
        filter: drop-shadow(0 2px 4px rgb(0 0 0 / 0.35));
        transition: transform 120ms ease-out;
    }
    button.card img {
        display: block;
        width: var(--train-card-width, 150px);
        height: auto;
        border-radius: 8px;
    }
    button.card:hover:not(:disabled) {
        filter: drop-shadow(0 3px 6px rgb(0 0 0 / 0.45));
        transform: translateY(-1px);
    }
    button.card:disabled {
        opacity: 0.55;
        filter: grayscale(0.6);
    }
    button.card.upcoming {
        outline: 2px dashed var(--rail-muted, #887969);
        outline-offset: -2px;
    }
    .card-price {
        position: absolute;
        right: 6px;
        bottom: 6px;
        padding: 1px 6px;
        border-radius: 4px;
        background: #f7f3ed;
        color: #252121;
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.4);
    }
</style>
