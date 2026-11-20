<script lang="ts">
    import { DeskScoreLineRow } from '$lib/model/boardFocus.svelte.js'
    import { scoreLineOf, scoreWords } from '$lib/model/seatPanel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { StarPath } from '$lib/utils/pieceShapes.js'

    /** Contract, Supply: a desk's board draws no score ring, so this line stands in for it. */
    let { stacked = false }: { stacked?: boolean } = $props()

    const gameSession = getGameSession()

    let seats = $derived(
        scoreLineOf(gameSession.gameState, (playerId) => gameSession.getPlayerName(playerId))
    )
</script>

<ul
    class="line"
    class:stacked
    style:grid-auto-rows={stacked ? `${DeskScoreLineRow}px` : undefined}
    aria-label="Scores"
    data-score-line
>
    {#each seats as seat (seat.playerId)}
        {@const words = `${seat.name}: ${scoreWords(seat.score, seat.leading)}`}
        {@const paint = gameSession.paintOf(seat.playerId)}
        <li
            class="seat"
            class:leading={seat.leading}
            aria-label={words}
            title={words}
            data-score-of={seat.playerId}
            data-score={seat.score}
            data-leading={seat.leading ? '' : undefined}
        >
            <span
                class="disc"
                style:background-color={paint.fill}
                style:border-color={paint.edge}
                aria-hidden="true"
            ></span>
            <span class="name" aria-hidden="true">{seat.name}</span>
            <span class="score" aria-hidden="true">{seat.score}</span>
            {#if seat.leading}
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    data-score-leader
                >
                    <path d={StarPath} fill="currentColor"></path>
                </svg>
            {/if}
        </li>
    {/each}
</ul>

<style>
    .line {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
        height: 2.25rem;
        margin: 0 0 0 auto;
        padding: 0 0.5rem;
        overflow: hidden;
        border: 2px solid var(--feudum-frame);
        border-radius: 0.5rem;
        background: var(--feudum-surface-raised);
        color: var(--feudum-text);
        font-size: 0.875rem;
        list-style: none;
        pointer-events: auto;
    }

    .line.stacked {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 0.5rem;
        row-gap: 0;
        flex: none;
        height: auto;
        margin: 0;
        padding: 4px 0.5rem;
    }

    .seat {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        min-width: 0;
        padding: 0 0.25rem;
        border: 1px solid transparent;
        border-radius: 0.375rem;
        white-space: nowrap;
    }

    /* Never the accent colour, which asks for a press. */
    .seat.leading {
        border-color: var(--feudum-heading);
        color: var(--feudum-heading);
    }

    .disc {
        flex: none;
        width: 0.75rem;
        height: 0.75rem;
        border: 2px solid;
        border-radius: 50%;
    }

    .name {
        min-width: 0;
        max-width: 6rem;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .score {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
    }
</style>
