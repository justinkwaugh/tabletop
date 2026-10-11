<script lang="ts">
    import {
        CargoPartnerKind,
        sameCargoPartner,
        shipDefinition,
        type CargoPartner,
        type ShipState
    } from '@tabletop/stellar-horizons-2'
    import { SETTLEMENT_ART, SHIP_ART } from '$lib/art/manifest.js'
    // NASA's Apollo 17 "Blue Marble" photograph (AS17-148-22727), public domain.
    import earthImage from '$lib/images/earth.webp'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { CargoTransferView } from '$lib/utils/cargoTransferView.js'
    import CargoHold from '../CargoHold.svelte'
    import SlidingToggle from '../SlidingToggle.svelte'

    let {
        ship,
        partner,
        view
    }: { ship: ShipState; partner: CargoPartner; view: CargoTransferView } = $props()

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const faction = $derived(gameState.getPlayerState(ship.playerId).faction)
    const drafted = $derived(gameSession.draftedSettlements)
    const partnerShip = $derived(
        partner.kind === CargoPartnerKind.Ship
            ? gameState.playerShip(ship.playerId, partner.shipId)
            : undefined
    )

    function partnerName(candidate: CargoPartner): string {
        switch (candidate.kind) {
            case CargoPartnerKind.Earth:
                return 'Earth'
            case CargoPartnerKind.Base:
                return 'Base'
            case CargoPartnerKind.Ship:
                return shipDefinition(candidate.shipId).name
        }
    }
</script>

