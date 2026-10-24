<script lang="ts">
    import {
        CardDeck,
        deckShortName,
        romanLevel,
        type CardLevel
    } from '@tabletop/stellar-horizons-2'
    import { cardBackText } from '$lib/utils/cards.js'

    // What everyone sees of a card in another Player's hand: its deck and level.
    let { deck, level }: { deck: CardDeck; level: CardLevel } = $props()
</script>

<span
    class="back"
    class:genetic={deck === CardDeck.Genetic}
    title={cardBackText(deck, level)}
    aria-label={cardBackText(deck, level)}
>
    <span class="kind">{deckShortName(deck)}</span>
    <span class="level">{romanLevel(level)}</span>
</span>

<style>
    .back {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        width: 44px;
        height: 58px;
        box-sizing: border-box;
        border: 1px solid #b08d3c;
        border-radius: 5px;
        background: #11161f;
        color: #c9b88d;
    }

    .back.genetic {
        color: #a9c98a;
    }

    .kind {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .level {
        font-size: 15px;
        font-weight: 800;
    }
</style>
