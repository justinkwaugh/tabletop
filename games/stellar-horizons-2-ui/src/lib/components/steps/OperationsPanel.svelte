<script lang="ts">
    // Mining, research and terraforming with mining ships: exploration actions on a chosen world
    // (rulebook 1.17 and 1.18).
    import {
        OperationKind,
        canOperate,
        isMine,
        isResearch,
        isStartTurn,
        miningTarget,
        researchTarget,
        operableWorldSlots,
        shipDefinition,
        shipTerraformSlots,
        worldFace,
        worldTile,
        type ShipState
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { plural, rollChance, systemName } from '$lib/utils/presentation.js'
    import ShipTile from '../ShipTile.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const me = $derived(gameSession.myPlayerId ?? '')
    const ships = $derived(
        gameState
            .shipsOf(me)
            .filter(
                (ship) =>
                    canOperate(gameState, ship, OperationKind.Mining) ||
                    canOperate(gameState, ship, OperationKind.Research) ||
                    shipTerraformSlots(gameState, ship).length > 0
            )
    )

    // This turn's mining and research, which also explain why a ship's system offers no more.
    const results = $derived.by(() => {
        const actions = gameSession.actions
        const turnStart = actions.findLastIndex((action) => isStartTurn(action))
        return actions.slice(turnStart + 1).flatMap((action) => {
            if ((!isMine(action) && !isResearch(action)) || action.playerId !== me) {
                return []
            }
            const result = action.metadata
            if (!result) {
                return []
            }
            const name = shipDefinition(action.shipId).name
            const where = systemName(result.systemId)
            const roll = `rolled ${result.roll}, needing ${result.target} or less`
            const text = isMine(action)
                ? `${name} mined ${where}: ${roll}, so $${result.cash}B`
                : `${name} researched ${where}: ${roll}, so ${
                      result.success && result.field
                          ? plural(1, `${result.field.toLowerCase()} marker`)
                          : 'no marker'
                  }`
            return [{ id: action.id, text }]
        })
    })
    const queuedTerraforms = $derived(
        gameState.getPlayerState(me).shipTerraforms.map((terraform) => {
            const world = gameState.systemState(terraform.systemId).worlds[terraform.slot]
            const worldClass = worldTile(world.tileId).worldClass
            return {
                id: terraform.shipId,
                text: `${shipDefinition(terraform.shipId).name} terraforms ${worldClass} at ${systemName(terraform.systemId)} once everyone has finished exploring`
            }
        })
    )
    const reports = $derived([...results, ...queuedTerraforms])

    function worlds(ship: ShipState) {
        return operableWorldSlots(gameState, ship.systemId).map((slot) => {
            const world = gameState.systemState(ship.systemId).worlds[slot]
            return { slot, world, face: worldFace(world.tileId, world.side) }
        })
    }
</script>

{#if ships.length > 0 || reports.length > 0}
    <div class="prompt">Mine, research or terraform</div>
    {#if reports.length > 0}
        <ul class="results" aria-label="Mining, research and terraforming">
            {#each reports as report (report.id)}
                <li>{report.text}</li>
            {/each}
            {#if results.length > 0}
                <li class="note">A Player mines or researches each system once a turn.</li>
            {/if}
        </ul>
    {/if}
    <div class="operations">
        {#each ships as ship (ship.shipId)}
            {@const definition = shipDefinition(ship.shipId)}
            {@const terraformSlots = shipTerraformSlots(gameState, ship)}
            <div class="operation">
                <ShipTile
                    ship={definition}
                    named={false}
                    label="{definition.name} at {systemName(ship.systemId)}"
                />
                <div class="choices">
                    <span class="where">{definition.name} at {systemName(ship.systemId)}</span>
                    {#each worlds(ship) as { slot, world, face } (slot)}
                        {@const worldClass = worldTile(world.tileId).worldClass}
                        {#if face && canOperate(gameState, ship, OperationKind.Mining)}
                            {@const target = miningTarget(gameState, ship, slot)}
                            <button
                                type="button"
                                title="$2B on a roll of {target} or less, otherwise $1B"
                                onclick={() => gameSession.mine(ship.shipId, slot)}
                                >Mine {worldClass} ({rollChance(target)} for $2B)</button
                            >
                        {/if}
                        {#if face && canOperate(gameState, ship, OperationKind.Research)}
                            {@const target = researchTarget(gameState, ship, slot)}
                            <button
                                type="button"
                                title="A {face.techField.toLowerCase()} marker on a roll of {target} or less"
                                onclick={() => gameSession.research(ship.shipId, slot)}
                                >Research {worldClass} ({rollChance(target)} for {face.techField.toLowerCase()})</button
                            >
                        {/if}
                        {#if terraformSlots.includes(slot)}
                            <button
                                type="button"
                                title="Terraformed once everyone has finished exploring"
                                onclick={() => gameSession.terraformWithShip(ship.shipId, slot)}
                                >Terraform {worldClass}</button
                            >
                        {/if}
                    {/each}
                </div>
            </div>
        {/each}
    </div>
{/if}

<style>
    .operations {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .operation {
        display: flex;
        gap: 10px;
        align-items: center;
    }

    .choices {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
    }

    .results {
        font-size: 13px;
        color: #c9d6ea;
    }

    .results .note {
        font-size: 12px;
        color: #8fa4c2;
    }

    .where {
        font-weight: 700;
        color: #e8f1ff;
    }
</style>
