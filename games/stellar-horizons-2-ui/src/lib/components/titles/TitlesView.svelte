<script lang="ts">
    import {
        ActionType,
        TITLE_POINTS,
        TITLE_SURCHARGE,
        canBuyTitle,
        titleCost,
        titleDefinition
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import TitleCard from './TitleCard.svelte'

    // The titles laid out for anyone to buy (rulebook 5.2), priced for the viewer, with Buy under
    // each one they can buy now. Every title keeps a row for the button, so the cards stay level.
    // The titles a Player owns stay in their console.
    const gameSession = getGameSession()
    const playerId = $derived(gameSession.myPlayerId)
    const canBuy = $derived(
        playerId !== undefined && gameSession.validActionTypes.includes(ActionType.BuyTitle)
    )
</script>

<div class="titles-view">
    <p class="rule">
        Each title is worth {TITLE_POINTS} VP and costs {TITLE_SURCHARGE} IP more for every title its
        buyer already owns. A title whose prerequisite is for this turn must be bought this turn.
    </p>
    <div class="titles">
        {#each gameSession.gameState.availableTitles as titleId (titleId)}
            {@const cost = playerId
                ? titleCost(gameSession.gameState, playerId, titleId)
                : undefined}
            <div class="slot">
                <TitleCard {titleId} {cost} />
                <div class="buy">
                    {#if canBuy && playerId && canBuyTitle(gameSession.gameState, playerId, titleId)}
                        <button
                            type="button"
                            aria-label="Buy {titleDefinition(titleId).name} for {cost} IP"
                            onclick={() => gameSession.buyTitle(titleId)}>Buy · {cost} IP</button
                        >
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .titles-view {
        height: 100%;
        overflow-y: auto;
        padding: 8px 12px 16px;
    }

    .rule {
        max-width: 640px;
        margin: 0 auto 10px;
        font-size: 13px;
        color: #9fb4d0;
        text-align: center;
    }

    /* Equal rows, so every title is as tall as the tallest; auto-fit drops the empty columns, so
       the titles are centred. */
    .titles {
        display: grid;
        grid-template-columns: repeat(auto-fit, 136px);
        grid-auto-rows: 1fr;
        justify-content: center;
        gap: 10px;
    }

    .slot {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .slot > :global(.title) {
        flex: 1;
    }

    .buy {
        display: flex;
        justify-content: center;
        height: 28px;
    }

    .buy button {
        padding: 2px 14px;
        border: 1px solid #d8b964;
        border-radius: 999px;
        background: #d8b964;
        color: #14244a;
        font-size: 13px;
        font-weight: 800;
    }
</style>
