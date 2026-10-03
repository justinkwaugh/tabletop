<script lang="ts">
    import type { ActionCard } from '@tabletop/magna-grecia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import AllowanceList from './AllowanceList.svelte'
    import SeatSquares from './SeatSquares.svelte'

    let { card, compact = false }: { card: ActionCard; compact?: boolean } = $props()

    const gameSession = getGameSession()
</script>

<div class="upcoming" class:compact>
    <span class="next-label">Next</span>
    <div class="details">
        <AllowanceList
            {card}
            label="Next round's actions"
            size={compact ? 18 : 32}
            bonusStyle={compact ? 'parens' : 'superscript'}
        />
        <div class="section">
            <SeatSquares
                playerIds={gameSession.gameState.turnOrderForCard(card)}
                size={compact ? 20 : 34}
            />
        </div>
    </div>
</div>

<style>
    .upcoming,
    .details {
        display: flex;
        align-items: center;
        gap: 28px;
    }

    .upcoming {
        color: #4a2c12;
        font-family: 'Libre Baskerville', Georgia, serif;
        white-space: nowrap;
        opacity: 0.85;
    }

    .next-label {
        font-size: 30px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .section {
        display: flex;
        align-items: center;
        height: 44px;
        padding-left: 28px;
        border-left: 2px solid #c9b394;
    }

    .compact {
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
        opacity: 1;
    }

    .compact .next-label {
        font-size: 11px;
        letter-spacing: 0.14em;
        text-align: center;
    }

    .compact .details {
        justify-content: space-between;
        gap: 4px;
    }

    .compact .section {
        height: auto;
        padding-left: 0;
        border-left: none;
    }
</style>
