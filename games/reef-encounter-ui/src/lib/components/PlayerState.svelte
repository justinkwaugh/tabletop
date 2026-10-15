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
    import ReefCrest from './ReefCrest.svelte'
    import { ParrotfishUrls } from '$lib/images/art.generated.js'
    import { playerPanelView } from '$lib/utils/playerPanel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        player,
        playerState,
        seat
    }: { player: Player; playerState: HydratedReefEncounterPlayerState; seat: number } = $props()

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const isTurn = $derived(state.activePlayerIds.includes(player.id))
    const paint = $derived(gameSession.colors.getPlayerBgColorValue(player.id))
    const fishColor = $derived(gameSession.colors.getPlayerColor(player.id))
    const view = $derived(
        playerPanelView(
            playerState,
            coralValues(state.coralTiles),
            isParrotfishFed(state, player.id)
        )
    )
    const FarFish = [
        [8, 8, 1],
        [22, 4, 0.8],
        [30, 14, 0.9],
        [46, 9, 0.7],
        [14, 20, 0.75]
    ] as const
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

<article class="panel" class:turn={isTurn} style:--player={paint}>
    <header>
        <svg class="far-fish" viewBox="0 0 120 40" aria-hidden="true">
            {#each FarFish as [x, y, scale], index (index)}
                <path
                    transform="translate({x} {y}) scale({scale})"
                    d="M0 3 q5 -4 10 0 q-5 4 -10 0 z M10 3 l4 -3 v6 z"
                ></path>
            {/each}
        </svg>
        <div class="swim" class:tail-up={fishColor === 'yellow'}>
            <img class="fish" src={ParrotfishUrls[fishColor]} alt="" />
            {#if isTurn}
                <span class="breath" aria-hidden="true"><i></i><i></i><i></i></span>
            {/if}
        </div>
        <h3
            class="plaque reef-display"
            style:background={paint}
            style:color={gameSession.colors.getPlayerTextColorValue(player.id)}
        >
            {player.name}
        </h3>
        <div class="crest"><ReefCrest id="crest-{player.id}" {seat} /></div>
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
                        <PolypChip {color} {count} />
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
        border-radius: 16px;
        background: var(--reef-rock);
        box-shadow: 0 8px 18px -12px rgb(4 30 26 / 0.8);
    }

    /* Inside the card's edge: the side panel's scroll box clips anything drawn outside it */
    .panel.turn::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 5;
        border: 3px solid var(--player);
        border-radius: inherit;
        pointer-events: none;
    }

    header {
        position: relative;
        height: 76px;
        overflow: hidden;
        background: #5e9e8e;
    }

    header::before {
        content: '';
        position: absolute;
        inset: 0 0 20px;
        background: #7cb8a7;
        mask-image: linear-gradient(black, transparent);
    }

    .far-fish {
        position: absolute;
        left: 150px;
        top: 6px;
        width: 90px;
        fill: #4a8a7b;
    }

    .swim {
        position: absolute;
        right: 16px;
        top: 2px;
        height: 50px;
        z-index: 1;
        animation: bob 5s ease-in-out infinite alternate;
    }

    /* The yellow fish's tail rises above its back, so it stands taller to keep its body the
       others' size */
    .swim.tail-up {
        top: -2px;
        height: 64px;
    }

    .fish {
        display: block;
        height: 100%;
        width: auto;
        filter: drop-shadow(0 6px 4px rgb(4 30 26 / 0.25));
    }

    .plaque {
        position: absolute;
        left: 10px;
        top: 10px;
        z-index: 2;
        padding: 1px 14px 2px;
        border-radius: 999px;
        font-size: 18px;
        box-shadow: 0 2px 0 rgb(4 30 26 / 0.35);
    }

    .crest {
        position: absolute;
        left: 0;
        right: 0;
        bottom: -1px;
    }

    .breath {
        position: absolute;
        left: -8px;
        bottom: 14px;
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

    @keyframes bob {
        from {
            transform: translateY(-2px) rotate(-1.5deg);
        }
        to {
            transform: translateY(3px) rotate(1.5deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .swim {
            animation: none;
        }

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
