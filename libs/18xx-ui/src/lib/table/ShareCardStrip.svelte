<script lang="ts">
    import CardLightbox from '../privates/CardLightbox.svelte'
    import type { ShareCard } from './shareCards.js'

    let {
        cards,
        stacked = false,
        sign
    }: {
        cards: readonly ShareCard[]
        stacked?: boolean
        /** Marks the set as acquired (+) or disposed of (−) in front of the cards. */
        sign?: 'plus' | 'minus'
    } = $props()
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
        {#if sign}<span class="sign" class:minus={sign === 'minus'} aria-hidden="true"
                >{sign === 'plus' ? '+' : '−'}</span
            >{/if}
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
        align-items: flex-start;
        gap: 6px;
        margin-top: 4px;
        /* The two stripes end at 11.5% of a certificate's height and the marble panel starts at
           14.7%; an 18% step shows the stripes with a sliver of panel, not enough to read as a card. */
        --share-card-step: calc(var(--share-card-height, 64px) * 0.18);
        --share-card-ratio: 0.72;
    }
    .sign {
        align-self: center;
        margin-right: 2px;
        font-size: calc(var(--share-card-height, 64px) * 0.4);
        font-weight: 700;
        line-height: 1;
        color: var(--rail-text, #181818);
    }
    .sign.minus {
        color: var(--rail-negative, #aa352e);
    }
    .stack {
        position: relative;
        width: calc(var(--share-card-height, 64px) * var(--share-card-ratio));
        height: calc(var(--share-card-height, 64px) + (var(--count) - 1) * var(--share-card-step));
    }
    .card {
        position: absolute;
        top: calc(var(--index) * var(--share-card-step));
        left: 0;
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
