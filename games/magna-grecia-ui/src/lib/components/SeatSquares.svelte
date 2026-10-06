<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        playerIds,
        currentPlayerId,
        size = 34
    }: { playerIds: string[]; currentPlayerId?: string; size?: number } = $props()

    const gameSession = getGameSession()

    const seats = $derived(
        playerIds.map((playerId) => {
            const name = gameSession.getPlayerName(playerId)
            return {
                playerId,
                name,
                initial: name.charAt(0).toUpperCase(),
                color: gameSession.colors.getPlayerUiColor(playerId),
                textColor: gameSession.colors.getPlayerTextColorValue(playerId)
            }
        })
    )
</script>

<ol class="seats" style:--size="{size}px" aria-label="Player order">
    {#each seats as seat (seat.playerId)}
        <li
            class:current={seat.playerId === currentPlayerId}
            style:--seat={seat.color}
            style:--seat-text={seat.textColor}
            title={seat.name}
        >
            <span class="initial">{seat.initial}</span>
        </li>
    {/each}
</ol>

<style>
    .seats {
        display: flex;
        align-items: center;
        gap: calc(var(--size) * 0.26);
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .seats li {
        display: grid;
        place-items: center;
        width: var(--size);
        height: var(--size);
        border-radius: calc(var(--size) * 0.18);
        background: var(--seat);
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
        color: var(--seat-text);
        font-family: system-ui, sans-serif;
        font-size: calc(var(--size) * 0.59);
        font-weight: 700;
    }

    /* Centres the capital itself rather than the font's line box. */
    .initial {
        display: block;
        line-height: 1;
        text-box: trim-both cap alphabetic;
    }

    .seats li.current {
        outline: 3px solid #4a2c12;
        outline-offset: 3px;
    }
</style>
