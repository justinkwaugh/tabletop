<script lang="ts">
    import { ACTIONS_PER_ROUND } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { ROUND_SLOT_WIDTH, ROUND_TRACK_X, ROUND_TRACK_Y } from '$lib/utils/boardLayout.js'
    import PlayerToken from '../icons/PlayerToken.svelte'

    const gameSession = getGameSession()

    // The final dividend ends the game without starting another round.
    const round = $derived(
        gameSession.gameState.dividendsPaid + (gameSession.gameState.result ? 0 : 1)
    )

    const slots = $derived(
        Array.from({ length: ACTIONS_PER_ROUND }, (_, index) => ({
            index,
            playerId: gameSession.gameState.roundTrack[index]
        }))
    )
</script>

<g transform="translate({ROUND_TRACK_X + ACTIONS_PER_ROUND * ROUND_SLOT_WIDTH} {ROUND_TRACK_Y})">
    <text x="62" y="30" class="label">Round</text>
    <text x="62" y="66" class="label number-big">{round}</text>
</g>
{#each slots as slot (slot.index)}
    <g transform="translate({ROUND_TRACK_X + slot.index * ROUND_SLOT_WIDTH} {ROUND_TRACK_Y})">
        <rect
            width={ROUND_SLOT_WIDTH - 6}
            height="76"
            rx="6"
            class="slot"
            class:payday={slot.index === ACTIONS_PER_ROUND - 1}
        />
        <text x={ROUND_SLOT_WIDTH - 12} y="18" class="number">{slot.index + 1}</text>
        {#if slot.playerId}
            <PlayerToken
                x={(ROUND_SLOT_WIDTH - 6) / 2}
                y={46}
                color={gameSession.colors.getPlayerUiColor(slot.playerId)}
                textColor={gameSession.colors.getPlayerTextColorValue(slot.playerId)}
                initial={gameSession.getPlayerName(slot.playerId).charAt(0).toUpperCase()}
            />
        {/if}
    </g>
{/each}
<text
    x={ROUND_TRACK_X + ACTIONS_PER_ROUND * ROUND_SLOT_WIDTH - 6}
    y={ROUND_TRACK_Y + 94}
    class="note">Dividends are paid when the 11th space fills</text
>

<style>
    .label {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 18px;
        font-weight: 700;
        fill: #7a1d22;
    }

    .label {
        text-anchor: middle;
    }

    .number-big {
        font-size: 30px;
    }

    .slot {
        fill: #fdf8ec;
        stroke: #7a1d22;
        stroke-width: 2;
    }

    .slot.payday {
        fill: #f3dfa6;
    }

    .number {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        fill: #7a1d22;
        text-anchor: end;
    }

    .note {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 14px;
        font-style: italic;
        fill: #7a4a2e;
        text-anchor: end;
    }
</style>
