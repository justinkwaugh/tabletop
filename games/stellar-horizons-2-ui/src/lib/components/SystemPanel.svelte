<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        AnomalyChallenge,
        eventDefinition,
        shipDefinition,
        type ShipState
    } from '@tabletop/stellar-horizons-2'
    import { DEMAND_ART, FACTION_ART, SETTLEMENT_ART } from '$lib/art/manifest.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { FACTION_FILL, factionName, plural } from '$lib/utils/presentation.js'
    import { systemSummary } from '$lib/utils/systemSummary.js'
    import { goodName, groupGoods } from '$lib/utils/trade.js'
    import GoodChit from './GoodChit.svelte'
    import { ANOMALY_SIZE } from '$lib/utils/tileFeatures.js'
    import AnomalyCard from './AnomalyCard.svelte'
    import AnomalyTile from './AnomalyTile.svelte'
    import EventTile from './EventTile.svelte'
    import PactSummary from './PactSummary.svelte'
    import ShipCounter from './board/ShipCounter.svelte'
    import CargoHold from './CargoHold.svelte'

    const COUNTER_SIZE = 140

    let { systemId }: { systemId: string } = $props()

    const gameSession = getGameSession()
    const summary = $derived(systemSummary(gameSession.gameState, systemId, gameSession.myPlayerId))
    const inspectedPlayerId = $derived(
        gameSession.inspectedClump?.systemId === systemId
            ? gameSession.inspectedClump.playerId
            : undefined
    )

    function choose(ship: ShipState) {
        if (gameSession.selectableShipIds.includes(ship.shipId)) {
            gameSession.selectShip(ship.shipId)
        }
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            gameSession.leaveFocus()
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

<aside class="panel" aria-label="{summary.name} details">
    <header>
        <h2>{summary.name}</h2>
        <button type="button" class="back" onclick={() => gameSession.leaveFocus()}
            >Back to map</button
        >
    </header>

    <div class="fleets">
        {#if summary.anomaly}
            <AnomalyCard summary={summary.anomaly} />
        {/if}
        {#if summary.turnedOver}
            <section class="feature" aria-label="Turned over: {summary.turnedOver.name}">
                <AnomalyTile anomalyId={summary.turnedOver.id} turned width={ANOMALY_SIZE.width} />
                <span class="feature-text"
                    ><strong>{summary.turnedOver.name}</strong>, resolved and turned over. Its back
                    acts on the bases here.</span
                >
            </section>
        {/if}
        {#each summary.events as event (event.eventId)}
            {@const definition = eventDefinition(event.eventId)}
            <section class="feature" aria-label="Event: {definition.name}">
                <EventTile eventId={event.eventId} width={88} />
                <span class="feature-text"
                    ><strong>{definition.name}</strong>, unresolved. Resolving it needs
                    {event.challenges
                        .map(
                            ({ challenge, difficulty }) =>
                                `${difficulty} ${challenge === AnomalyChallenge.Science ? 'exploration' : 'combat'}`
                        )
                        .join(' or ')}, for {definition.influence} IP.</span
                >
            </section>
        {/each}
        {#if summary.demand}
            {@const demand = summary.demand}
            <section class="feature" aria-label="Demand">
                <img
                    class="demand"
                    src={DEMAND_ART[demand.sol ? 'Sol' : demand.prices[0].good]}
                    alt=""
                    width="64"
                    height="64"
                />
                <span class="feature-text"
                    ><strong>Demand</strong>: {demand.prices
                        .map(({ good, price }) => `${goodName(good)} sells for $${price}B`)
                        .join(', ')}{demand.sol ? ', on Earth.' : ' each, and 1 IP.'}</span
                >
            </section>
        {/if}
        {#each summary.pacts as pact (pact.id)}
            <PactSummary
                {pact}
                viewerId={gameSession.myPlayerId}
                status={pact.agreed ? 'Agreed' : 'Offered'}
            />
        {/each}
        {#each summary.fleets as fleet (fleet.playerId)}
            <section
                class="fleet"
                class:inspected={fleet.playerId === inspectedPlayerId}
                style:--faction={fleet.faction ? FACTION_FILL[fleet.faction] : '#3d4a63'}
                aria-label={fleet.faction ? factionName(fleet.faction) : 'Unaligned'}
            >
                <div class="fleet-head">
                    {#if fleet.faction}
                        <img src={FACTION_ART[fleet.faction]} alt="" width="40" height="40" />
                    {/if}
                    <div class="fleet-name">
                        <PlayerName playerId={fleet.playerId} />
                        <span class="faction"
                            >{fleet.faction ? factionName(fleet.faction) : ''}</span
                        >
                    </div>
                    {#if fleet.goods.length > 0}
                        <div class="goods" aria-label="Goods at the base">
                            {#each groupGoods(fleet.goods) as group (group.good)}
                                <GoodChit good={group.good} count={group.count} size={28} />
                            {/each}
                        </div>
                    {/if}
                    {#if fleet.settlements > 0 && fleet.faction}
                        <div
                            class="settlements"
                            title={summary.settlementGoal
                                ? `${plural(fleet.settlements, 'settlement')} of ${summary.settlementGoal} to win`
                                : plural(fleet.settlements, 'settlement')}
                        >
                            <img
                                src={SETTLEMENT_ART[fleet.faction]}
                                alt=""
                                width="40"
                                height="40"
                            />
                            <span class="count"
                                >{fleet.settlements}{#if summary.settlementGoal}<span class="goal"
                                        >/{summary.settlementGoal}</span
                                    >{/if}</span
                            >
                        </div>
                    {/if}
                </div>
                {#if fleet.ships.length > 0}
                    <div class="ships">
                        {#each fleet.ships as ship (ship.shipId)}
                            {@const selectable = gameSession.selectableShipIds.includes(
                                ship.shipId
                            )}
                            <button
                                type="button"
                                class="ship"
                                class:selectable
                                class:selected={gameSession.selectedShip?.shipId === ship.shipId}
                                disabled={!selectable}
                                aria-label={shipDefinition(ship.shipId).name}
                                onclick={() => choose(ship)}
                            >
                                <svg
                                    width={COUNTER_SIZE}
                                    height={COUNTER_SIZE}
                                    viewBox="0 0 {COUNTER_SIZE} {COUNTER_SIZE}"
                                    overflow="visible"
                                    aria-hidden="true"
                                >
                                    <ShipCounter {ship} size={COUNTER_SIZE} />
                                </svg>
                                <CargoHold
                                    gameState={gameSession.gameState}
                                    {ship}
                                    width={COUNTER_SIZE}
                                />
                                {#if ship.transit > 0}
                                    <span class="arrival"
                                        >Arrives in {plural(ship.transit, 'turn')}</span
                                    >
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/if}
            </section>
        {:else}
            <p class="muted">Nobody is here yet.</p>
        {/each}
    </div>
</aside>

<style>
    .demand {
        flex-shrink: 0;
        border-radius: 4px;
    }

    .goods {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-left: auto;
    }

    /* The name and the way back stay put; only the fleets scroll beneath them. */
    .panel {
        height: 100%;
        overflow: hidden;
        border-left: 1px solid #1e2b44;
        background: linear-gradient(180deg, rgba(15, 22, 38, 0.97), rgba(7, 11, 20, 0.97));
        color: #dbe7f5;
        display: flex;
        flex-direction: column;
    }

    header {
        display: flex;
        flex-shrink: 0;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        padding: 14px 16px 10px;
        border-bottom: 1px solid #1e2b44;
    }

    .fleets {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
        overflow-y: auto;
        padding: 12px 16px 14px;
    }

    h2 {
        font-size: 24px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: #f2c94c;
    }

    .back {
        flex-shrink: 0;
        padding: 4px 12px;
        border-radius: 999px;
        border: 1px solid #2f5f86;
        background: #16304b;
        color: #e8f1ff;
        font-size: 13px;
    }

    .back:hover {
        background: #1f4469;
    }

    .feature {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 8px;
        margin-bottom: 8px;
        border: 1px solid #1e2b44;
        border-radius: 10px;
        background: #0d1322;
    }

    .feature-text {
        font-size: 13px;
        color: #c9d6ea;
    }

    .feature-text strong {
        color: #e8f1ff;
    }

    .fleet {
        border: 1px solid #1e2b44;
        border-left: 4px solid var(--faction);
        border-radius: 10px;
        padding: 8px;
        margin-bottom: 8px;
        background: rgba(15, 22, 38, 0.8);
        transition: box-shadow 200ms ease;
    }

    .fleet.inspected {
        box-shadow: 0 0 0 2px #7fd3ff;
    }

    .fleet-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
    }

    .fleet-head img {
        border-radius: 3px;
    }

    .fleet-name {
        display: flex;
        flex-direction: column;
        flex: 1;
        font-size: 13px;
    }

    .faction {
        font-size: 15px;
        font-weight: 700;
        color: #e8f1ff;
    }

    .settlements {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .count {
        font-size: 22px;
        font-weight: 800;
        color: #ffffff;
    }

    .goal {
        font-size: 14px;
        font-weight: 600;
        color: #8fa4c2;
    }

    .ships {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .ship {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 4px;
        border: 2px solid transparent;
        border-radius: 8px;
        background: none;
        text-align: left;
        font-size: 12px;
        cursor: default;
    }

    .ship.selectable {
        cursor: pointer;
    }

    .ship.selectable:hover {
        background: rgba(127, 211, 255, 0.08);
    }

    .ship.selected {
        border-color: #ffd65a;
    }

    .arrival {
        font-weight: 600;
        color: #f2c94c;
    }

    .muted {
        color: #8fa4c2;
    }
</style>
