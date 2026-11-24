<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { locomotiveData } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { locomotiveName } from '$lib/utils/locomotives.js'
    import LocomotiveBadge from '../LocomotiveBadge.svelte'

    // Each press plans one unit; the picker stays open so a player can plan several.
    const gameSession = getGameSession()

    const werk = $derived(gameSession.openedWerk)
</script>

{#if werk}
    {@const unitCost = locomotiveData(werk).productionCost}
    {@const planned = gameSession.plannedUnits.get(werk) ?? 0}
    {#key werk}
        <Floater
            placement="bottom"
            reference="#lw-works-{gameSession.myPlayerId}-{werk}"
            onClose={() => gameSession.closeWerkPicker()}
        >
            <div class="picker">
                <div class="title">
                    <LocomotiveBadge locomotiveId={werk} />
                    <span>{planned} {planned === 1 ? 'unit' : 'units'}</span>
                </div>
                <button
                    type="button"
                    class="buy"
                    disabled={!gameSession.canPlan({ locomotiveId: werk })}
                    onclick={() => gameSession.planStep({ locomotiveId: werk })}
                    aria-label="Add a unit to {locomotiveName(werk)} for ${unitCost}"
                    >+1 unit · ${unitCost}</button
                >
                {#each gameSession.upgradeTargets(werk) as target (target.locomotiveId)}
                    {@const step = { locomotiveId: target.locomotiveId, from: werk }}
                    <button
                        type="button"
                        class="buy"
                        disabled={!gameSession.canPlan(step)}
                        onclick={() => gameSession.planStep(step)}
                        aria-label="Upgrade a unit to {locomotiveName(
                            target.locomotiveId
                        )} for ${target.costPerUnit}"
                        >Upgrade 1 → <LocomotiveBadge locomotiveId={target.locomotiveId} /> · ${target.costPerUnit}</button
                    >
                {/each}
                <p>${gameSession.plannedCash} left to spend</p>
            </div>
        </Floater>
    {/key}
{/if}

<style>
    .picker {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 5px;
        border: 2px solid #232d36;
        border-radius: 12px;
        background: #e9eef2;
        padding: 8px 10px;
        box-shadow: 0 8px 18px rgba(16, 28, 40, 0.3);
        color: #232d36;
        font-family: 'LW Baskerville', Georgia, serif;
    }

    .title {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 15px;
        font-weight: 700;
    }

    .buy {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        border: 1.5px solid #232d36;
        border-radius: 999px;
        padding: 4px 12px;
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

    p {
        margin: 0;
        font-size: 13px;
        text-align: center;
        color: #46596b;
    }
</style>
