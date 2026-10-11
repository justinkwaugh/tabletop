<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        Side,
        commanderDefinition,
        commandersOf,
        type ProjectedUnit
    } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { ArmyColors } from '$lib/utils/armyColors.js'
    import { commandsUsed } from '$lib/utils/commandsLeft.js'
    import { BLOCK_LENGTH, BLOCK_THICKNESS } from '$lib/utils/blockShape.js'
    import Block from './board/Block.svelte'

    let { onlocate }: { onlocate: (locale: number) => void } = $props()

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)

    const ARMY_NAMES: Record<Side, string> = {
        [Side.French]: 'Grande Armée',
        [Side.Allied]: 'Allied Army'
    }

    const armies = $derived(
        game.players.flatMap((player) => (player.side ? [{ player, side: player.side }] : []))
    )

    function strength(units: ProjectedUnit[]): string {
        return units.length === 1 ? '1 unit' : `${units.length} units`
    }

    function whereabouts(commanderId: string): { place: string; locale?: number } {
        const commander = game.commander(commanderId)
        if (commander.eliminated) {
            return { place: 'destroyed' }
        }
        if (!commander.position) {
            return { place: 'off the map' }
        }
        const { locale, approach } = commander.position
        const name = game.map.label(locale)
        return { place: approach === undefined ? name : `${name}, on an approach`, locale }
    }
</script>

{#snippet unitBlocks(units: ProjectedUnit[], colors: ArmyColors)}
    <div class="nt-corps-units">
        {#each units as unit (unit.id)}
            <svg
                viewBox="{-BLOCK_LENGTH / 2} {-BLOCK_THICKNESS /
                    2} {BLOCK_LENGTH} {BLOCK_THICKNESS}"
                role="img"
                aria-label="Unit"
            >
                <Block x={0} y={0} angle={0} {colors} face={gameSession.visibleFace(unit)} />
            </svg>
        {/each}
    </div>
{/snippet}

<div class="nt-armies">
    {#each armies as { player, side } (player.playerId)}
        {@const colors = gameSession.armyColors(player.playerId)}
        {@const detached = game
            .unitsOf(player.playerId)
            .filter((unit) => unit.commanderId === undefined)}
        <section class="nt-army">
            <header style="background: {colors.block}; color: {colors.ink};">
                <div class="nt-army-name">{ARMY_NAMES[side]}</div>
                <div class="nt-army-player"><PlayerName playerId={player.playerId} /></div>
                <div class="nt-army-morale">
                    <span class="nt-army-morale-value" aria-label="{side} morale {player.morale}"
                        >{player.morale}</span
                    >
                    <span>morale</span>
                </div>
            </header>
            <div class="nt-army-body">
                {#if game.turnManager.currentTurn()?.playerId === player.playerId}
                    <div class="nt-army-note">
                        {commandsUsed(game, player.playerId)}
                    </div>
                {/if}
                {#each commandersOf(side) as definition (definition.id)}
                    {@const units = game.corpsUnits(definition.id)}
                    {@const where = whereabouts(definition.id)}
                    <div
                        class="nt-corps"
                        class:nt-corps-gone={game.commander(definition.id).eliminated}
                    >
                        <div class="nt-corps-head">
                            <span class="nt-corps-name"
                                >{commanderDefinition(definition.id).name}</span
                            >
                            {#if where.locale !== undefined}
                                {@const locale = where.locale}
                                <button
                                    type="button"
                                    class="nt-corps-where nt-corps-locate"
                                    aria-label="Show {definition.name} on the map"
                                    onclick={() => onlocate(locale)}
                                >
                                    <svg viewBox="0 0 16 16" aria-hidden="true">
                                        <circle cx="8" cy="8" r="4.2"></circle>
                                        <path
                                            d="M8 0.8 V4.6 M8 11.4 V15.2 M0.8 8 H4.6 M11.4 8 H15.2"
                                        ></path>
                                    </svg>
                                    {where.place}
                                </button>
                            {:else}
                                <span class="nt-corps-where">{where.place}</span>
                            {/if}
                        </div>
                        {#if units.some((unit) => gameSession.visibleFace(unit))}
                            {@render unitBlocks(units, colors)}
                        {:else if units.length > 0}
                            <div class="nt-corps-where">{strength(units)}</div>
                        {/if}
                    </div>
                {/each}
                {#if detached.length > 0}
                    <div class="nt-corps">
                        <div class="nt-corps-head">
                            <span class="nt-corps-name">Detached</span>
                            <span class="nt-corps-where">{strength(detached)}</span>
                        </div>
                        {#if detached.some((unit) => gameSession.visibleFace(unit))}
                            {@render unitBlocks(detached, colors)}
                        {/if}
                    </div>
                {/if}
            </div>
        </section>
    {/each}
</div>

<style>
    .nt-armies {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 6px 2px;
        color: #2b2620;
        font-size: 13px;
    }

    .nt-army {
        border: 1px solid #2b2620;
        border-radius: 4px;
        overflow: hidden;
    }

    .nt-army header {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        padding: 6px 10px;
        row-gap: 1px;
    }

    .nt-army-name {
        font-size: 17px;
        font-style: italic;
    }

    .nt-army-player {
        grid-column: 1;
        font-size: 12px;
        opacity: 0.9;
    }

    .nt-army-morale {
        grid-column: 2;
        grid-row: 1 / span 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 11px;
        line-height: 1;
    }

    .nt-army-morale-value {
        font-size: 26px;
        font-weight: 700;
    }

    .nt-army-body {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 6px 8px 8px;
    }

    .nt-army-note {
        font-size: 12px;
        opacity: 0.75;
    }

    .nt-corps-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        border-bottom: 1px solid rgba(43, 38, 32, 0.25);
    }

    .nt-corps-name {
        font-style: italic;
        font-size: 14px;
    }

    .nt-corps-where {
        font-size: 11px;
        opacity: 0.75;
        text-align: right;
    }

    .nt-corps-locate {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
    }

    .nt-corps-locate:hover {
        opacity: 1;
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    .nt-corps-locate svg {
        flex: none;
        width: 11px;
        height: 11px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
    }

    .nt-corps-units {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 3px 4px;
        padding-top: 4px;
    }

    .nt-corps-units svg {
        display: block;
        width: 100%;
        height: auto;
    }

    .nt-corps-gone {
        opacity: 0.45;
    }
</style>
