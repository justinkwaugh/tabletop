<script lang="ts">
    import CardLightbox from '../privates/CardLightbox.svelte'
    import type { ShareCard } from './shareCards.js'

    let { cards }: { cards: readonly ShareCard[] } = $props()
    let open = $state<ShareCard | undefined>()
</script>

<!-- Published certificate art for traded shares, side by side; renders nothing without art. -->
{#if cards.length}
    <div class="share-cards" data-share-cards>
        {#each cards as card, index (`${card.id}:${index}`)}
            <button
                type="button"
                class="card"
                aria-label={`Show ${card.name}`}
                onclick={(event) => {
                    event.stopPropagation()
                    open = card
                }}
            >
                <img src={card.thumbnail} alt={card.name} />
            </button>
        {/each}
    </div>
    {#if open}
        <CardLightbox
            imageUrl={open.full}
            name={open.name}
            onclose={() => {
                open = undefined
            }}
        />
    {/if}
{/if}

<style>
    .share-cards {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
    }
    .card {
        padding: 0;
        border: 0;
        background: none;
        line-height: 0;
        cursor: zoom-in;
        border-radius: 4px;
    }
    .card img {
        display: block;
        height: var(--share-card-height, 64px);
        width: auto;
        border-radius: 4px;
    }
    .card:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 2px;
    }
</style>
