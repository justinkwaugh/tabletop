<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { calledKingName } from '$lib/utils/actionDescription.js'
    import { bidName } from '$lib/utils/contractText.js'

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const turnPlayerId = $derived(state.activePlayerIds[0])
    const contract = $derived(state.contract)
</script>

<div class="header">
    <div class="who">
        {#if gameSession.isViewingHistory}
            History
        {:else if state.result}
            End of game
        {:else if gameSession.isMyTurn}
            Your turn
        {:else if turnPlayerId}
            <PlayerName playerId={turnPlayerId} possessive={true} /> turn
        {/if}
    </div>
    <div class="middle">
        <span class="deal">Hand {state.dealNumber()}/{state.totalDeals}</span>
        {#if contract}
            <span class="contract">
                {bidName(contract)} · {gameSession.getPlayerName(contract.declarerId)}
                {#if contract.calledKing}· {calledKingName(contract.calledKing)}{/if}
            </span>
        {/if}
    </div>
    {#if gameSession.canUndo}
        <button type="button" class="undo" onclick={() => gameSession.undo()}>Undo</button>
    {:else}
        <span></span>
    {/if}
</div>

<style>
    .header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 12px;
        height: 44px;
        padding: 0 14px;
        font-weight: 700;
    }

    .who {
        font-size: 1.1rem;
        color: #f2c94c;
        white-space: nowrap;
    }

    .middle {
        display: flex;
        gap: 12px;
        align-items: center;
        font-size: 0.9rem;
    }

    .deal {
        opacity: 0.75;
    }

    .undo {
        justify-self: end;
        padding: 4px 14px;
        border: 1px solid #f2c94c;
        border-radius: 999px;
        color: #f2c94c;
    }

    .undo:hover {
        background: rgb(242 201 76 / 0.15);
    }

    @media (max-width: 640px) {
        .header {
            height: auto;
            min-height: 32px;
            gap: 6px;
            padding: 2px 6px;
        }

        .who {
            font-size: 0.85rem;
        }

        .middle {
            flex-direction: column;
            gap: 0;
            font-size: 0.72rem;
        }

        .undo {
            padding: 2px 10px;
            font-size: 0.8rem;
        }
    }
</style>
