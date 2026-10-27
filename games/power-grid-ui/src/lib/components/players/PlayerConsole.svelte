<script lang="ts">
    import {
        HOUSES_PER_PLAYER,
        RESOURCES,
        MachineState,
        storedOnPlants
    } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlantCard from '../PlantCard.svelte'
    import ResourceToken from '../ResourceToken.svelte'
    import House from '../House.svelte'

    let { playerId, position }: { playerId: string; position: number } = $props()

    const session = getGameSession()
    const state = $derived(session.gameState)
    const player = $derived(state.getPlayerState(playerId))
    const color = $derived(session.colors.getPlayerUiColor(playerId))
    const textColor = $derived(session.colors.getPlayerTextColorValue(playerId))
    const cities = $derived(state.cityCount(playerId))
    const capacity = $derived(state.poweredCapacity(playerId))
    const stored = $derived(storedOnPlants(player.plants, player.resources))
    const digits = $derived(String(player.money).padStart(3, '0').split(''))
    const active = $derived(state.activePlayerIds.includes(playerId))
    const done = $derived(
        state.phaseDone.includes(playerId) && state.machineState !== MachineState.EndOfGame
    )
</script>

<article class="console" class:active style:--player={color} style:--player-text={textColor}>
    <header>
        <span class="position" title="Player order">{position}</span>
        <span class="name">{session.getPlayerName(playerId)}</span>
        {#if active}
            <span class="flag">Acting</span>
        {:else if done}
            <span class="flag muted">Done</span>
        {/if}
    </header>
    <div class="tray">
        <div class="readouts">
            <div class="meter" aria-label="{player.money} Elektro">
                {#each digits as digit, index (index)}
                    <span class="digit">{digit}</span>
                {/each}
                <span class="unit">Elektro</span>
            </div>
            <div class="stat" title="Cities connected">
                <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true">
                    <House x={0} y={0} {color} size={1.1} />
                </svg>
                <span class="value">{cities}</span>
                <span class="label">of {HOUSES_PER_PLAYER}</span>
            </div>
            <div class="stat" title="Cities the plants can power with the fuel held">
                <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true">
                    <path d="M9 1 L2 10 H7 L6 17 L14 7 H9 Z" fill="#f3c534"></path>
                </svg>
                <span class="value">{capacity}</span>
                <span class="label">powered</span>
            </div>
        </div>
        <div class="plants">
            {#each player.plants as plant (plant)}
                {@const fuel = stored.get(plant)}
                <div class="plant">
                    <PlantCard {plant} size={66} />
                    {#if fuel && RESOURCES.some((resource) => fuel[resource] > 0)}
                        <div class="fuel">
                            {#each RESOURCES as resource (resource)}
                                {#each { length: fuel[resource] } as _, index (index)}
                                    <svg
                                        width="13"
                                        height="14"
                                        viewBox="-7 -7 14 15"
                                        aria-hidden="true"
                                    >
                                        <ResourceToken {resource} size={11} />
                                    </svg>
                                {/each}
                            {/each}
                        </div>
                    {/if}
                </div>
            {:else}
                <span class="empty">No power plants yet</span>
            {/each}
        </div>
    </div>
</article>

<style>
    .console {
        border-radius: 9px;
        background: var(--player);
        padding: 0 5px 5px;
        box-shadow: 0 2px 4px rgb(0 0 0 / 0.4);
    }
    .console.active {
        box-shadow:
            0 0 0 3px #f3c534,
            0 2px 4px rgb(0 0 0 / 0.4);
    }
    header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 4px 3px;
        color: var(--player-text);
    }
    .position {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 18px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #1b201b;
        color: #ecebe1;
        display: grid;
        place-items: center;
    }
    .name {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 21px;
        letter-spacing: 0.03em;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .flag {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        background: #f3c534;
        color: #231d0c;
        border-radius: 4px;
        padding: 0 6px;
    }
    .flag.muted {
        background: rgb(0 0 0 / 0.35);
        color: #ecebe1;
    }
    .tray {
        background: #1b201b;
        border-radius: 6px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .readouts {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
    }
    .meter {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    .digit {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 20px;
        line-height: 1;
        width: 17px;
        padding: 3px 0;
        text-align: center;
        background: #ecebe1;
        color: #1b201b;
        border-radius: 3px;
    }
    .unit,
    .label {
        font-size: 13px;
        color: #aab198;
        margin-left: 3px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .stat {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .value {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 22px;
        color: #ecebe1;
    }
    .plants {
        display: flex;
        gap: 8px;
        min-height: 66px;
        align-items: flex-start;
    }
    .plant {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
    }
    .fuel {
        background: #cbc4ab;
        border-radius: 4px;
        padding: 1px 3px;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 70px;
    }
    .empty {
        color: #8d987a;
        font-size: 14px;
        align-self: center;
    }
</style>
