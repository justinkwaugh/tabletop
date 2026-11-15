<script lang="ts">
    // Mining, research and terraforming with mining ships: exploration actions on a chosen world
    // (rulebook 1.17 and 1.18). Each ship that can act shows the worlds of its system; the world
    // is the button, with its chance and what it earns beneath, and Terraform under a world the
    // ship can terraform. This turn's rolls follow as exploration's results do.
    import SystemLink from '../systems/SystemLink.svelte'
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
        type Mine,
        type Research,
        type ShipState
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { FIELD_COLORS, rollChance, systemName } from '$lib/utils/presentation.js'
    import ShipTile from '../ShipTile.svelte'
    import WorldImage from '../WorldImage.svelte'
    import OperationResult from './OperationResult.svelte'

    const WORLD_SIZE = 64

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
        return actions
            .slice(turnStart + 1)
            .filter(
                (action): action is Mine | Research =>
                    (isMine(action) || isResearch(action)) &&
                    action.playerId === me &&
                    action.metadata !== undefined
            )
    })
    const queuedTerraforms = $derived(
        gameState.getPlayerState(me).shipTerraforms.map((terraform) => ({
            ...terraform,
            world: gameState.systemState(terraform.systemId).worlds[terraform.slot]
        }))
    )

    interface WorldChoice {
        slot: number
        tileId: string
        side: (typeof gameState.systems)[number]['worlds'][number]['side']
        worldClass: string
        operation?: { kind: OperationKind; target: number; earns: string; field?: string }
        terraform: boolean
    }

    function worlds(ship: ShipState): WorldChoice[] {
        const terraformSlots = shipTerraformSlots(gameState, ship)
        const mining = canOperate(gameState, ship, OperationKind.Mining)
        const researching = canOperate(gameState, ship, OperationKind.Research)
        return operableWorldSlots(gameState, ship.systemId).flatMap((slot): WorldChoice[] => {
            const world = gameState.systemState(ship.systemId).worlds[slot]
            const face = worldFace(world.tileId, world.side)
            const operation =
                face && mining
                    ? {
                          kind: OperationKind.Mining,
                          target: miningTarget(gameState, ship, slot),
                          earns: '$2B'
                      }
                    : face && researching
                      ? {
                            kind: OperationKind.Research,
                            target: researchTarget(gameState, ship, slot),
                            earns: face.techField.toLowerCase(),
                            field: face.techField
                        }
                      : undefined
            const terraform = terraformSlots.includes(slot)
            if (!operation && !terraform) return []
            return [
                {
                    slot,
                    tileId: world.tileId,
                    side: world.side,
                    worldClass: worldTile(world.tileId).worldClass,
                    operation,
                    terraform
                }
            ]
        })
    }

    function operate(ship: ShipState, choice: WorldChoice) {
        if (choice.operation?.kind === OperationKind.Mining) {
            void gameSession.mine(ship.shipId, choice.slot)
        } else if (choice.operation?.kind === OperationKind.Research) {
            void gameSession.research(ship.shipId, choice.slot)
        } else if (choice.terraform) {
            void gameSession.terraformWithShip(ship.shipId, choice.slot)
        }
    }

    function worldLabel(ship: ShipState, choice: WorldChoice): string {
        const where = `the ${choice.worldClass} world at ${systemName(ship.systemId)}`
        const operation = choice.operation
        if (!operation) return `Terraform ${where} with ${shipDefinition(ship.shipId).name}`
        return operation.kind === OperationKind.Mining
            ? `Mine ${where}: ${rollChance(operation.target)} for $2B, otherwise $1B`
            : `Research ${where}: ${rollChance(operation.target)} for a ${operation.earns} marker`
    }
</script>

