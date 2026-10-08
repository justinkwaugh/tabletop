<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { ActionType, compareBids, duplicatesBid } from '@tabletop/kogge'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShieldIcon from '../ui/ShieldIcon.svelte'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)
    const bidderId = $derived(game.nextBidderId())
    const myTurn = $derived(gameSession.canAct && bidderId === gameSession.myPlayerId)
    const bid = $derived(gameSession.bid)
    const hand = $derived(gameSession.me?.markers ?? [])
    const handGroups = $derived(
        [...new Set(hand)].map((value) => ({
            value,
            free:
                hand.filter((marker) => marker === value).length -
                bid.filter((marker) => marker === value).length
        }))
    )
    const duplicate = $derived(duplicatesBid(bid, game.madeBids()))
    const rank = $derived(
        bid.length === 0
            ? undefined
            : 1 + game.bids.filter((made) => compareBids(made.markers, bid) > 0).length
    )
    const ordinal = (place: number) => ['1st', '2nd', '3rd', '4th'][place - 1] ?? `${place}th`
</script>

<div class="flex flex-col gap-2">
    {#if myTurn}
        <div class="kogge-prompt">Bid route markers for the turn order</div>
        <div class="kogge-note">
            Identical markers beat mixed ones; otherwise the higher total wins. Every marker you bid
            is spent, and sends two goods to the city it names.
        </div>
    {:else if bidderId}
        <div class="kogge-prompt inline-flex gap-1">
            <PlayerName playerId={bidderId} /> <span>is bidding for the turn order</span>
        </div>
    {/if}

    {#if game.bids.length > 0}
        <div class="flex flex-wrap gap-x-5 gap-y-1">
            {#each game.bids as made (made.playerId)}
                <span class="inline-flex items-center gap-1">
                    <PlayerName playerId={made.playerId} />
                    {#if made.markers.length === 0}
                        <span class="italic opacity-70">no bid</span>
                    {:else}
                        {#each made.markers as value, index (index)}<ShieldIcon
                                {value}
                                size={20}
                            />{/each}
                    {/if}
                </span>
            {/each}
        </div>
    {/if}

    {#if myTurn && gameSession.can(ActionType.PassBid)}
        <div class="flex items-center gap-3">
            <span class="kogge-note"
                >You have no marker combination that has not already been bid.</span
            >
            <button class="kogge-button kogge-button-primary" onclick={() => gameSession.passBid()}
                >Pass</button
            >
        </div>
    {:else if myTurn}
        <div class="flex flex-wrap items-center gap-1">
            <span class="kogge-note mr-1">Your markers:</span>
            {#each handGroups as group (group.value)}
                {#each Array.from({ length: group.free }, (_, index) => index) as copy (copy)}
                    <button
                        class="transition-transform hover:-translate-y-0.5"
                        title="Add {group.value} to your bid"
                        onclick={() => gameSession.toggleBidMarker(group.value, true)}
                    >
                        <ShieldIcon value={group.value} size={30} />
                    </button>
                {/each}
            {/each}
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <span class="kogge-note">Your bid:</span>
            {#if bid.length === 0}
                <span class="italic opacity-60">choose markers above</span>
            {/if}
            {#each bid as value, index (index)}
                <button
                    title="Take {value} back"
                    onclick={() => gameSession.toggleBidMarker(value, false)}
                >
                    <ShieldIcon {value} size={34} />
                </button>
            {/each}
            {#if duplicate}
                <span class="text-[#9e231f] text-sm">Someone has already bid exactly this</span>
            {:else if rank}
                <span class="kogge-note">so far this would put you {ordinal(rank)}</span>
            {/if}
            <button
                class="kogge-button kogge-button-primary ml-auto"
                disabled={bid.length === 0 || duplicate}
                onclick={() => gameSession.placeBid()}>Bid</button
            >
        </div>
    {/if}
</div>
