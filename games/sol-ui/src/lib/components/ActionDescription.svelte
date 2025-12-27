<script lang="ts">
    import { isAggregatedMove, type AggregatedMove } from '$lib/aggregates/aggregatedMove.js'
    import type { GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        Activate,
        ActivateBonus,
        ActivateEffect,
        DrawCards,
        EffectType,
        isActivate,
        isActivateBonus,
        isActivateEffect,
        isChooseActivate,
        isChooseCard,
        isChooseConvert,
        isChooseMove,
        isConvert,
        isDrawCards,
        isPass,
        isSolarFlare,
        PassContext,
        StationType
    } from '@tabletop/sol'
    import Card from './Card.svelte'
    import { nanoid } from 'nanoid'
    import { StationNames } from '$lib/utils/stationNames.js'

    let {
        action,
        justify = 'start'
    }: { action: GameAction; justify?: 'start' | 'center' | 'end' } = $props()

    const hasActivateMetadata = (action: Activate | ActivateBonus | ActivateEffect | DrawCards) => {
        return (
            (action.metadata?.createdSundiverIds?.length ?? 0) > 0 ||
            (action.metadata?.energyAdded ?? 0) > 0 ||
            (action.metadata?.momentumAdded ?? 0) > 0
        )
    }
</script>

{#snippet commonActivateMetadata(action: Activate | ActivateBonus | ActivateEffect | DrawCards)}
    {#if action.metadata?.createdSundiverIds?.length ?? 0 > 0}<li>
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
{/snippet}

{#if isActivate(action)}
    activated <PlayerName
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        playerId={action.metadata?.activatedStation?.playerId}
        possessive={true}
        plainSelfPossessive={true}
        possessivePlayerId={action.playerId}
    />
    {#if action.metadata?.activatedStation?.type === StationType.EnergyNode}energy node{:else if action.metadata?.activatedStation?.type === StationType.SundiverFoundry}sundiver
        foundry{:else}transmit tower{/if}<br />
    <ul class="ms-4 list-inside">
        {#if action.metadata?.sundiverId}<li>1 sundiver recalled</li>{/if}
        {@render commonActivateMetadata(action)}
    </ul>
{:else if isActivateBonus(action)}
    accepted the bonus
    <ul class="ms-4 list-inside">
        {@render commonActivateMetadata(action)}
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
        {#if action.stationFlown}<li>
                Juggernaut {StationNames[action.stationFlown.type]} flown
            </li>{/if}
        {#if action.stationHurled}<li>
                Juggernaut {StationNames[action.stationHurled.type]} hurled
            </li>{/if}
        {#if action.energyGained > 0}<li>{action.energyGained} energy gained</li>{/if}
        {#if action.momentumGained > 0}<li>{action.momentumGained} momentum gained</li>{/if}
        {#each action.paidPlayerIds as playerId (playerId)}<li>
                <PlayerName {playerId} fontFamily="ui-sans-serif, system-ui, sans-serif" /> earned 1
                energy cube
            </li>{/each}
    </ul>
{:else if isDrawCards(action)}
    drew {action.metadata?.drawnCards.length} card{(action.metadata?.drawnCards.length ?? 1) === 1
        ? ''
        : 's'}
    {#if hasActivateMetadata(action)}
        <br />Squeeze succeeded!
        <ul class="ms-4 list-inside">
            {@render commonActivateMetadata(action)}
        </ul>
    {/if}
    {#if action.metadata?.removedStation}
        <br />Squeeze failed! The {StationNames[action.metadata.removedStation.type]} was destroyed.
    {/if}
    <div class="flex flex-row justify-{justify} items-center space-x-1 mt-2">
        {#each action.metadata?.drawnCards as card (card.id)}
            <div class="h-[50px] w-[35px]">
                <Card {card} />
            </div>
        {/each}
    </div>
{:else if isChooseCard(action)}
    chose to keep a card
    <div class="flex flex-row justify-{justify} items-center space-x-1 mt-2">
        <div class="h-[50px] w-[35px]">
            <Card card={{ id: nanoid(), suit: action.suit }} />
        </div>
    </div>
{:else if isConvert(action)}
    converted a {#if action.isGate}solar gate{:else}{StationNames[action.stationType!]}{/if}
{:else if isSolarFlare(action)}
    A solar flare occured
    <ul class="ms-4 list-inside">
        <li>Stability decreased to {action.metadata?.newInstability}</li>
        {#each action.metadata?.unstableEnergy ?? [] as unstableEnergy}
            <li>
                <PlayerName
                    possessive={true}
                    playerId={unstableEnergy.playerId}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                /> energy cubes reduced from
                {unstableEnergy.initial} to {unstableEnergy.remaining}
            </li>
        {/each}
        {#if action.metadata?.hurlBonus}
            <li>
                <PlayerName
                    playerId={action.metadata.hurlBonus}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                /> gained 1 hurl bonus momentum
            </li>
        {/if}
    </ul>
{:else if isPass(action)}
    {#if action.context === PassContext.NoCardChoice}
        had no new choice of card
    {:else if action.context === PassContext.DeclinedCard}
        declined to keep a card
    {:else if action.context === PassContext.DoneMoving}
        finished moving
    {:else if action.context === PassContext.DoneActivating}
        finished activating
    {:else if action.context === PassContext.DeclinedBonus}
        declined the bonus
    {:else}
        passed
    {/if}
{:else if isActivateEffect(action)}
    activated the <span class="capitalize">{action.effect}</span> effect.
    {#if action.effect === EffectType.Squeeze && hasActivateMetadata(action)}
        <br />No cards need to be drawn.
        <ul class="ms-4 list-inside">
            {@render commonActivateMetadata(action)}
        </ul>
    {/if}
{:else if isChooseMove(action)}
    chose to move
{:else if isChooseConvert(action)}
    chose to convert
{:else if isChooseActivate(action)}
    chose to activate
{:else}
    {action.type}
{/if}
