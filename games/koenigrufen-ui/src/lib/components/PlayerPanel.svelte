<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // A page of a Tarock score pad: the running total with the last few hands beside it, then
    // where the player stands in this hand and what they have said.
    let { playerId }: { playerId: string } = $props()

    const RecentHands = 4

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const player = $derived(state.getPlayerState(playerId))
    const fill = $derived(gameSession.colors.getPlayerBgColorValue(playerId))
    const ink = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const active = $derived(state.activePlayerIds.includes(playerId))
    const facts = $derived(gameSession.panelFactsOf(playerId))
    const won = $derived(gameSession.wonCardsOf(playerId))
    const recent = $derived(
        gameSession.scoreSheet.rows
            .slice(-RecentHands)
            .map((row) => ({ hand: row.hand, change: row.result.scoreChanges[playerId] ?? 0 }))
    )

    function signed(value: number): string {
        return value > 0 ? `+${value}` : String(value)
    }
</script>

<div class="panel" class:active>
    <div class="name" style:background={fill} style:color={ink}>
        <span class="player">{gameSession.getPlayerName(playerId)}</span>
        <span class="roles">
            {#if active}<span class="turn">Turn</span>{/if}
            {facts.seatRoles.join(' · ')}
        </span>
    </div>
    <div class="body">
        <div class="tally">
            <div class="score">
                <span class="label">Score</span>
                <span class="value">{player.score}</span>
            </div>
            {#if recent.length > 0}
                <ol class="recent" aria-label="Last hands">
                    {#each recent as { hand, change } (hand)}
                        <li
                            class:up={change > 0}
                            class:down={change < 0}
                            title="Hand {hand}: {signed(change)}"
                        >
                            {signed(change)}
                        </li>
                    {/each}
                </ol>
            {/if}
        </div>
        <div class="hand">
            <span class="standing">{facts.standing ?? ''}</span>
            <span class="cards">{player.handCount} in hand · {won} won</span>
        </div>
        {#if facts.said.length > 0}
            <div class="said"><span class="label">Said</span> {facts.said.join(' · ')}</div>
        {/if}
    </div>
</div>

<style>
    .panel {
        overflow: hidden;
        border-radius: 10px;
        border: 1px solid #b9ae95;
        background: #fbf8ef;
        color: #2a2116;
        box-shadow: 0 1px 0 rgb(0 0 0 / 0.4);
    }

    /* A thicker gold edge, its extra width taken from the margin so nothing shifts. */
    .panel.active {
        margin: -1px;
        border: 2px solid #f2c94c;
    }

    .name {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        padding: 4px 10px;
        font-weight: 700;
    }

    .roles {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 400;
        font-size: 0.75rem;
        opacity: 0.9;
    }

    .turn {
        padding: 0 6px;
        border-radius: 4px;
        background: #f2c94c;
        color: #2a2116;
        font-weight: 700;
    }

    /* Ruled like a score pad: a faint line under each entry. */
    .body {
        display: flex;
        flex-direction: column;
        padding: 4px 10px 6px;
        font-family: Georgia, 'Times New Roman', serif;
    }

    .body > * {
        padding: 3px 0;
        border-bottom: 1px solid #e4dccb;
    }

    .body > :last-child {
        border-bottom: none;
    }

    .tally {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .score {
        display: flex;
        align-items: baseline;
        gap: 8px;
    }

    .label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        opacity: 0.6;
    }

    /* Names and scores are written in by hand; the rest is the sheet's printing. */
    .player,
    .value,
    .recent {
        font-family: 'Koenigrufen Pen', 'Segoe Print', cursive;
        font-weight: 700;
    }

    .player {
        font-size: 1.2rem;
        line-height: 1.2;
    }

    .value {
        font-size: 1.7rem;
        line-height: 1;
    }

    .recent {
        display: flex;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 1.1rem;
        line-height: 1.1;
    }

    .recent li {
        min-width: 2.2em;
        padding: 0 4px;
        border-left: 1px solid #e4dccb;
        text-align: right;
    }

    /* The pen has one weight, so the latest hand stands out by size. */
    .recent li:last-child {
        font-size: 1.2em;
    }

    .up {
        color: #2c6e49;
    }

    .down {
        color: #9b2c2c;
    }

    .hand {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
    }

    .standing {
        font-weight: 700;
        font-size: 0.9rem;
    }

    .said {
        font-size: 0.85rem;
    }

    .cards {
        font-size: 0.8rem;
        opacity: 0.7;
        white-space: nowrap;
    }
</style>
