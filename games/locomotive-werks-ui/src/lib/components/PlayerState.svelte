<script lang="ts">
    import type { HydratedLwPlayerState } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { TAX_RATE_PERCENT, locomotiveData, taxOn } from '@tabletop/locomotive-werks'
    import { kindColor, kindOf, locomotiveName } from '$lib/utils/locomotives.js'
    import KindShape from './KindShape.svelte'

    // Each panel is the seat's Player Order card on banknote paper: the engineer's cash, and a bar
    // in each of their locomotives' colours with its generation, its units and any shipped this
    // phase. The panels run in Player Order, so the card needs no order numeral.
    let { playerState }: { playerState: HydratedLwPlayerState } = $props()

    const gameSession = getGameSession()

    const playerId = $derived(playerState.playerId)
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const ink = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const acting = $derived(gameSession.gameState.activePlayerIds.includes(playerId))
    const tax = $derived(taxOn(playerState.cash))
</script>

<div class="order-card" class:acting style:--player={color} style:--player-ink={ink}>
    <div class="band">
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
        <span class="cash" title="Cash">${playerState.cash}</span>
    </div>
    <div class="works">
        {#each playerState.plants as plant (plant.locomotiveId)}
            {@const waiting = plant.units - plant.shipped}
            <div
                class="werk"
                style:--kind={kindColor(plant.locomotiveId, gameSession.kindPalette)}
                title="{locomotiveName(plant.locomotiveId)}: {waiting} unit{waiting === 1
                    ? ''
                    : 's'}{plant.shipped > 0 ? `, ${plant.shipped} shipped this phase` : ''}"
            >
                <span class="generation">{locomotiveData(plant.locomotiveId).generation}</span>
                {#if gameSession.colorBlind}
                    <svg class="shape" viewBox="-8 -8 16 16" aria-hidden="true"
                        ><KindShape kind={kindOf(plant.locomotiveId)} size={14} /></svg
                    >
                {/if}
                <span class="units">{waiting}<small>unit{waiting === 1 ? '' : 's'}</small></span>
                {#if plant.shipped > 0}
                    <span class="shipped">{plant.shipped}<small>shipped</small></span>
                {/if}
            </div>
        {:else}
            <div class="none">No werks yet</div>
        {/each}
    </div>
    {#if playerState.autoShip}
        <div class="auto-ship">Shipping everything automatically</div>
    {/if}
    <div
        class="footer"
        title="Taxes take {TAX_RATE_PERCENT}% of cash, rounded down, after Production"
    >
        Tax at this cash <strong>${tax}</strong>
    </div>
</div>

<style>
    .order-card {
        overflow: hidden;
        border: 2px solid #a7b8c5;
        border-radius: 6px;
        background:
            repeating-radial-gradient(
                circle at 18% 60%,
                transparent 0 7px,
                rgba(60, 84, 104, 0.07) 7px 8px
            ),
            #e9eef2;
        color: #232d36;
        font-family: 'LW Baskerville', Georgia, serif;
    }

    .order-card.acting {
        border-color: var(--player);
        box-shadow: 0 0 0 2px var(--player);
    }

    .band {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        padding: 3px 10px;
        background: var(--player);
        color: var(--player-ink);
    }

    .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: 'LW Playfair', Georgia, serif;
        font-size: 18px;
    }

    .cash {
        font-family: 'LW Abril', Georgia, serif;
        font-size: 20px;
        font-variant-numeric: tabular-nums;
    }

    .works {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 6px 8px;
    }

    .werk {
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 34px;
        border-radius: 4px;
        background: var(--kind);
        padding: 0 10px;
        color: #16140f;
        box-shadow: 0 1px 2px rgba(16, 28, 40, 0.35);
    }

    .generation {
        min-width: 22px;
        font-family: 'LW Abril', Georgia, serif;
        font-size: 28px;
        line-height: 1;
    }

    .units,
    .shipped {
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 21px;
        font-weight: 700;
        line-height: 1;
    }

    .shipped {
        margin-left: auto;
    }

    small {
        font-family: 'LW Baskerville', Georgia, serif;
        font-size: 12px;
        font-weight: 700;
    }

    .none {
        padding: 4px 2px;
        font-size: 12px;
        font-style: italic;
        color: #536779;
    }

    .auto-ship {
        margin: 0 8px 4px;
        padding: 1px 8px;
        border-radius: 999px;
        background: #25303a;
        color: #e9eef2;
        font-size: 11px;
        font-weight: 700;
        text-align: center;
    }

    .shape {
        width: 16px;
        height: 16px;
        flex: none;
    }

    .footer {
        padding: 0 10px 5px;
        font-size: 10.5px;
        color: #46596b;
    }
</style>
