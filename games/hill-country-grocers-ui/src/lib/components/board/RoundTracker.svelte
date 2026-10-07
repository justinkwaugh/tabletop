<script lang="ts">
    import { ACTIONS_PER_ROUND } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        ROUND_SLOT_HEIGHT,
        ROUND_SLOT_WIDTH,
        ROUND_HEADER_RECT
    } from '$lib/utils/boardLayout.js'

    const gameSession = getGameSession()

    const TRACK_X = 200
    const TRACK_Y = 30
    const BOX_WIDTH = ROUND_SLOT_WIDTH - 5

    // The final dividend ends the game without starting another round.
    const round = $derived(
        gameSession.gameState.dividendsPaid + (gameSession.gameState.result ? 0 : 1)
    )

    const slots = $derived(
        Array.from({ length: ACTIONS_PER_ROUND }, (_, index) => ({
            index,
            taken: index < gameSession.gameState.roundTrack.length
        }))
    )
</script>

<g transform="translate({ROUND_HEADER_RECT.x} {ROUND_HEADER_RECT.y})">
    <text x="28" y="54" class="round"
        >Round <tspan class="round-number">{round}</tspan></text
    >
    <line x1={TRACK_X - 20} y1="18" x2={TRACK_X - 20} y2="68" class="divider" />
    <text x={TRACK_X} y="22" class="track-title">Dividend Track</text>
    {#each slots as slot (slot.index)}
        <g transform="translate({TRACK_X + slot.index * ROUND_SLOT_WIDTH} {TRACK_Y})">
            <rect
                width={BOX_WIDTH}
                height={ROUND_SLOT_HEIGHT}
                rx="5"
                class="slot"
                class:payday={slot.index === ACTIONS_PER_ROUND - 1}
            />
            <text x={BOX_WIDTH - 5} y="12" class="number">{slot.index + 1}</text>
            {#if slot.index === ACTIONS_PER_ROUND - 1}
                <text x={BOX_WIDTH / 2} y="24" class="pay">Pay</text>
                <text x={BOX_WIDTH / 2} y="38" class="pay">Divs</text>
            {/if}
            {#if slot.taken}
                <path
                    d="M 4 4 L {BOX_WIDTH - 4} {ROUND_SLOT_HEIGHT - 4} M {BOX_WIDTH -
                        4} 4 L 4 {ROUND_SLOT_HEIGHT - 4}"
                    class="mark"
                />
            {/if}
        </g>
    {/each}
</g>

<style>
    .round {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 24px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        fill: #4a2c12;
    }

    .round-number {
        font-size: 34px;
        font-weight: 700;
        fill: #7a1d22;
    }

    .divider {
        stroke: #b59a68;
        stroke-width: 2;
    }

    .track-title {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        fill: #7a1d22;
    }

    .slot {
        fill: rgba(253, 248, 236, 0.92);
        stroke: #7a1d22;
        stroke-width: 1.6;
    }

    .slot.payday {
        fill: #f3dfa6;
    }

    .number {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 11px;
        fill: #7a1d22;
        text-anchor: end;
    }

    .pay {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        font-weight: 700;
        fill: #7a1d22;
        text-anchor: middle;
    }

    .mark {
        fill: none;
        stroke: #2b1a10;
        stroke-width: 2.6;
        stroke-linecap: round;
    }
</style>
