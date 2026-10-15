<script lang="ts">
    import type { Player } from '@tabletop/common'
    import {
        coralValues,
        isParrotfishFed,
        ShrimpsPerPlayer,
        type HydratedReefEncounterPlayerState
    } from '@tabletop/reef-encounter'
    import PolypChip from './PolypChip.svelte'
    import Shrimp from './table/Shrimp.svelte'
    import LarvaCube from './table/LarvaCube.svelte'
    import { ParrotfishUrls, SceneCoralUrls } from '$lib/images/art.generated.js'
    import { playerPanelView } from '$lib/utils/playerPanel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let { player, playerState }: { player: Player; playerState: HydratedReefEncounterPlayerState } =
        $props()

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const isTurn = $derived(state.activePlayerIds.includes(player.id))
    const paint = $derived(gameSession.colors.getPlayerBgColorValue(player.id))
    const view = $derived(
        playerPanelView(
            playerState,
            coralValues(state.coralTiles),
            isParrotfishFed(state, player.id)
        )
    )
    // A few corals at the panel's foot, a different few for each seat so the panels tell apart.
    const SeatCorals = [
        ['orange', 'yellow', 'white'],
        ['pink', 'grey', 'orange'],
        ['white', 'pink', 'yellow'],
        ['grey', 'orange', 'pink']
    ]
    const corals = $derived(
        SeatCorals[Math.max(state.turnManager.turnOrder.indexOf(player.id), 0) % SeatCorals.length]
    )
    const shrimpsOnReefs = $derived(
        state.shrimps.filter((shrimp) => shrimp.playerId === player.id).length
    )
</script>

