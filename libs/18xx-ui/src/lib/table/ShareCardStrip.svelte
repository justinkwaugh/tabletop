<script lang="ts">
    import CardLightbox from '../privates/CardLightbox.svelte'
    import type { ShareCard } from './shareCards.js'

    let { cards, stacked = false }: { cards: readonly ShareCard[]; stacked?: boolean } = $props()
    let open = $state<ShareCard | undefined>()
    /**
     * When ``stacked``, a company's certificates form one stack with the regular shares first and
     * any president's certificate on top, fully visible; otherwise every card stands alone.
     */
    const groups = $derived.by(() => {
        if (!stacked) return cards.map((card) => [card])
        const byCompany = new Map<string, ShareCard[]>()
        for (const card of cards) {
            const group = byCompany.get(card.companyId)
            if (group) group.push(card)
            else byCompany.set(card.companyId, [card])
        }
        return [...byCompany.values()].map((group) =>
            group.toSorted((a, b) => Number(a.president) - Number(b.president))
        )
    })
</script>

<!-- Published certificate art for traded shares; a company's cards stack with each one lower so every card's stripes show. -->
{#if cards.length}
    <div class="share-cards" data-share-cards>
        {#each groups as group, groupIndex (groupIndex)}
            <div
                class="stack"
                style:--count={group.length}
                class:with-president={group.length > 1 && group.at(-1)?.president}
            >
                {#each group as card, index (`${card.id}:${index}`)}
                    <button
                        type="button"
                        class="card"
                        class:president={card.president && index > 0}
                        style:--index={index}
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
        gap: 6px;
        margin-top: 4px;
        /* The stripes sit in the top fifth of a certificate; a 30% step shows them with a margin. */
        --share-card-step: calc(var(--share-card-height, 64px) * 0.3);
    }
    .stack {
        display: grid;
        grid-template-areas: 'card';
        align-content: start;
        padding-bottom: calc(
            (var(--count) - 1) * var(--share-card-step) + var(--president-extra, 0px)
        );
    }
    /* A president's certificate sits on top with a larger drop so it stands apart from the shares. */
    .stack.with-president {
        --president-extra: calc(var(--share-card-height, 64px) * 0.35);
    }
    .card.president {
        margin-top: calc(var(--index) * var(--share-card-step) + var(--president-extra, 0px));
    }
    .card {
        grid-area: card;
        margin-top: calc(var(--index) * var(--share-card-step));
        padding: 0;
        border: 0;
        background: none;
        line-height: 0;
        cursor: zoom-in;
        border-radius: 4px;
        filter: drop-shadow(0 -1px 1px rgb(0 0 0 / 0.35));
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
