<script lang="ts">
    import { ActionSource } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/railheads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { actionSale, describeAction, saleDescription } from '$lib/utils/describeAction.js'
    import Description from './Description.svelte'

    const gameSession = getGameSession()

    const WAITING_FOR: Partial<Record<MachineState, string>> = {
        [MachineState.ChoosingAction]: 'is choosing an action',
        [MachineState.IssuingShare]: 'is choosing a share to issue',
        [MachineState.ChoosingIndustry]: 'is choosing an industry',
        [MachineState.LayingTrack]: 'is laying track'
    }

    const lastStep = $derived.by(() => {
        const actions = gameSession.actions
        const start = actions.findLastIndex((action) => action.source === ActionSource.User)
        return actions
            .slice(start < 0 ? -1 : start)
            .map((action) => ({
                action,
                description: describeAction(action),
                sale: actionSale(action)
            }))
            .filter((entry) => entry.description.length > 0)
    })
    const waitingOn = $derived(gameSession.gameState.activePlayerIds[0])
    const waitingText = $derived(WAITING_FOR[gameSession.gameState.machineState])
</script>

<div class="waiting">
    {#each lastStep as entry (entry.action.id)}
        <div class="last">
            {#if entry.action.playerId}<PlayerName playerId={entry.action.playerId} />{/if}
            <Description description={entry.description} />
            {#if entry.sale}<span>·</span>
                <Description description={saleDescription(entry.sale)} />{/if}
        </div>
    {/each}
    {#if !gameSession.isViewingHistory && waitingOn && waitingText}
        <div class="next"><PlayerName playerId={waitingOn} /> {waitingText}</div>
    {/if}
</div>

<style>
    .waiting {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        text-align: center;
    }

    .last {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 16px;
    }

    .next {
        font-size: 14px;
        color: #5b5a36;
    }
</style>
