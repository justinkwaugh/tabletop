<script lang="ts">
    import { Deck } from '@tabletop/koenigrufen'
    import Card from '$lib/components/Card.svelte'
    import '../../app.css'

    // Every card in every card style, for checking the art.
    const styles = [
        { name: 'Tarot Nouveau', style: { uniformPips: false, classicDeck: false } },
        { name: 'Tarot Nouveau, red 10–7', style: { uniformPips: true, classicDeck: false } },
        { name: 'Industrie und Glück', style: { uniformPips: false, classicDeck: true } },
        { name: 'Industrie und Glück, red 10–7', style: { uniformPips: true, classicDeck: true } }
    ]
</script>

<svelte:head><title>Königrufen cards</title></svelte:head>

<main>
    {#each styles as { name, style } (name)}
        <h2>{name}</h2>
        <div class="deck">
            {#each Deck as card (card.id)}
                <Card cardId={card.id} {style} />
            {/each}
        </div>
    {/each}
</main>

<style>
    main {
        --card-w: 99px;
        padding: 16px;
        background: #1f4d31;
        color: #f1e7cf;
        min-height: 100vh;
    }

    h2 {
        margin: 12px 0 6px;
        font-weight: 700;
    }

    .deck {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
</style>
