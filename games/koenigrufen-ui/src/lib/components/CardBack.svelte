<script lang="ts">
    import { ClassicCardBack } from '$lib/images/classicCards.generated.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cardWidthShare } from '$lib/utils/cardStyle.js'

    // Both packs share the Industrie und Glück's printed back, standing in the chosen pack's
    // proportion so a card keeps its size as it turns over.
    const gameSession = getGameSession()
    const widthShare = $derived(cardWidthShare(gameSession.cardStyle))
</script>

<div class="back" style:--width-share={widthShare} aria-label="Face-down card">
    <img src={ClassicCardBack} alt="" draggable="false" />
</div>

<style>
    .back {
        width: calc(var(--card-w, 80px) * var(--width-share, 1));
        height: calc(var(--card-w, 80px) * 1.8);
        overflow: hidden;
        border-radius: calc(var(--card-w, 80px) * 0.07);
        border: 1px solid #b9ae95;
        box-shadow: 0 1px 0 rgb(0 0 0 / 0.45);
        background: #f7f3ec;
    }

    img {
        display: block;
        width: 100%;
        height: 100%;
        user-select: none;
    }
</style>
