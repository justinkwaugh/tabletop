<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { playerIds, currentPlayerId }: { playerIds: string[]; currentPlayerId?: string } = $props()

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

<ol class="seats" aria-label="Player order">
    {#each seats as seat (seat.playerId)}
        <li
            class:current={seat.playerId === currentPlayerId}
            style:--seat={seat.color}
            style:--seat-text={seat.textColor}
            title={seat.name}
        >
            {seat.initial}
        </li>
    {/each}
</ol>

<style>
    .seats {
        display: flex;
        align-items: center;
        gap: 9px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .seats li {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 6px;
        background: var(--seat);
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
        color: var(--seat-text);
        font-family: system-ui, sans-serif;
        font-size: 20px;
        font-weight: 700;
    }

    .seats li.current {
        outline: 3px solid #4a2c12;
        outline-offset: 3px;
    }
</style>
