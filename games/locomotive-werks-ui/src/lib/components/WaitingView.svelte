<script lang="ts">
    import { ActionSource } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { MachineState, isAdjustMarket, isPayTaxes } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction, describeDetails } from '$lib/utils/describeAction.js'
    import Description from './Description.svelte'

    const gameSession = getGameSession()

    const WAITING_FOR: Partial<Record<MachineState, string>> = {
        [MachineState.Developing]: 'is choosing a locomotive to develop',
        [MachineState.ExpandingCapacity]: 'is buying production capacity',
        [MachineState.Shipping]: 'is shipping locomotives'
    }

    // The last player action and the automatic steps it set off, leaving the taxes and the market
    // to the round review.
    const lastStep = $derived.by(() => {
        const actions = gameSession.actions
        const start = actions.findLastIndex((action) => action.source === ActionSource.User)
        return actions
            .slice(start < 0 ? -1 : start)
            .filter((action) => !isPayTaxes(action) && !isAdjustMarket(action))
            .map((action) => ({
                action,
                headline: describeAction(action),
                details: describeDetails(action)
            }))
    })
    const waitingOn = $derived(gameSession.gameState.activePlayerIds[0])
    const waitingText = $derived(WAITING_FOR[gameSession.gameState.machineState])
</script>

<div class="waiting">
    {#each lastStep as entry (entry.action.id)}
        <div class="last">
            {#if entry.action.playerId}<PlayerName playerId={entry.action.playerId} />{/if}
            <Description description={entry.headline} />
        </div>
        {#if entry.details.length > 0}
            <div class="details">
                {#each entry.details as line, index (index)}
                    <div class="detail"><Description description={line} /></div>
                {/each}
            </div>
        {/if}
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
        gap: 3px;
        text-align: center;
    }

    .last,
    .detail {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }

    .last {
        font-size: 16px;
    }

    .details {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 2px 14px;
        font-size: 13px;
        color: #4b4128;
    }

    .next {
        font-size: 14px;
        color: #46596b;
    }
</style>
