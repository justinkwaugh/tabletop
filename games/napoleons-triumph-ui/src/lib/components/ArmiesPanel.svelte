<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        ALLIED_CORPS_COMMAND_LIMIT,
        INDEPENDENT_COMMANDS,
        Side,
        commanderDefinition,
        commandersOf,
        type ProjectedUnit
    } from '@tabletop/napoleons-triumph'
    import { ARMY_COLORS } from '$lib/definitions/palette.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeLocale } from '$lib/model/battle.js'
    import UnitTile from './UnitTile.svelte'

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

    function whereabouts(commanderId: string): string {
        const commander = game.commander(commanderId)
        if (commander.eliminated) {
            return 'destroyed'
        }
        if (!commander.position) {
            return 'off the map'
        }
        const place = describeLocale(game, commander.position.locale)
        return commander.position.approach === undefined ? place : `${place}, on an approach`
    }
</script>

<div class="nt-armies">
    {#each armies as { player, side } (player.playerId)}
        {@const colors = ARMY_COLORS[side]}
        {@const detached = game.unitsOf(player.playerId).filter((unit) => unit.commanderId === undefined)}
        <section class="nt-army">
            <header style="background: {colors.block}; color: {colors.ink};">
                <div class="nt-army-name">{ARMY_NAMES[side]}</div>
                <div class="nt-army-player"><PlayerName playerId={player.playerId} /></div>
                <div class="nt-army-morale" aria-label="Morale">
                    <span class="nt-army-morale-value">{player.morale}</span>
                    <span>morale</span>
                </div>
            </header>
            <div class="nt-army-body">
                {#if game.turnManager.currentTurn()?.playerId === player.playerId}
                    <div class="nt-army-note">
                        Commands used this turn: {player.independentCommandsUsed} of {INDEPENDENT_COMMANDS[side]}
                        independent{side === Side.Allied
                            ? `, ${player.corpsCommandsUsed} of ${ALLIED_CORPS_COMMAND_LIMIT} corps`
                            : ''}
                    </div>
                {/if}
                {#each commandersOf(side) as definition (definition.id)}
                    {@const units = game.corpsUnits(definition.id)}
                    <div class="nt-corps" class:nt-corps-gone={game.commander(definition.id).eliminated}>
                        <div class="nt-corps-head">
                            <span class="nt-corps-name">{commanderDefinition(definition.id).name}</span>
                            <span class="nt-corps-where">{whereabouts(definition.id)}</span>
                        </div>
                        {#if units.some((unit) => gameSession.visibleFace(unit))}
                            <div class="nt-corps-units">
                                {#each units as unit (unit.id)}
                                    <UnitTile {side} face={gameSession.visibleFace(unit)} label="Unit" compact />
                                {/each}
                            </div>
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
                            <div class="nt-corps-units">
                                {#each detached as unit (unit.id)}
                                    <UnitTile {side} face={gameSession.visibleFace(unit)} label="Unit" compact />
                                {/each}
                            </div>
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

    .nt-corps-units {
        display: flex;
        flex-wrap: wrap;
        padding-top: 1px;
    }

    .nt-corps-gone {
        opacity: 0.45;
    }
</style>
