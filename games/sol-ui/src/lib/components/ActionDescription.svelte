<script lang="ts">
    import { isAggregatedMove, type AggregatedMove } from '$lib/aggregates/aggregatedMove.js'
    import { type GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import {
        Activate,
        ActivateBonus,
        ActivateEffect,
        DrawCards,
        EffectType,
        isAccelerate,
        isActivate,
        isActivateBonus,
        isActivateEffect,
        isBlight,
        isChain,
        isChooseActivate,
        isChooseCard,
        isChooseConvert,
        isChooseMove,
        isConvert,
        isDeconstruct,
        isDrawCards,
        isFuel,
        isHatch,
        isInvade,
        isMetamorphosize,
        isPass,
        isSacrifice,
        isSolarFlare,
        isTribute,
        PassContext,
        StationType
    } from '@tabletop/sol'
    import Card from './Card.svelte'
    import { nanoid } from 'nanoid'
    import { StationNameArticles, StationNames } from '$lib/utils/stationNames.js'

    let {
        action,
        justify = 'start',
        history = true
    }: { action: GameAction; justify?: 'start' | 'center' | 'end'; history?: boolean } = $props()

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
            {action.metadata?.energyAdded} energy added
        </li>{/if}
    {#if action.metadata?.momentumAdded ?? 0 > 0}<li>
            {action.metadata?.momentumAdded} momentum added
        </li>{/if}
{/snippet}

{#if isActivate(action)}
    activated <PlayerName
        fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
        playerId={action.metadata?.activatedStation?.playerId}
        possessive={true}
        plainSelfPossessive={true}
        possessivePlayerId={action.playerId}
        additionalClasses={history ? '' : 'pt-[2px]'}
        capitalization={history ? 'capitalize' : 'uppercase'}
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
                <PlayerName
                    {playerId}
                    fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
                    additionalClasses={history ? '' : 'pt-[2px]'}
                    capitalization={history ? 'capitalize' : 'uppercase'}
                /> earned 1 energy
            </li>{/each}
    </ul>
{:else if isDrawCards(action)}
    drew {action.metadata?.drawnCards.length} card{(action.metadata?.drawnCards.length ?? 1) === 1
        ? ''
        : 's'}

    {#if action.metadata?.effect === EffectType.Pillar && action.suitGuess}
        {#if action.metadata?.momentumAdded ?? 0 > 0}
            <br />Guessed {action.suitGuess} correctly
            <ul class="ms-4 list-inside">
                {@render commonActivateMetadata(action)}
            </ul>
        {:else}
            <br />Guessed {action.suitGuess} incorrectly
        {/if}
    {:else if action.metadata?.effect === EffectType.Squeeze}
        {#if hasActivateMetadata(action)}
            <br />Squeeze succeeded!
            <ul class="ms-4 list-inside">
                {@render commonActivateMetadata(action)}
            </ul>
        {:else if action.metadata?.removedStation}
            <br />Squeeze failed! The {StationNames[action.metadata.removedStation.type]} was destroyed.
        {/if}
    {:else if action.metadata?.effect === EffectType.Channel}
        <br />Channel effect applied
        <ul class="ms-4 list-inside">
            {@render commonActivateMetadata(action)}
        </ul>
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
    converted {#if action.isGate}a solar gate{:else}{StationNameArticles[action.stationType!]}
        {StationNames[action.stationType!]}{/if}
{:else if isSolarFlare(action)}
    A solar flare occured
    <ul class="ms-4 list-inside">
        <li>Stability decreased to {action.metadata?.newInstability}</li>
        {#each action.metadata?.unstableEnergy ?? [] as unstableEnergy}
            <li>
                <PlayerName
                    possessive={true}
                    playerId={unstableEnergy.playerId}
                    fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
                    additionalClasses={history ? '' : 'pt-[2px]'}
                    capitalization={history ? 'capitalize' : 'uppercase'}
                /> energy reduced from
                {unstableEnergy.initial} to {unstableEnergy.remaining}
            </li>
        {/each}
        {#if action.metadata?.hurlBonus}
            <li>
                <PlayerName
                    playerId={action.metadata.hurlBonus}
                    fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
                    additionalClasses={history ? '' : 'pt-[2px]'}
                    capitalization={history ? 'capitalize' : 'uppercase'}
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
    applied the <span class={history ? 'capitalize' : 'uppercase'}>{action.effect}</span> effect
    {#if hasActivateMetadata(action)}
        {#if action.effect === EffectType.Squeeze}
            <br />No cards need to be drawn.
        {/if}
        <ul class="ms-4 list-inside">
            {@render commonActivateMetadata(action)}
        </ul>
    {:else if action.effect === EffectType.Procreate}
        <ul class="ms-4 list-inside">
            <li>
                {action.metadata?.createdSundiverIds.length} sundiver{(action.metadata
                    ?.createdSundiverIds.length ?? 1) === 1
                    ? ''
                    : 's'} added.
            </li>
        </ul>
    {/if}
{:else if isChooseMove(action)}
    chose to move
{:else if isChooseConvert(action)}
    chose to convert
{:else if isChooseActivate(action)}
    chose to activate
{:else if isDeconstruct(action)}
    deconstructed {StationNameArticles[action.metadata!.removedStation.type]}
    {StationNames[action.metadata!.removedStation.type]}
    {#if action.metadata?.oldMovement !== action.metadata?.newMovement}
        <br />
        Movement decreased to {action.metadata?.newMovement}
    {/if}
{:else if isAccelerate(action)}
    moved the motherships {action.amount} spaces
{:else if isBlight(action)}
    blighted <PlayerName
        fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
        playerId={action.targetPlayerId}
        additionalClasses={history ? '' : 'pt-[2px]'}
        capitalization={history ? 'capitalize' : 'uppercase'}
        possessive={true}
    /> mothership
{:else if isChain(action)}
    executed a chain action
    <ul class="ms-4 list-inside">
        {#each Object.entries(action.metadata?.chainResults ?? {}) as [playerId, result]}
            <li>
                <PlayerName
                    fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
                    {playerId}
                    additionalClasses={history ? '' : 'pt-[2px]'}
                    capitalization={history ? 'capitalize' : 'uppercase'}
                /> gained {result.momentumGained} momentum
            </li>
            <li>
                <PlayerName
                    fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
                    {playerId}
                    additionalClasses={history ? '' : 'pt-[2px]'}
                    capitalization={history ? 'capitalize' : 'uppercase'}
                /> recalled {result.sundiverIdsReturned.length} sundiver{result.sundiverIdsReturned
                    .length === 1
                    ? ''
                    : 's'}
            </li>
        {/each}
    </ul>
{:else if isHatch(action)}
    hatched 2 sundivers<br />
    <PlayerName
        fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
        playerId={action.metadata?.replacedSundiver.playerId}
        additionalClasses={history ? '' : 'pt-[2px]'}
        capitalization={history ? 'capitalize' : 'uppercase'}
    /> recalled 1 sundiver
{:else if isMetamorphosize(action)}
    metamorphosized {StationNameArticles[action.metadata!.priorStation.type]}
    {StationNames[action.metadata!.priorStation.type]} into {StationNameArticles[
        action.metadata!.newStation.type
    ]}
    {StationNames[action.metadata!.newStation.type]}
{:else if isInvade(action)}
    invaded <PlayerName
        fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
        playerId={action.metadata?.invadedStation.playerId}
        additionalClasses={history ? '' : 'pt-[2px]'}
        capitalization={history ? 'capitalize' : 'uppercase'}
        possessive={true}
    />
    {StationNames[action.metadata!.invadedStation.type]}
    <ul class="ms-4 list-inside">
        <li>
            {action.metadata?.removedSundiverIds.length} sundivers sacrificed
        </li>
        <li>
            <PlayerName
                fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
                playerId={action.metadata?.invadedStation.playerId}
                additionalClasses={history ? '' : 'pt-[2px]'}
                capitalization={history ? 'capitalize' : 'uppercase'}
            /> received {action.metadata?.addedSundiverIds.length} sundiver{(action.metadata
                ?.addedSundiverIds.length ?? 1) === 1
                ? ''
                : 's'}
        </li>
    </ul>
{:else if isTribute(action)}
    collected tributes
    {#each Object.entries(action.metadata?.payments ?? {}) as [playerId, amount] (playerId)}
        <div class="ms-4">
            <PlayerName
                fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
                {playerId}
                additionalClasses={history ? '' : 'pt-[2px]'}
                capitalization={history ? 'capitalize' : 'uppercase'}
            /> paid {amount} energy
        </div>
    {/each}
{:else if isSacrifice(action)}
    sacrificed
    {#each Object.entries(action.metadata?.numSacrificedPerPlayer ?? {}) as [playerId, amount] (playerId)}
        <div class="ms-4">
            <PlayerName
                fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
                {playerId}
                additionalClasses={history ? '' : 'pt-[2px]'}
                capitalization={history ? 'capitalize' : 'uppercase'}
            /> vaporized {amount} sundiver{amount === 1 ? '' : 's'}
        </div>
        <div class="ms-4">
            <PlayerName
                fontFamily={history ? 'ui-sans-serif, system-ui, sans-serif' : 'inherit'}
                {playerId}
                additionalClasses={history ? '' : 'pt-[2px]'}
                capitalization={history ? 'capitalize' : 'uppercase'}
            /> received {amount} momentum
        </div>
    {/each}
{:else if isFuel(action)}
    used fuel to gain 3 movement points
{:else}
    {action.type}
{/if}
