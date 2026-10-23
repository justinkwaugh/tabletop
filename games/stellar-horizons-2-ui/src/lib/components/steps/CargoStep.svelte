<script lang="ts">
    import {
        CargoPartnerKind,
        carriesCargo,
        hasArrived,
        shipDefinition,
        type TradeGood
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cargoTransferView, goodsAfterMoves } from '$lib/utils/cargoTransferView.js'
    import { systemName } from '$lib/utils/presentation.js'
    import CargoHold from '../CargoHold.svelte'
    import ShipTile from '../ShipTile.svelte'
    import CargoTransfer from './CargoTransfer.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const carriers = $derived(
        gameState
            .shipsOf(playerId)
            .filter((ship) => hasArrived(ship) && carriesCargo(gameState, ship))
    )
    const cargoShip = $derived(gameSession.cargoShip)
    const partner = $derived(gameSession.cargoPartner)
    const moves = $derived(gameSession.cargoMoves)
    const view = $derived(
        cargoShip && moves ? cargoTransferView(gameState, cargoShip, moves) : undefined
    )

    // A hold shows the draft: the chosen ship's, and its partner's when that is a ship.
    function isPartnerShip(shipId: string): boolean {
        return partner?.kind === CargoPartnerKind.Ship && partner.shipId === shipId
    }

    function carried(shipId: string, settlements: number): number {
        if (!view) {
            return settlements
        }
        if (shipId === cargoShip?.shipId) {
            return view.shipSettlements
        }
        return isPartnerShip(shipId) ? (view.partnerSettlements ?? settlements) : settlements
    }

    function goodsAboard(shipId: string, goods: readonly TradeGood[]): TradeGood[] {
        if (!moves) {
            return [...goods]
        }
        if (shipId === cargoShip?.shipId) {
            return goodsAfterMoves(goods, moves.goods, 1)
        }
        return isPartnerShip(shipId) ? goodsAfterMoves(goods, moves.goods, -1) : [...goods]
    }
</script>

<div class="sh-step">
    <div class="prompt">
        Choose a ship to load or unload
        <span class="cash">${gameState.getPlayerState(playerId).cash}B available</span>
    </div>
    <div class="columns">
        <div class="cards">
            {#each carriers as ship (ship.shipId)}
                <ShipTile
                    ship={shipDefinition(ship.shipId)}
                    named={false}
                    selected={gameSession.selectedShip?.shipId === ship.shipId}
                    label="Transfer cargo on {shipDefinition(ship.shipId).name} at {systemName(
                        ship.systemId
                    )}"
                    onclick={() => gameSession.locateShip(ship.shipId)}
                >
                    <CargoHold
                        {gameState}
                        {ship}
                        carried={carried(ship.shipId, ship.settlements)}
                        goods={goodsAboard(ship.shipId, ship.goods)}
                        showEmpty
                    />
                </ShipTile>
            {:else}
                <p class="empty">No cargo ships are ready.</p>
            {/each}
        </div>

        {#if cargoShip && partner && view}
            <CargoTransfer ship={cargoShip} {partner} {view} />
        {:else if cargoShip}
            <p class="empty">Nothing to load or unload at {systemName(cargoShip.systemId)}.</p>
        {/if}
    </div>
    {#if gameSession.saleOptions.length > 0}
        <p class="hint">
            You have goods to sell where there is demand: choose a marked system on the map.
        </p>
    {/if}
</div>

<style>
    .columns {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        gap: 10px 18px;
    }

    @media (max-width: 639px) {
        .columns {
            flex-direction: column;
            align-items: stretch;
        }
    }
</style>
