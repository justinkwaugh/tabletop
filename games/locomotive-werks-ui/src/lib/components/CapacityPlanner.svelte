<script lang="ts">
    import { locomotiveData } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { locomotiveName } from '$lib/utils/locomotives.js'
    import LocomotiveBadge from './LocomotiveBadge.svelte'

    // One line per werk the player owns. Each press plans one unit; Done buying submits the plan.
    const gameSession = getGameSession()
</script>

<ul class="werks" aria-label="Your werks">
    {#each gameSession.myPlants as plant (plant.locomotiveId)}
        {@const werk = plant.locomotiveId}
        {@const unitCost = locomotiveData(werk).productionCost}
        {@const planned = gameSession.plannedUnits.get(werk) ?? plant.units}
        <li class:closing={planned === 0}>
            <span class="werk">
                <LocomotiveBadge locomotiveId={werk} />
                <span class="units"
                    >{planned}
                    {planned === 1 ? 'unit' : 'units'}{#if planned !== plant.units}<span class="was"
                            >was {plant.units}</span
                        >{/if}</span
                >
            </span>
            <span class="buttons">
                <button
                    type="button"
                    class="buy"
                    disabled={!gameSession.canPlan({ locomotiveId: werk })}
                    onclick={() => gameSession.planStep({ locomotiveId: werk })}
                    aria-label="Add a unit to {locomotiveName(werk)} for ${unitCost}"
                    >+1 · ${unitCost}</button
                >
                {#each gameSession.upgradeTargets(werk) as target (target.locomotiveId)}
                    {@const step = { locomotiveId: target.locomotiveId, from: werk }}
                    <button
                        type="button"
                        class="buy"
                        disabled={!gameSession.canPlan(step)}
                        onclick={() => gameSession.planStep(step)}
                        aria-label="Upgrade a unit of {locomotiveName(werk)} to {locomotiveName(
                            target.locomotiveId
                        )} for ${target.costPerUnit}"
                        >→ <LocomotiveBadge locomotiveId={target.locomotiveId} /> · ${target.costPerUnit}</button
                    >
                {/each}
            </span>
        </li>
    {/each}
</ul>

<style>
    .werks {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        max-width: 560px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 4px 10px;
        border-bottom: 1px solid #b2c1cc;
        padding-bottom: 4px;
    }

    li:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }

    .werk {
        display: inline-flex;
        align-items: center;
        gap: 8px;
    }

    .closing .werk {
        opacity: 0.45;
    }

    .units {
        font-size: 15px;
        font-weight: 700;
        white-space: nowrap;
    }

    .was {
        margin-left: 6px;
        font-size: 13px;
        font-weight: 400;
        color: #46596b;
    }

    .buttons {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 4px;
    }

    .buy {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 32px;
        border: 1.5px solid #232d36;
        border-radius: 999px;
        padding: 2px 12px;
        font-size: 14px;
        font-weight: 700;
        white-space: nowrap;
    }

    .buy:hover:not(:disabled) {
        background: rgba(35, 45, 54, 0.1);
    }

    .buy:disabled {
        opacity: 0.35;
    }
</style>
