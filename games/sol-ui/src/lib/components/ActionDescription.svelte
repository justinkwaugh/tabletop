<script lang="ts">
    import { isAggregatedMove, type AggregatedMove } from '$lib/aggregates/aggregatedMove.js'
    import type { GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { isActivate, StationType } from '@tabletop/sol'

    let { action }: { action: GameAction } = $props()
</script>

{#if isActivate(action)}
    activated <PlayerName
        playerId={action.metadata?.activatedStation?.playerId}
        possessive={true}
    />
    {#if action.metadata?.activatedStation?.type === StationType.EnergyNode}energy node{:else if action.metadata?.activatedStation?.type === StationType.SundiverFoundry}sundiver
        foundry{:else}transmit tower{/if}<br />
    <ul class="ms-4 list-inside">
        {#if action.metadata?.sundiverId}<li>1 sundiver recalled</li>{/if}
        {#if action.metadata?.createdSundiverIds ?? 0 > 0}<li>
                {action.metadata?.createdSundiverIds.length} sundiver{action.metadata
                    ?.createdSundiverIds.length === 1
                    ? ''
                    : 's'} built
            </li>{/if}
        {#if action.metadata?.energyAdded ?? 0 > 0}<li>
                {action.metadata?.energyAdded} energy cube{action.metadata?.energyAdded === 1
                    ? ''
                    : 's'} added
            </li>{/if}
        {#if action.metadata?.momentumAdded ?? 0 > 0}<li>
                {action.metadata?.momentumAdded} momentum added
            </li>{/if}
    </ul>
{:else if isAggregatedMove(action)}
    moved
    <ul class="ms-4 list-inside">
        {#if action.numLaunched > 0}<li>
                {action.numLaunched} sundiver{action.numLaunched === 1 ? '' : 's'} launched
            </li>{/if}
        {#if action.numFlown > 0}<li>
                {action.numFlown} sundiver{action.numFlown === 1 ? '' : 's'} flown
            </li>{/if}
        {#if action.numHurled > 0}<li>
                {action.numHurled} sundiver{action.numHurled === 1 ? '' : 's'} hurled
            </li>{/if}
        {#if action.momentumGained > 0}<li>{action.momentumGained} momentum gained</li>{/if}
        {#each action.paidPlayerIds as playerId (playerId)}<li>
                <PlayerName {playerId} /> paid 1 energy cube
            </li>{/each}
    </ul>
{:else}
    {action.type}
{/if}
