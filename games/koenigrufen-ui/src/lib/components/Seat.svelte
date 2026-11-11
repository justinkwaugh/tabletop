<script lang="ts">
    import { MachineState } from '@tabletop/koenigrufen'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Card from './Card.svelte'
    import CardBack from './CardBack.svelte'

    let {
        playerId,
        showBacks = true,
        openRows = 1
    }: { playerId: string; showBacks?: boolean; openRows?: 1 | 2 } = $props()

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const player = $derived(state.getPlayerState(playerId))
    const fill = $derived(gameSession.colors.getPlayerBgColorValue(playerId))
    const ink = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const active = $derived(state.activePlayerIds.includes(playerId))
    const declarer = $derived(state.contract?.declarerId === playerId)
    const partner = $derived(state.calledKingPlayedBy === playerId && !declarer)
    const passed = $derived(
        state.machineState === MachineState.Bidding && state.auction.passed.includes(playerId)
    )
    const tricks = $derived(gameSession.tricksWonBy(playerId))
    const openHand = $derived(showBacks ? gameSession.openHand(playerId) : undefined)
    const openRowsOfCards = $derived.by(() => {
        const cards = openHand ?? []
        const perRow = Math.ceil(cards.length / openRows)
        return Array.from({ length: openRows }, (_, row) =>
            cards.slice(row * perRow, (row + 1) * perRow)
        ).filter((row) => row.length > 0)
    })
</script>

<div class="seat" class:active {@attach gameSession.cardPlaces.seat(playerId)}>
    <div class="plate" style:background={fill} style:color={ink}>
        <span class="name">{gameSession.getPlayerName(playerId)}</span>
        {#if state.dealerId === playerId}<span class="chip" title="Dealer">D</span>{/if}
        {#if state.forehandId() === playerId}<span class="chip" title="Forehand">F</span>{/if}
    </div>
    <div class="facts">
        {#if declarer}<span class="badge declarer">Declarer</span>{/if}
        {#if partner}<span class="badge partner">Partner</span>{/if}
        {#if passed}<span class="badge">Passed</span>{/if}
        {#if state.tricks.length > 0 || state.machineState === MachineState.Playing}
            <!-- The pile of won tricks and how many; an outline until the first. -->
            <span
                class="won"
                title="{tricks} {tricks === 1 ? 'trick' : 'tricks'}"
                {@attach gameSession.cardPlaces.trickPile(playerId)}
            >
                <span class="pile" class:empty={tricks === 0} class:deep={tricks > 1}></span>
                <span class="count">{tricks}</span>
                <span class="sr-only">{tricks === 1 ? 'trick' : 'tricks'}</span>
            </span>
        {/if}
    </div>
    {#if openHand}
        <div class="open" aria-label="{gameSession.getPlayerName(playerId)}'s open hand">
            {#each openRowsOfCards as cards, row (row)}
                <div class="open-row">
                    {#each cards as cardId (cardId)}
                        <div class="open-card" {@attach gameSession.cardPlaces.heldCard(cardId)}>
                            <Card {cardId} style={gameSession.cardStyle} />
                        </div>
                    {/each}
                </div>
            {/each}
        </div>
    {:else if showBacks && player.handCount > 0}
        <div class="backs" style:--count={player.handCount}>
            {#each { length: player.handCount }, index (index)}
                <div class="back"><CardBack /></div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .seat {
        --card-w: 37px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        color: #f1e7cf;
    }

    .plate {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 12px;
        border-radius: 999px;
        font-weight: 700;
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
    }

    .active .plate {
        outline: 3px solid #f2c94c;
        outline-offset: 2px;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        font-size: 0.7rem;
        background: rgb(0 0 0 / 0.25);
    }

    .facts {
        display: flex;
        gap: 6px;
        font-size: 0.8rem;
        min-height: 1.2em;
    }

    .won {
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }

    /* The won tricks, face down: one card, or a small stack. */
    .pile {
        width: 8px;
        height: 13px;
        border: 1px solid #f1e7cf;
        border-radius: 2px;
        background: #2d3a7c;
    }

    .pile.empty {
        border-style: dashed;
        background: transparent;
        opacity: 0.6;
    }

    .count {
        font-weight: 700;
    }

    .pile.deep {
        box-shadow:
            1px -1px 0 #2d3a7c,
            2px -2px 0 #f1e7cf;
    }

    .badge {
        padding: 0 6px;
        border-radius: 4px;
        background: rgb(0 0 0 / 0.3);
    }

    .badge.declarer {
        background: #9b2c2c;
    }

    .badge.partner {
        background: #2c6e49;
    }

    .backs {
        display: flex;
    }

    .back + .back {
        margin-left: -24px;
    }

    /* Ouvert: face up, each card overlapping the last but for its corner index. */
    .open {
        --card-w: 60px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .open-row {
        display: flex;
    }

    .open-card + .open-card {
        margin-left: -35px;
    }
</style>
