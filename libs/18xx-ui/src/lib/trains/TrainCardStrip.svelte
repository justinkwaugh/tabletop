<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import CardLightbox from '../privates/CardLightbox.svelte'

    export type TrainCard = { id: string; name: string; imageUrl: string; price?: number }
    let { cards, money }: { cards: readonly TrainCard[]; money: MoneyFormat } = $props()
    let open: TrainCard | undefined = $state()
</script>

<!-- Published train cards for a purchase; the price is overlaid only when it differs from the card. -->
{#if cards.length}
    <div class="train-cards">
        {#each cards as card (card.id)}
            <button
                type="button"
                class="train-card"
                aria-label={`Show ${card.name} train card`}
                onclick={() => (open = card)}
            >
                <img src={card.imageUrl} alt={card.name} />
                {#if card.price !== undefined}<span class="train-price">{money(card.price)}</span
                    >{/if}
            </button>
        {/each}
    </div>
    {#if open}
        <CardLightbox
            imageUrl={open.imageUrl}
            name={open.name}
            onclose={() => (open = undefined)}
        />
    {/if}
{/if}

<style>
    .train-cards {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-top: 8px;
    }
    .train-card {
        position: relative;
        padding: 0;
        border: 0;
        background: none;
        line-height: 0;
        cursor: zoom-in;
        border-radius: 8px;
        filter: drop-shadow(0 2px 4px rgb(0 0 0 / 0.35));
    }
    .train-card img {
        display: block;
        width: var(--train-card-width, 180px);
        height: auto;
        border-radius: 8px;
    }
    .train-card:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 2px;
    }
    .train-price {
        position: absolute;
        right: 6px;
        bottom: 6px;
        padding: 1px 6px;
        border-radius: 4px;
        background: #f7f3ed;
        color: #252121;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.3;
    }
</style>