{#if ships.length > 0 || results.length > 0 || queuedTerraforms.length > 0}
    <div class="prompt">Mine, research or terraform</div>
    <div class="operations">
        {#each ships as ship (ship.shipId)}
            {@const definition = shipDefinition(ship.shipId)}
            <div class="operation">
                <ShipTile
                    ship={definition}
                    named={false}
                    selected={gameSession.selectedShip?.shipId === ship.shipId}
                    label="Show {definition.name} at {systemName(ship.systemId)}"
                    onclick={() => gameSession.locateShip(ship.shipId)}
                />
                <div class="worlds">
                    {#each worlds(ship) as choice (choice.slot)}
                        {@const operation = choice.operation}
                        <div class="world">
                            <button
                                type="button"
                                class="world-button"
                                aria-label={worldLabel(ship, choice)}
                                title={worldLabel(ship, choice)}
                                onclick={() => operate(ship, choice)}
                            >
                                <WorldImage
                                    tileId={choice.tileId}
                                    side={choice.side}
                                    size={WORLD_SIZE}
                                />
                                {#if operation}
                                    <span class="verb"
                                        >{operation.kind === OperationKind.Mining
                                            ? 'Mine'
                                            : 'Research'}</span
                                    >
                                    <span class="odds">
                                        {rollChance(operation.target)}
                                        {#if operation.field}
                                            <span
                                                class="marker"
                                                style:--field={FIELD_COLORS[
                                                    operation.field as keyof typeof FIELD_COLORS
                                                ]}
                                                title="A {operation.earns} marker"
                                            ></span>
                                        {:else}
                                            <span class="earns">{operation.earns}</span>
                                        {/if}
                                    </span>
                                {:else}
                                    <span class="verb">Terraform</span>
                                {/if}
                            </button>
                            {#if operation && choice.terraform}
                                <button
                                    type="button"
                                    class="terraform"
                                    aria-label="Terraform the {choice.worldClass} world at {systemName(
                                        ship.systemId
                                    )} with {definition.name}"
                                    title="Terraformed once everyone has finished exploring"
                                    onclick={() =>
                                        gameSession.terraformWithShip(ship.shipId, choice.slot)}
                                    >Terraform</button
                                >
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
    {#if results.length > 0 || queuedTerraforms.length > 0}
        <div class="results" role="table" aria-label="Mining, research and terraforming">
            {#each results as action (action.id)}
                <OperationResult {action} {gameState} />
            {/each}
            {#each queuedTerraforms as terraform (terraform.shipId)}
                <div class="queued" role="row">
                    <span class="queued-world">
                        {#if terraform.world}
                            <WorldImage
                                tileId={terraform.world.tileId}
                                side={terraform.world.side}
                                size={40}
                            />
                        {/if}
                    </span>
                    <span class="queued-text"
                        >{shipDefinition(terraform.shipId).name} terraforms {terraform.world
                            ? worldTile(terraform.world.tileId).worldClass
                            : 'a world'} at <SystemLink systemId={terraform.systemId} /> once everyone
                        has finished exploring</span
                    >
                </div>
            {/each}
        </div>
        {#if results.length > 0}
            <p class="note">A Player mines or researches each system once a turn.</p>
        {/if}
    {/if}
{/if}

<style>
    .operations {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .operation {
        display: flex;
        gap: 14px;
        align-items: center;
    }

    .worlds {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .world {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .world-button {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 84px;
        padding: 6px 6px 5px;
        border: 1px solid #2f4366;
        border-radius: 8px;
        background: #0b1220;
    }

    .world-button:hover {
        border-color: #7fd3ff;
        background: #10203a;
    }

    .world-button :global(img) {
        border-radius: 50%;
    }

    .verb {
        font-size: 13px;
        font-weight: 700;
        color: #e8f1ff;
    }

    .odds {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        color: #c9d6ea;
    }

    .earns {
        color: #f4c430;
        font-weight: 700;
    }

    .marker {
        width: 13px;
        height: 13px;
        border-radius: 3px;
        background: var(--field);
    }

    .terraform {
        padding: 1px 10px;
        border: 1px solid #2f4366;
        border-radius: 999px;
        color: #9fd6a6;
        font-size: 12px;
    }

    .terraform:hover {
        border-color: #9fd6a6;
    }

    /* The results sit in their own darker panel, as exploration's do: the world, the ship and
       what it did, the die, and what it earned. */
    .results {
        display: grid;
        grid-template-columns: max-content max-content max-content max-content;
        column-gap: 12px;
        width: fit-content;
        max-width: 100%;
        box-sizing: border-box;
        padding: 2px 14px;
        border: 1px solid #22314d;
        border-radius: 8px;
        background: #070a12;
    }

    .queued {
        display: grid;
        grid-column: span 4;
        grid-template-columns: subgrid;
        align-items: center;
        padding: 6px 0;
        border-top: 1px solid #1a2438;
    }

    .queued:first-child {
        border-top: none;
    }

    .queued-world {
        display: flex;
    }

    .queued-world :global(img) {
        border-radius: 50%;
    }

    .queued-text {
        grid-column: span 3;
        font-size: 13px;
        color: #c9d6ea;
    }

    .note {
        margin: 0;
        font-size: 12px;
        color: #8fa4c2;
    }
</style>
