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
        SOL_SYSTEM_ID,
        scrapRefund,
        shipDefinition,
        type ShipState,
        shipsAvailableToBuild
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { plural, systemName } from '$lib/utils/presentation.js'
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

    // What scrapping a ship gives back (half its cost, at Sol, undamaged and arrived), why it
    // gives nothing otherwise, and what goes down with it.
    function scrapOutcome(ship: ShipState): { back: string; why?: string; lost?: string } {
        const refund = scrapRefund(ship)
        const why =
            refund > 0
                ? undefined
                : ship.transit > 0
                  ? 'in transit'
                  : ship.systemId !== SOL_SYSTEM_ID
                    ? 'only at Sol'
                    : ship.damage > 0
                      ? 'damaged'
                      : undefined
        const lost = [
            ship.settlements > 0 ? plural(ship.settlements, 'settlement') : '',
            ship.goods.length > 0 ? plural(ship.goods.length, 'good') : ''
        ]
            .filter(Boolean)
            .join(' and ')
        return {
            back: refund > 0 ? `+$${refund}B` : 'nothing back',
            ...(why ? { why } : {}),
            ...(lost ? { lost } : {})
        }
    }
</script>

<div class="sh-step">
    {#if available.length > 0}
        <div class="prompt">
            Choose a ship to build <span class="cash">${cash}B available</span>
        </div>
    {:else}
        <div class="section-title">Shipyard</div>
    {/if}
    <div class="cards">
        {#each available as ship (ship.id)}
            {@const [home, ...elsewhere] = buildLocations(gameState, playerId, ship.id)}
            <ShipTile
                {ship}
                named={false}
                label="Build {ship.name} at {systemName(home)} for ${ship.cost}B"
                disabled={ship.cost > cash}
                onclick={() => gameSession.buildShip(ship.id, home)}
            >
                <div class="cost" class:short={ship.cost > cash}>${ship.cost}B</div>
                {#each elsewhere as systemId (systemId)}
                    <button
                        type="button"
                        disabled={ship.cost > cash}
                        onclick={() => gameSession.buildShip(ship.id, systemId)}
                    >
                        at {systemName(systemId)}
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
                    {@const outcome = scrapOutcome(ship)}
                    <button
                        type="button"
                        class="danger scrap"
                        onclick={() => gameSession.scrapShip(ship.shipId)}
                    >
                        <span>Scrap {shipDefinition(ship.shipId).name}</span>
                        <span class="back" class:none={outcome.back === 'nothing back'}
                            >{outcome.back}{outcome.why ? ` (${outcome.why})` : ''}</span
                        >
                        {#if outcome.lost}<span class="lost">loses {outcome.lost}</span>{/if}
                    </button>
                {/each}
            </div>
        </details>
    {/if}
</div>

<style>
    .scrap {
        display: inline-flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1px;
        text-align: left;
    }

    .scrap .back {
        font-weight: 700;
        color: #f4c430;
    }

    .scrap .back.none {
        font-weight: 400;
        color: #b5c5dc;
    }

    .scrap .lost {
        font-size: 12px;
        color: #f08a7a;
    }
</style>
