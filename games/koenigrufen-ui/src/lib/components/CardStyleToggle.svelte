<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    const style = $derived(gameSession.cardStyle)
</script>

<div class="toggle" role="group" aria-label="Card style">
    <span class="title">Cards</span>
    <label title="Red pip cards marked 10 9 8 7 like the black suits">
        <input
            type="checkbox"
            checked={style.uniformPips}
            onchange={(event) =>
                gameSession.setCardStyle({ uniformPips: event.currentTarget.checked })}
        />
        Red 10–7
    </label>
    <label title="The original Tarock art, as printed, without added indices">
        <input
            type="checkbox"
            checked={style.classicDeck}
            onchange={(event) =>
                gameSession.setCardStyle({ classicDeck: event.currentTarget.checked })}
        />
        Industrie und Glück
    </label>
</div>

<style>
    .toggle {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px 10px;
        padding: 4px 10px;
        border-radius: 10px;
        background: rgb(10 25 16 / 0.75);
        border: 1px solid rgb(241 231 207 / 0.3);
        color: #f1e7cf;
        font-size: 0.8rem;
    }

    .title {
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.7;
    }

    label {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
    }
</style>