<div class="transfer">
    <div class="destination" role="group" aria-label="Destination">
        <SlidingToggle
            count={gameSession.cargoPartners.length}
            selectedIndex={gameSession.cargoPartners.findIndex((candidate) =>
                sameCargoPartner(candidate, partner)
            )}
        >
            {#each gameSession.cargoPartners as candidate (candidate.kind === CargoPartnerKind.Ship ? candidate.shipId : candidate.kind)}<button
                    type="button"
                    aria-pressed={sameCargoPartner(candidate, partner)}
                    onclick={() => gameSession.chooseCargoPartner(candidate)}
                    ><span>{partnerName(candidate)}</span></button
                >{/each}
        </SlidingToggle>
    </div>

    <div class="table" role="table" aria-label="Cargo to transfer">
        <div class="parties">
            <div class="party">
                <img
                    class="tile"
                    src={SHIP_ART[ship.shipId]}
                    alt={shipDefinition(ship.shipId).name}
                />
                <CargoHold
                    {gameState}
                    {ship}
                    carried={view.shipSettlements}
                    width="auto"
                    showEmpty
                />
            </div>
            <div class="between" aria-hidden="true">
                <svg class="head left" viewBox="0 0 16 20">
                    <path d="M1 10 L14 2.5 L10 10 L14 17.5 Z"></path>
                </svg>
                <span class="shaft"></span>
                <svg class="head right" viewBox="0 0 16 20">
                    <path d="M15 10 L2 2.5 L6 10 L2 17.5 Z"></path>
                </svg>
            </div>
            <div class="party">
                {#if partnerShip}
                    <img
                        class="tile"
                        src={SHIP_ART[partnerShip.shipId]}
                        alt={shipDefinition(partnerShip.shipId).name}
                    />
                    <CargoHold
                        {gameState}
                        ship={partnerShip}
                        carried={view.partnerSettlements}
                        width="auto"
                        showEmpty
                    />
                {:else if partner.kind === CargoPartnerKind.Earth}
                    <img class="tile" src={earthImage} alt="Earth" />
                {:else}
                    <span class="tile base">
                        {#if faction}<img src={SETTLEMENT_ART[faction]} alt="Base" />{/if}
                        <b>{view.partnerSettlements}</b>
                    </span>
                {/if}
            </div>
        </div>

        <div class="row head" role="row">
            <span></span>
            <span class="center">{shipDefinition(ship.shipId).name}</span>
            <span></span>
            <span class="center">{partnerName(partner)}</span>
        </div>
        <div class="row" role="row">
            <span class="item">
                {#if faction}<img
                        src={SETTLEMENT_ART[faction]}
                        alt=""
                        width="20"
                        height="20"
                    />{/if} Settlement
            </span>
            <span class="count" class:up={drafted > 0} class:down={drafted < 0}>
                <b data-testid="cargo-on-ship">{view.shipSettlements}</b>
            </span>
            <span class="arrows">
                <button
                    type="button"
                    aria-label="One settlement onto the ship"
                    disabled={!view.canLoad}
                    title={view.loadBlock}
                    onclick={() => gameSession.draftCargo(1)}>←</button
                >
                <button
                    type="button"
                    aria-label="One settlement off the ship"
                    disabled={!view.canUnload}
                    title={view.unloadBlock}
                    onclick={() => gameSession.draftCargo(-1)}>→</button
                >
            </span>
            <span class="count" class:up={drafted < 0} class:down={drafted > 0}>
                {#if view.partnerSettlements !== undefined}
                    <b data-testid="cargo-at-partner">{view.partnerSettlements}</b>
                {:else if view.settlementCost !== undefined}
                    <small>${view.settlementCost}B each</small>
                {/if}
            </span>
        </div>
    </div>

    <div class="foot">
        <span class="net" class:cost={view.cost > 0}>
            {#if drafted === 0}No changes{:else if view.cost > 0}Pay ${view.cost}B{:else}No cost{/if}
        </span>
        <button
            type="button"
            class="primary"
            disabled={drafted === 0}
            onclick={() => gameSession.commitCargoDraft()}>Commit</button
        >
    </div>
</div>

<style>
    .transfer {
        --pad: 12px;
        --tile: 79px;
        --source: 92px;
        --dest: 112px;
        --arrows: 72px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 0 1 auto;
        min-width: 0;
        max-width: 100%;
        box-sizing: border-box;
        padding: 8px var(--pad) 10px;
        border: 1px solid #22314d;
        border-radius: 8px;
        background: #070a12;
    }

    .destination {
        display: flex;
        justify-content: center;
        max-width: 100%;
        overflow-x: auto;
        --rail-surface: #172238;
        --rail-solid: #7fd3ff;
    }

    .destination button {
        position: relative;
        border: 0;
        padding: 3px 14px;
        border-radius: 999px;
        background: transparent;
        color: #9fb4d0;
        font-size: 13.5px;
        line-height: 18px;
    }

    .destination button:hover:not(:disabled) {
        background: transparent;
        color: #e8f1ff;
    }

    .destination button[aria-pressed='true'],
    .destination button[aria-pressed='true']:hover:not(:disabled) {
        color: #05070d;
        font-weight: 700;
    }

    /* The ship and the destination face each other across an arrow; below, the counts for the
       two sides sit either side of the arrow buttons. The gap from the name to the ship's
       number equals the gap from the destination's number to the panel's edge. */
    .table {
        display: grid;
        grid-template-columns:
            minmax(0, max-content) 1fr var(--source) var(--arrows) var(--dest)
            1fr;
    }

    .row > :nth-child(2) {
        grid-column: 3;
    }

    .row > :nth-child(3) {
        grid-column: 4;
    }

    .row > :nth-child(4) {
        grid-column: 5;
    }

    .parties {
        display: flex;
        grid-column: 1 / -1;
        align-items: flex-start;
        padding-bottom: 6px;
    }

    /* Each party hugs its own edge of the panel. */
    .party {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 3px;
        min-width: 0;
    }

    .party:last-child {
        align-items: flex-end;
    }

    .party :global(.hold) {
        width: var(--tile);
    }

    .tile {
        display: block;
        width: var(--tile);
        height: var(--tile);
        border-radius: 6px;
        box-sizing: border-box;
    }

    .tile.base {
        position: relative;
    }

    .tile.base img {
        width: 100%;
        height: 100%;
        border-radius: 6px;
    }

    .tile.base b {
        position: absolute;
        right: 4px;
        bottom: 1px;
        font-size: 24px;
        font-weight: 900;
        color: #fff;
        paint-order: stroke;
        -webkit-text-stroke: 4px rgba(0, 0, 0, 0.7);
    }

    .between {
        display: flex;
        flex: 1;
        align-items: center;
        height: var(--tile);
        margin: 0 12px;
        color: #7fd3ff;
    }

    .shaft {
        flex: 1;
        height: 3px;
        background: currentColor;
    }

    .head {
        flex-shrink: 0;
        width: 16px;
        height: 20px;
    }

    .head path {
        fill: currentColor;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linejoin: round;
    }

    .head.left {
        margin-right: -6px;
    }

    .head.right {
        margin-left: -6px;
    }

    .row {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: subgrid;
        align-items: center;
        padding: 2px 0;
        border-top: 1px solid #1a2438;
        font-size: 14px;
    }

    .row.head {
        border-top: none;
        padding: 0 0 2px;
        font-size: 12.5px;
        font-weight: 700;
        color: #b7c7de;
        white-space: nowrap;
    }

    .center {
        text-align: center;
    }

    .item {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        padding-right: calc(var(--pad) + (var(--dest) - var(--source)) / 2);
        color: #e8f1ff;
    }

    .item img {
        flex-shrink: 0;
        border-radius: 3px;
    }

    .count {
        text-align: center;
        color: #dbe7f5;
        white-space: nowrap;
    }

    .count.up b {
        color: #7fe08a;
    }

    .count.down b {
        color: #ffb38a;
    }

    .count small {
        font-size: 12px;
        color: #8fa4c2;
    }

    .arrows {
        display: flex;
        justify-content: center;
        gap: 6px;
    }

    .arrows button {
        width: 30px;
        padding: 0;
        font-size: 16px;
        font-weight: 700;
        line-height: 1.4;
    }

    .foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-top: 8px;
        border-top: 1px solid #22314d;
    }

    .net {
        font-size: 15px;
        font-weight: 700;
        color: #8fa4c2;
    }

    .net.cost {
        color: #ffb38a;
    }

    @media (max-width: 639px) {
        .transfer {
            --pad: 8px;
            --tile: 54px;
            --source: 40px;
            --dest: 64px;
            --arrows: 66px;
        }

        .destination button {
            padding: 3px 10px;
        }

        .item {
            gap: 6px;
        }
    }
</style>
