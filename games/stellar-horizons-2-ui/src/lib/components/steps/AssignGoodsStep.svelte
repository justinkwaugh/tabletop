<script lang="ts">
    import {
        MAX_GOODS,
        canAssignToEarth,
        tradeGoodDefinition,
        type TradeGood
    } from '@tabletop/stellar-horizons-2'
    import { DISCARDED, type GoodsDestination } from '$lib/model/selection.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { goodName, holderName } from '$lib/utils/trade.js'
    import GoodChit from '../GoodChit.svelte'

    const gameSession = getGameSession()
    const drawn = $derived(gameSession.drawnGoods)
    const destinations = $derived(gameSession.assignmentDraft.destinations)
    const current = $derived(gameSession.goodToAssign)
    const discarded = $derived(
        destinations.filter((destination) => destination.kind === DISCARDED.kind).length
    )

    function destinationText(destination: GoodsDestination): string {
        return destination.kind === DISCARDED.kind ? 'discarded for $1B' : holderName(destination)
    }

    function worldTypes(good: TradeGood): string {
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
        {#if gameSession.earthRoom}
            <span
                >Earth holds {gameSession.earthRoom.stored} of {gameSession.earthRoom.storage}</span
            >
        {/if}
        {#each gameSession.baseRooms as room (room.store.systemId)}
            <span
                >{holderName(room.store)} takes {room.intake} more this turn, holds {room.stored} of
                {room.storage}</span
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
                gameSession.gameState,
                gameSession.myPlayerId ?? '',
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
        <span class="note">You hold {gameSession.heldGoods} goods.</span>
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
