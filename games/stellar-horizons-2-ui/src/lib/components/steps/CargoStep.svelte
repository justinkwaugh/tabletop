<script lang="ts">
    import {
        canLoadFromBase,
        canUnload,
        capabilitiesOf,
        cargoCapacity,
        freeCargo,
        hasArrived,
        settlementPurchaseLimit,
        shipDefinition,
        transferPartners
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import ShipTile from '../ShipTile.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const capabilities = $derived(capabilitiesOf(gameState, playerId))
    const carriers = $derived(
        gameState
            .shipsOf(playerId)
            .filter(
                (ship) =>
                    hasArrived(ship) && (cargoCapacity(gameState, ship) > 0 || ship.settlements > 0)
            )
    )
    const settleRule = $derived(
        capabilities.settleHabitability === undefined
            ? 'You cannot settle other systems yet.'
            : capabilities.settleHabitability === 0
              ? 'You can settle any system with a revealed world.'
              : `You can settle systems with ${capabilities.settleHabitability}%+ habitability and a revealed world.`
    )
</script>

<div class="sh-step">
    <p class="hint">
        Settlements cost ${capabilities.settlementCost}B at Sol. {settleRule}
    </p>
    <div class="cards">
        {#each carriers as ship (ship.shipId)}
            {@const purchase = settlementPurchaseLimit(gameState, ship)}
            {@const partners = transferPartners(gameState, ship)}
            <ShipTile ship={shipDefinition(ship.shipId)}>
                <div class="stats">
                    At {systemName(ship.systemId)} · cargo {ship.settlements}/{cargoCapacity(
                        gameState,
                        ship
                    )}
                </div>
                <div class="buttons">
                    {#if purchase > 0}
                        <button
                            type="button"
                            onclick={() => gameSession.buySettlements(ship.shipId, 1)}
                            >Buy 1 (${capabilities.settlementCost}B)</button
                        >
                        {#if purchase > 1}
                            <button
                                type="button"
                                onclick={() => gameSession.buySettlements(ship.shipId, purchase)}
                                >Buy {purchase} (${purchase * capabilities.settlementCost}B)</button
                            >
                        {/if}
                    {/if}
                    {#if canUnload(gameState, ship)}
                        <button
                            type="button"
                            class="primary"
                            onclick={() =>
                                gameSession.unloadSettlements(ship.shipId, ship.settlements)}
                            >Unload {ship.settlements}</button
                        >
                        {#if ship.settlements > 1}
                            <button
                                type="button"
                                onclick={() => gameSession.unloadSettlements(ship.shipId, 1)}
                                >Unload 1</button
                            >
                        {/if}
                    {/if}
                    {#if canLoadFromBase(gameState, ship)}
                        <button
                            type="button"
                            onclick={() => gameSession.loadSettlement(ship.shipId)}
                            >Load 1 from base</button
                        >
                    {/if}
                    {#if ship.settlements > 0}
                        {#each partners as partner (partner.shipId)}
                            <button
                                type="button"
                                disabled={freeCargo(gameState, partner) === 0}
                                onclick={() =>
                                    gameSession.transferSettlements(ship.shipId, partner.shipId, 1)}
                                >Move 1 to {shipDefinition(partner.shipId).name}</button
                            >
                        {/each}
                    {/if}
                </div>
            </ShipTile>
        {:else}
            <p class="empty">No cargo ships are ready.</p>
        {/each}
    </div>
</div>
