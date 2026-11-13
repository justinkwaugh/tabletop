<script lang="ts">
    import { ActionSource } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { actionSale, describeAction, saleDescription } from '$lib/utils/describeAction.js'
    import Description from './Description.svelte'

    const gameSession = getGameSession()

    const WAITING_FOR: Partial<Record<MachineState, string>> = {
        [MachineState.FreeBuild]: 'is laying a free first link',
        [MachineState.ChoosingAction]: 'is choosing an action',
        [MachineState.ConstructingTrack]: 'is constructing track',
        [MachineState.DelegatedBuild]: 'is building for another player',
        [MachineState.DevelopingSettlements]: 'is developing settlements',
        [MachineState.OfferingStock]: 'is offering a share'
    }

    // The last player action and the system actions it set off, such as a free first link or a
    // dividend the action track triggered.
    const lastStep = $derived.by(() => {
        const actions = gameSession.actions
        const start = actions.findLastIndex((action) => action.source === ActionSource.User)
        return actions.slice(start < 0 ? -1 : start).map((action) => ({
            action,
            description: describeAction(gameSession.gameState.map, action),
            sale: actionSale(action)
        }))
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
        color: #2f445c;
    }
</style>
