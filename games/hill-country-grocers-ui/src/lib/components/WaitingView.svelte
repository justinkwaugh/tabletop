<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { actionSale, describeAction, saleDescription } from '$lib/utils/describeAction.js'
    import Description from './Description.svelte'

    const gameSession = getGameSession()

    const WAITING_FOR: Partial<Record<MachineState, string>> = {
        [MachineState.PlacingBonusCube]: 'may place a Streamside Sisters store',
        [MachineState.ChoosingAction]: 'is choosing an action',
        [MachineState.BuildingNetwork]: 'is building a transport network',
        [MachineState.DevelopingTowns]: 'is developing cities',
        [MachineState.StartingAuction]: 'is choosing a share to auction'
    }

    const lastAction = $derived(gameSession.actions.at(-1))
    const sale = $derived(lastAction ? actionSale(lastAction) : undefined)
    const waitingOn = $derived(gameSession.gameState.activePlayerIds[0])
    const waitingText = $derived(WAITING_FOR[gameSession.gameState.machineState])
</script>

<div class="waiting">
    {#if lastAction}
        <div class="last">
            {#if lastAction.playerId}<PlayerName playerId={lastAction.playerId} />{/if}
            <Description description={describeAction(lastAction)} />
            {#if sale}<span>·</span> <Description description={saleDescription(sale)} />{/if}
        </div>
    {/if}
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
        padding: 6px 10px;
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
        font-size: 15px;
        color: #7a4a2e;
    }
</style>
