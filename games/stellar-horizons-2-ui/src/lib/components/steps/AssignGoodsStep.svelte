<script lang="ts">
    import {
        EARTH_STORAGE,
        MAX_GOODS,
        assignmentLimit,
        canAssignToEarth,
        goodsCount,
        storageLimit,
        tradeGoodDefinition
    } from '@tabletop/stellar-horizons-2'
    import { DISCARD, EARTH } from '$lib/model/selection.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { systemName } from '$lib/utils/presentation.js'
    import { goodName } from '$lib/utils/trade.js'
    import GoodChit from '../GoodChit.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const drawn = $derived(gameState.getPlayerState(playerId).drawnGoods)
    const destinations = $derived(gameSession.assignmentDraft.destinations)
    const current = $derived(gameSession.goodToAssign)
    const chosen = (destination: string) =>
        destinations.filter((candidate) => candidate === destination).length
    const earthGoods = $derived(
        gameState.getPlayerState(playerId).earthGoods.length + chosen(EARTH)
    )
    const bases = $derived(gameState.basesOf(playerId))
    const discarded = $derived(destinations.filter((destination) => destination === DISCARD).length)

    function destinationText(destination: string): string {
        if (destination === EARTH) {
            return 'Earth'
        }
        return destination === DISCARD ? 'discarded for $1B' : systemName(destination)
    }

    function worldTypes(good: (typeof drawn)[number]): string {
        return tradeGoodDefinition(good).producers.join(' or ')
    }
</script>

<div class="sh-step">
    <p class="hint">
        Each good goes to one of your bases with a world of its types, or to Earth if it lists M.
        You may hold {MAX_GOODS} goods in all; goods you discard earn $1B each. Choose a highlighted system
        on the map; Undo takes one back.
    </p>
    <div class="room">
        <span>Earth holds {earthGoods} of {EARTH_STORAGE}</span>
        {#each bases as base (base.systemId)}
            <span
                >{systemName(base.systemId)} takes {assignmentLimit(base) -
                    base.goodsReceived -
                    chosen(base.systemId)} more this turn, holds {base.goods.length +
                    chosen(base.systemId)} of {storageLimit(base)}</span
            >
        {/each}
    </div>
    <div class="goods">
        {#each drawn as good, index (index)}
            {@const destination = destinations[index]}
            <span class="good" class:current={index === destinations.length}>
                <GoodChit {good} size={30} />
                <span class="name">{goodName(good)}</span>
                <span class="where"
                    >{destination === undefined
                        ? index === destinations.length
                            ? `${worldTypes(good)} worlds`
                            : ''
                        : `→ ${destinationText(destination)}`}</span
                >
            </span>
        {/each}
    </div>
    {#if current && gameSession.mapTargets.length === 0}
        <p class="hint">
            {goodName(current)} has nowhere to go: no base with room has a world of its types{canAssignToEarth(
                current
            )
                ? ', and Earth is full'
                : ''}.
        </p>
    {/if}
    <div class="row">
        {#if current}
            <button type="button" onclick={() => gameSession.discardGoodToAssign()}
                >Discard {goodName(current)} for $1B</button
            >
        {/if}
        <span class="note">You hold {goodsCount(gameState, playerId)} goods.</span>
        <button
            type="button"
            class="primary"
            disabled={current !== undefined || gameSession.assignmentProblem !== undefined}
            title={gameSession.assignmentProblem}
            onclick={() => gameSession.commitAssignment()}
        >
            {current
                ? `${drawn.length - destinations.length} to place`
                : discarded > 0
                  ? `Assign goods, $${discarded}B for the rest`
                  : 'Assign goods'}
        </button>
    </div>
</div>

<style>
    .goods {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
    }

    .good {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px 3px 4px;
        border: 1px solid transparent;
        border-radius: 6px;
    }

    .good.current {
        border-color: #7fd3ff;
    }

    .name {
        font-weight: 700;
        color: #e8f1ff;
    }

    .where,
    .note {
        font-size: 12.5px;
        color: #8fa4c2;
    }

    .room {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 16px;
        font-size: 12.5px;
        color: #8fa4c2;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 14px;
    }
</style>