{#snippet shrimps(count: number)}
    <svg width={count * 16} height="26" viewBox="0 0 {count * 16} 26" aria-hidden="true">
        {#each { length: count } as _, index (index)}
            <Shrimp center={{ x: index * 16 + 8, y: 13 }} length={26} color={paint} />
        {/each}
    </svg>
{/snippet}

<article class="panel reef-glass" class:turn={isTurn} style:--player={paint}>
    <header>
        <svg class="seabed" viewBox="0 0 320 22" preserveAspectRatio="none" aria-hidden="true">
            <path class="far" d="M0 9 Q22 2 46 8 T96 7 T150 9 T206 5 T262 9 T320 6 V22 H0 Z"></path>
            <path class="near" d="M0 15 Q30 9 62 14 T128 13 T190 15 T252 12 T320 14 V22 H0 Z"
            ></path>
        </svg>
        <div class="corals" aria-hidden="true">
            {#each corals as color (color)}
                <img class="coral {color}" src={SceneCoralUrls[color]} alt="" />
            {/each}
        </div>
        <div class="fish" aria-hidden="true">
            {#if isTurn}
                <span class="breath"><i></i><i></i><i></i></span>
            {/if}
            <img src={ParrotfishUrls[gameSession.colors.getPlayerColor(player.id)]} alt="" />
        </div>
        <h3
            class="plaque reef-display"
            style:background={gameSession.colors.getPlayerBgColorValue(player.id)}
            style:color={gameSession.colors.getPlayerTextColorValue(player.id)}
        >
            {player.name}
        </h3>
    </header>
    <dl>
        <div class="row">
            <dt>Supply</dt>
            <dd>
                {#if view.supply}
                    {#each view.supply as { color, count } (color)}
                        <PolypChip {color} {count} />
                    {/each}
                {/if}
                {#if view.hiddenSupplyPolyps > 0}
                    <span class="note">+{view.hiddenSupplyPolyps} unseen</span>
                {:else if !view.supply}
                    <span class="note">Concealed</span>
                {:else if view.supply.length === 0}
                    <span class="note">None</span>
                {/if}
            </dd>
        </div>
        <div class="row">
            <dt>Larva cubes</dt>
            <dd>
                {#if view.larvaCubes?.length === 0}
                    <span class="note">None</span>
                {:else if view.larvaCubes}
                    {#each view.larvaCubes as { color, count } (color)}
                        <span class="cube" title="{count} {color}">
                            <svg
                                width="20"
                                height="22"
                                viewBox="-10 -11 20 22"
                                role="img"
                                aria-label="{count} {color} larva cube{count === 1 ? '' : 's'}"
                            >
                                <LarvaCube center={{ x: 0, y: 0 }} size={18} {color} />
                            </svg>
                            {#if count > 1}<span class="reef-display" aria-hidden="true"
                                    >{count}</span
                                >{/if}
                        </span>
                    {/each}
                {:else}
                    <span class="note">Concealed</span>
                {/if}
            </dd>
        </div>
        {#if view.consumed.length > 0}
            <div class="row">
                <dt>Consumed</dt>
                <dd>
                    {#each view.consumed as { color, count } (color)}
                        <PolypChip {color} {count} consumed />
                    {/each}
                </dd>
            </div>
        {/if}
        <div class="row">
            <dt>Shrimps</dt>
            <dd>
                {#if view.shrimpsInSupply !== undefined}
                    {@render shrimps(view.shrimpsInSupply)}
                    <span class="note">
                        {view.shrimpsInSupply} of {ShrimpsPerPlayer} in hand{shrimpsOnReefs
                            ? `, ${shrimpsOnReefs} on the reefs`
                            : ''}
                    </span>
                {:else}
                    <span class="note">{shrimpsOnReefs} on the reefs</span>
                {/if}
            </dd>
        </div>
        <div class="row parrotfish">
            <dt>Parrotfish</dt>
            <dd>
                {#if view.parrotfish}
                    {#each view.parrotfish as { color, count } (color)}
                        <PolypChip {color} {count} />
                    {/each}
                    {#if view.hiddenParrotfishPolyps > 0}
                        <span class="note">+{view.hiddenParrotfishPolyps} hidden</span>
                    {/if}
                    <span class="points reef-display">{view.parrotfishPoints}</span>
                {:else}
                    <span class="note">Concealed</span>
                {/if}
                {#if view.shrimpOnOpenSea}
                    <span class="note">
                        ate {1 + (view.shrimpsInParrotfish ?? 0)} shrimp{(view.shrimpsInParrotfish ??
                            0) > 0
                            ? 's'
                            : ''}
                    </span>
                {/if}
            </dd>
        </div>
    </dl>
</article>

<style>
    .panel {
        position: relative;
        overflow: hidden;
        text-align: left;
        transition: box-shadow 0.25s;
    }

    .panel.turn {
        box-shadow:
            0 0 0 2px var(--player),
            0 0 20px -2px color-mix(in srgb, var(--player) 60%, transparent);
    }

    /* Shallow, sunlit water above the reef, deepening into the panel below. */
    header {
        position: relative;
        height: 72px;
        background:
            radial-gradient(120% 100% at 30% -20%, rgb(255 255 255 / 0.4), transparent 65%),
            linear-gradient(180deg, #9dd3c0, #6eae9a 80%);
    }

    .seabed {
        position: absolute;
        inset: auto 0 0;
        width: 100%;
        height: 22px;
    }

    .seabed .far {
        fill: rgb(30 84 72 / 0.35);
    }

    .seabed .near {
        fill: rgb(14 52 46 / 0.55);
    }

    .corals {
        position: absolute;
        right: 104px;
        bottom: 3px;
        display: flex;
        align-items: flex-end;
        opacity: 0.92;
    }

    .coral {
        height: 30px;
        width: auto;
        margin-left: -6px;
    }

    .coral.grey,
    .coral.yellow {
        height: 22px;
    }

    .fish {
        position: absolute;
        top: 8px;
        right: 10px;
    }

    .fish img {
        display: block;
        height: 44px;
        max-width: 112px;
        filter: drop-shadow(0 3px 3px rgb(4 30 26 / 0.3));
    }

    .plaque {
        position: absolute;
        left: 10px;
        bottom: 14px;
        padding: 1px 14px 2px;
        border-radius: 999px;
        font-size: 18px;
        box-shadow:
            inset 0 9px 8px -6px rgb(255 255 255 / 0.4),
            0 0 0 2px color-mix(in srgb, var(--player) 45%, #082520),
            0 3px 6px rgb(4 30 26 / 0.45);
    }

    .breath {
        position: absolute;
        bottom: 22px;
        left: -12px;
        width: 24px;
        height: 60px;
        pointer-events: none;
    }

    .breath i {
        position: absolute;
        bottom: 0;
        left: 6px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, #fff, rgb(255 255 255 / 0.2) 65%);
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.7);
        animation: breathe 2.8s ease-in infinite;
    }

    .breath i:nth-child(2) {
        width: 6px;
        height: 6px;
        animation-delay: -0.9s;
    }

    .breath i:nth-child(3) {
        width: 5px;
        height: 5px;
        animation-delay: -1.9s;
    }

    @keyframes breathe {
        0% {
            transform: translate(0, 0) scale(0.6);
            opacity: 0;
        }
        15% {
            opacity: 1;
        }
        100% {
            transform: translate(6px, -54px) scale(1.1);
            opacity: 0;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .breath i {
            animation: none;
            opacity: 0.8;
        }

        .breath i:nth-child(2) {
            transform: translate(4px, -18px);
        }

        .breath i:nth-child(3) {
            transform: translate(2px, -34px);
        }
    }

    dl {
        display: grid;
        gap: 6px;
        padding: 8px 12px 12px;
        margin: 0;
    }

    .row {
        display: grid;
        grid-template-columns: 82px 1fr;
        align-items: center;
        gap: 8px;
    }

    .row + .row {
        padding-top: 6px;
        border-top: 1px solid rgb(255 255 255 / 0.1);
    }

    dt {
        font-family: 'Reef Fredoka', sans-serif;
        font-weight: 500;
        font-size: 13px;
        letter-spacing: 0.03em;
        color: var(--reef-muted);
    }

    dd {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin: 0;
        min-width: 0;
    }

    .note {
        font-size: 13px;
        color: var(--reef-muted);
    }

    .cube {
        display: inline-flex;
        align-items: center;
        gap: 1px;
        font-size: 14px;
    }

    .points {
        margin-left: auto;
        padding: 0 9px;
        border-radius: 999px;
        font-size: 17px;
        font-variant-numeric: tabular-nums;
        color: var(--reef-paper-ink);
        background:
            linear-gradient(180deg, rgb(255 255 255 / 0.8), transparent 70%), var(--reef-pearl);
        box-shadow: 0 2px 4px rgb(4 30 26 / 0.3);
    }

    .points::after {
        content: ' pts';
        font-size: 12px;
        color: var(--reef-paper-muted);
    }
</style>
