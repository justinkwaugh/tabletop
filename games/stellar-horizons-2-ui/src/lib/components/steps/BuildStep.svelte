<script lang="ts">
    import {
        CLONING_COST,
        REMOTE_REPAIR_POINT_COST,
        RepairMethod,
        buildLocations,
        canRepair,
        cloningBases,
        dockRepairCapacity,
        remoteFullRepairCost,
        scrapRefund,
        shipDefinition,
        shipsAvailableToBuild
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import ShipCard from '../ShipCard.svelte'
    import ShipTile from '../ShipTile.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const cash = $derived(gameState.getPlayerState(playerId).cash)
    const available = $derived(shipsAvailableToBuild(gameState, playerId))
    const fleet = $derived(gameState.shipsOf(playerId))
    const damaged = $derived(fleet.filter((ship) => ship.damage > 0))
    const clonable = $derived(cloningBases(gameState, playerId))
</script>

<div class="sh-step">
    <div class="section-title">Shipyard <span class="cash">${cash}B available</span></div>
    <div class="cards">
        {#each available as ship (ship.id)}
            <ShipTile {ship}>
                {#each buildLocations(gameState, playerId, ship.id) as systemId (systemId)}
                    <button
                        type="button"
                        disabled={ship.cost > cash}
                        title={systemId === 'sol'
                            ? 'Build at Sol'
                            : `Build at ${systemName(systemId)}`}
                        onclick={() => gameSession.buildShip(ship.id, systemId)}
                    >
                        ${ship.cost}B{systemId === 'sol' ? '' : ` · ${systemName(systemId)}`}
                    </button>
                {/each}
            </ShipTile>
        {:else}
            <p class="empty">Every ship your technology allows is already in service.</p>
        {/each}
    </div>

    {#if damaged.length > 0}
        <div class="section-title">Repairs</div>
        <div class="cards">
            {#each damaged as ship (ship.shipId)}
                {@const dock = dockRepairCapacity(gameState, ship)}
                <ShipCard ship={shipDefinition(ship.shipId)}>
                    <div class="stats">{ship.damage} damage</div>
                    <div class="buttons">
                        {#if dock > 0}
                            <button
                                type="button"
                                onclick={() =>
                                    gameSession.repairShip(ship.shipId, RepairMethod.Dock, dock)}
                                >Repair {dock} for ${dock}B</button
                            >
                        {/if}
                        {#if canRepair(gameState, playerId, ship.shipId, RepairMethod.RemotePoint, 1)}
                            <button
                                type="button"
                                onclick={() =>
                                    gameSession.repairShip(
                                        ship.shipId,
                                        RepairMethod.RemotePoint,
                                        1
                                    )}>Remote: 1 for ${REMOTE_REPAIR_POINT_COST}B</button
                            >
                        {/if}
                        {#if canRepair(gameState, playerId, ship.shipId, RepairMethod.RemoteFull, ship.damage)}
                            <button
                                type="button"
                                onclick={() =>
                                    gameSession.repairShip(
                                        ship.shipId,
                                        RepairMethod.RemoteFull,
                                        ship.damage
                                    )}>Remote: all for ${remoteFullRepairCost(ship.shipId)}B</button
                            >
                        {/if}
                    </div>
                </ShipCard>
            {/each}
        </div>
    {/if}

    {#if clonable.length > 0}
        <div class="section-title">Cloning</div>
        <div class="buttons">
            {#each clonable as systemId (systemId)}
                <button type="button" onclick={() => gameSession.cloneSettlement(systemId)}>
                    Clone a settlement at {systemName(systemId)} for ${CLONING_COST}B
                </button>
            {/each}
        </div>
    {/if}

    {#if fleet.length > 0}
        <details class="fleet">
            <summary>Scrap a ship</summary>
            <div class="buttons">
                {#each fleet as ship (ship.shipId)}
                    {@const refund = scrapRefund(ship)}
                    <button
                        type="button"
                        class="danger"
                        onclick={() => gameSession.scrapShip(ship.shipId)}
                    >
                        Scrap {shipDefinition(ship.shipId).name}{refund > 0
                            ? ` (+$${refund}B)`
                            : ''}
                    </button>
                {/each}
            </div>
        </details>
    {/if}
</div>
