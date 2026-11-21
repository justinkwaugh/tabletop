<script lang="ts">
    import { locomotiveData } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { locomotiveName } from '$lib/utils/locomotives.js'
    import LocomotiveBadge from './LocomotiveBadge.svelte'

    // Production Capacity as a table of the player's werks. Each press of Add or Upgrade plans one
    // unit and the table shows the werks as they will be; Done buying submits the plan and Undo
    // takes back one press at a time.
    const gameSession = getGameSession()

    const rows = $derived(
        gameSession.myPlants.map((plant) => ({
            plant,
            planned: gameSession.plannedUnits.get(plant.locomotiveId) ?? plant.units,
            unitCost: locomotiveData(plant.locomotiveId).productionCost,
            targets: gameSession.upgradeTargets(plant.locomotiveId)
        }))
    )
</script>

<div class="scroll">
    <table>
        <thead>
            <tr>
                <th>Werk</th>
                <th class="number">Units</th>
                <th>Add</th>
                <th>Upgrade</th>
            </tr>
        </thead>
        <tbody>
            {#each rows as row (row.plant.locomotiveId)}
                {@const changed = row.planned !== row.plant.units}
                <tr class:closing={row.planned === 0}>
                    <td><LocomotiveBadge locomotiveId={row.plant.locomotiveId} /></td>
                    <td class="number">
                        {#if changed}<span class="was">{row.plant.units} →</span>{/if}<span
                            class="units"
                            class:changed>{row.planned}</span
                        >
                    </td>
                    <td>
                        <button
                            type="button"
                            class="buy"
                            disabled={!gameSession.canPlan({
                                locomotiveId: row.plant.locomotiveId
                            })}
                            onclick={() =>
                                gameSession.planStep({ locomotiveId: row.plant.locomotiveId })}
                            aria-label="Add a unit to {locomotiveName(
                                row.plant.locomotiveId
                            )} for ${row.unitCost}">+1 · ${row.unitCost}</button
                        >
                    </td>
                    <td>
                        <div class="upgrades">
                            {#each row.targets as target (target.locomotiveId)}
                                {@const step = {
                                    locomotiveId: target.locomotiveId,
                                    from: row.plant.locomotiveId
                                }}
                                <button
                                    type="button"
                                    class="buy"
                                    disabled={!gameSession.canPlan(step)}
                                    onclick={() => gameSession.planStep(step)}
                                    aria-label="Upgrade a unit to {locomotiveName(
                                        target.locomotiveId
                                    )} for ${target.costPerUnit}"
                                    >1 → <LocomotiveBadge locomotiveId={target.locomotiveId} /> · ${target.costPerUnit}</button
                                >
                            {:else}
                                <span class="none">—</span>
                            {/each}
                        </div>
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .scroll {
        max-width: 100%;
        overflow-x: auto;
    }

    table {
        border-collapse: collapse;
        font-size: 14px;
    }

    th {
        border-bottom: 1.5px solid #a7b8c5;
        padding: 2px 10px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-align: left;
        text-transform: uppercase;
        color: #46596b;
    }

    td {
        border-bottom: 1px solid #d0dae2;
        padding: 4px 10px;
        vertical-align: middle;
    }

    .number {
        text-align: center;
        white-space: nowrap;
    }

    .units {
        font-size: 20px;
        font-weight: 700;
    }

    .units.changed {
        color: #8a5a00;
    }

    .was {
        margin-right: 4px;
        font-size: 13px;
        color: #627688;
    }

    tr.closing td:first-child {
        opacity: 0.5;
        text-decoration: line-through;
    }

    .upgrades {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .buy {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1.5px solid #232d36;
        border-radius: 999px;
        padding: 2px 10px;
        font-weight: 700;
        white-space: nowrap;
    }

    .buy:hover:not(:disabled) {
        background: rgba(35, 45, 54, 0.1);
    }

    .buy:disabled {
        opacity: 0.35;
    }

    .none {
        color: #92a0ab;
    }

    @media (max-width: 639px) {
        th,
        td {
            padding-inline: 4px;
        }

        th {
            font-size: 9.5px;
            letter-spacing: 0.02em;
        }

        .buy {
            padding-inline: 6px;
        }

        .upgrades .buy {
            flex-wrap: wrap;
            justify-content: center;
            border-radius: 12px;
            white-space: normal;
        }
    }
</style>
