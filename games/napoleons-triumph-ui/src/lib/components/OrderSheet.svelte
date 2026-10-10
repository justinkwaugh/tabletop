<script lang="ts">
    import {
        ALLIED_CORPS_COMMAND_LIMIT,
        CommandKind,
        Side,
        commanderDefinition,
        independentCommandsLeft
    } from '@tabletop/napoleons-triumph'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { PieceGroup } from '$lib/utils/pieceLayout.js'
    import UnitTile from './UnitTile.svelte'

    const gameSession = getGameSession()

    const group = $derived(gameSession.selectedGroup)
    const side = $derived(gameSession.mySide)
    const picked = $derived(gameSession.pickedUnitIds)
    const options = $derived(gameSession.commandOptions)
    const kind = $derived(gameSession.commandKind)

    const COMMAND_NAMES: Record<CommandKind, string> = {
        [CommandKind.Corps]: 'Corps move',
        [CommandKind.Detach]: 'Detach and move',
        [CommandKind.Unit]: 'Independent move'
    }

    const title = $derived(
        group?.commander ? `${commanderDefinition(group.commander.id).name}’s corps` : 'Detached units'
    )

    const commandsNote = $derived.by(() => {
        const playerId = gameSession.myPlayerId
        if (!playerId || !side) {
            return ''
        }
        const state = gameSession.gameState
        const independent = `${independentCommandsLeft(state, playerId)} independent`
        if (side !== Side.Allied) {
            return `${independent} commands left`
        }
        const corps = ALLIED_CORPS_COMMAND_LIMIT - state.getPlayerState(playerId).corpsCommandsUsed
        return `${corps} corps and ${independent} commands left`
    })

    const hint = $derived.by(() => {
        if (!group) {
            return ''
        }
        if (options.length === 0) {
            return picked.length === 0 ? 'Pick the units to command.' : 'No command can move these units now.'
        }
        if (gameSession.targets.length === 0) {
            return 'These units have nowhere to go.'
        }
        if (kind === CommandKind.Corps && picked.length < group.units.length) {
            return 'The units left out stay behind, detached.'
        }
        return ''
    })
</script>

{#if group && side}
    <div class="nt-sheet" role="group" aria-label={title}>
        <div class="nt-sheet-title">{title}</div>
        <div class="nt-sheet-units">
            {#each group.units as unit (unit.id)}
                {@const attachTo = gameSession.attachOptions(unit)}
                <div class="nt-sheet-unit">
                    <UnitTile
                        {side}
                        face={gameSession.visibleFace(unit)}
                        selected={picked.includes(unit.id)}
                        dimmed={unit.movesThisTurn !== undefined}
                        marker={unit.fixed ? 'fixed battery' : unit.movesThisTurn !== undefined ? 'moved' : undefined}
                        label="Include this unit in the command"
                        onclick={unit.movesThisTurn === undefined && !unit.fixed
                            ? () => gameSession.togglePickedUnit(unit.id)
                            : undefined}
                    />
                    {#each attachTo as commander (commander.id)}
                        <button
                            type="button"
                            class="nt-plain-button nt-sheet-small"
                            onclick={() => gameSession.attach(commander.id, unit.id)}
                            >Attach to {commanderDefinition(commander.id).name}</button
                        >
                    {/each}
                </div>
            {/each}
        </div>
        {#if options.length > 1}
            <div class="nt-sheet-options">
                {#each options as option (option)}
                    <button
                        type="button"
                        class="nt-plain-button nt-sheet-small"
                        class:nt-chosen={option === kind}
                        aria-pressed={option === kind}
                        onclick={() => gameSession.chooseCommand(option)}>{COMMAND_NAMES[option]}</button
                    >
                {/each}
            </div>
        {:else if kind}
            <div class="nt-sheet-note">{COMMAND_NAMES[kind]}</div>
        {/if}
        {#if gameSession.guardUnitId}
            <button
                type="button"
                class="nt-plain-button nt-sheet-small"
                class:nt-chosen={gameSession.guardAttack}
                aria-pressed={gameSession.guardAttack}
                onclick={() => gameSession.toggleGuardAttack()}>Announce a Guard Attack</button
            >
        {/if}
        {#if hint}
            <div class="nt-sheet-note">{hint}</div>
        {/if}
        <div class="nt-sheet-note nt-sheet-faint">{commandsNote}</div>
    </div>
{/if}

<style>
    .nt-sheet {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 3px 12px;
        padding: 4px 10px 5px;
        border-bottom: 1px solid #2b2620;
        background: #e9e6dc;
        color: #2b2620;
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 13px;
        pointer-events: auto;
    }

    .nt-sheet-title {
        font-size: 15px;
        font-style: italic;
    }

    .nt-sheet-units {
        display: flex;
        flex-wrap: wrap;
        gap: 1px 3px;
    }

    .nt-sheet-unit {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .nt-sheet-options {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .nt-sheet :global(.nt-sheet-small) {
        font-size: 12px;
        padding: 1px 6px;
        border: 1px solid #2b2620;
        border-radius: 4px;
        background: transparent;
        color: #2b2620;
    }

    .nt-sheet :global(.nt-chosen) {
        background: #2b2620;
        color: #f1ecdc;
    }

    .nt-sheet-note {
        line-height: 1.25;
    }

    .nt-sheet-faint {
        opacity: 0.65;
        font-size: 12px;
    }

    @media (max-width: 639px) {
        .nt-sheet {
            gap: 2px 8px;
            padding: 3px 6px 4px;
            font-size: 12px;
        }

        .nt-sheet-title {
            font-size: 13px;
        }
    }
</style>
