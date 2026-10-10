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
    import { ParrotfishUrls } from '$lib/images/art.generated.js'
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
    const shrimpsOnReefs = $derived(
        state.shrimps.filter((shrimp) => shrimp.playerId === player.id).length
    )
</script>

{#snippet shrimps(count: number)}
    <svg width={count * 16} height="26" viewBox="0 0 {count * 16} 26" aria-hidden="true">
        {#each { length: count } as _, index (index)}
            <Shrimp center={{ x: index * 16 + 8, y: 13 }} size={26} color={paint} />
        {/each}
    </svg>
{/snippet}

<article class="panel" class:turn={isTurn} style:--player={paint}>
    <header
        style:background-image="url({ParrotfishUrls[gameSession.colors.getPlayerColor(player.id)]})"
    >
        <h3
            class="plaque reef-display {gameSession.colors.getPlayerBgColor(
                player.id
            )} {gameSession.colors.getPlayerTextColor(player.id)}"
        >
            {player.name}
        </h3>
    </header>
    <dl>
        <div class="row">
            <dt>Screen</dt>
            <dd>
                {#if view.screen}
                    {#each view.screen as { color, count } (color)}
                        <PolypChip {color} {count} />
                    {/each}
                {/if}
                {#if view.hiddenScreenPolyps > 0}
                    <span class="note">+{view.hiddenScreenPolyps} unseen</span>
                {:else if !view.screen}
                    <span class="note">Concealed</span>
                {:else if view.screen.length === 0}
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
                            <svg width="20" height="22" viewBox="-10 -11 20 22" aria-hidden="true">
                                <LarvaCube center={{ x: 0, y: 0 }} size={18} {color} />
                            </svg>
                            {#if count > 1}<span class="reef-display">{count}</span>{/if}
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
                {#if view.shrimpsBehindScreen !== undefined}
                    {@render shrimps(view.shrimpsBehindScreen)}
                    <span class="note">
                        {view.shrimpsBehindScreen} of {ShrimpsPerPlayer} in hand{shrimpsOnReefs
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
        border-radius: 10px;
        overflow: hidden;
        background: rgb(0 0 0 / 0.18);
        box-shadow: inset 0 0 0 2px var(--reef-line);
        text-align: left;
    }

    .panel.turn {
        box-shadow:
            inset 0 0 0 2px var(--reef-line),
            0 0 0 3px var(--player);
    }

    header {
        position: relative;
        height: 84px;
        background-size: cover;
        background-position: center;
        border-bottom: 2px solid var(--reef-line);
    }

    .plaque {
        position: absolute;
        left: 10px;
        bottom: 8px;
        padding: 1px 12px;
        border-radius: 6px;
        font-size: 18px;
        box-shadow: 0 0 0 2px var(--reef-line);
    }

    dl {
        display: grid;
        gap: 6px;
        padding: 10px 12px 12px;
        margin: 0;
    }

    .row {
        display: grid;
        grid-template-columns: 82px 1fr;
        align-items: center;
        gap: 8px;
    }

    dt {
        font-size: 13px;
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
        font-size: 18px;
        font-variant-numeric: tabular-nums;
    }

    .points::after {
        content: ' pts';
        font-size: 13px;
        color: var(--reef-muted);
    }
</style>
