<script lang="ts">
    import { MediaQuery } from 'svelte/reactivity'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Card from './Card.svelte'
    import CardBack from './CardBack.svelte'
    import Hand from './Hand.svelte'
    import HandSummary from './HandSummary.svelte'
    import Seat from './Seat.svelte'
    import Talon from './Talon.svelte'
    import TrickArea from './TrickArea.svelte'
    import { TalonPlace } from '$lib/utils/talonView.js'

    let { room }: { room?: { width: number; height: number } } = $props()

    const gameSession = getGameSession()
    const seats = $derived(gameSession.seatsFromMe)
    // Phones get a narrower table, nearly the shape of the room under the action area, with the
    // hand in one row of larger, overlapping cards.
    const narrow = new MediaQuery('max-width: 640px')
    // The phone table is this wide and as tall as the room's shape allows, within limits.
    const PortraitWidth = 740
    const portraitHeight = $derived(
        room && room.width > 0 && room.height > 0
            ? Math.round(Math.min(Math.max((PortraitWidth * room.height) / room.width, 780), 1300))
            : 800
    )
    // The trick grows into the room above my hand. Up to 1.5 times it fits between the side seats;
    // beyond that, up to 1.8, only once it starts below them.
    const trickScale = $derived.by(() => {
        const middle = (portraitHeight - 194) / 2
        const fits = Math.min((portraitHeight - 466) / 300, Math.max(1.5, (middle - 280) / 150))
        return Math.min(Math.max(fits, 1), 1.8)
    })

    // Closing the summary hides it until the next hand ends.
    let closedAfterHand: number | undefined = $state()
    const handsPlayed = $derived(gameSession.scoreSheet.hands.length)
</script>

<div
    class="table"
    class:portrait={narrow.current}
    style:--table-h={narrow.current ? `${portraitHeight}px` : undefined}
    style:--trick-scale={narrow.current ? trickScale : undefined}
    style:--talon-scale={narrow.current ? Math.min(trickScale, 1.1) : undefined}
    data-drop-zone
    {@attach gameSession.cardPlaces.board()}
>
    <div class="talon"><Talon place={TalonPlace.Corner} /></div>
    <div class="seat top">
        <Seat playerId={seats[2]} />
    </div>
    <div class="seat left">
        <Seat playerId={seats[3]} openRows={narrow.current ? 2 : 1} />
    </div>
    <div class="seat right">
        <Seat playerId={seats[1]} openRows={narrow.current ? 2 : 1} />
    </div>
    <div class="center"><TrickArea /></div>
    <div class="middle-talon"><Talon place={TalonPlace.Middle} /></div>
    {#if gameSession.showsHandSummary && gameSession.lastHandResult && closedAfterHand !== handsPlayed}
        <div class="hand-summary">
            <HandSummary
                result={gameSession.lastHandResult}
                onclose={() => (closedAfterHand = handsPlayed)}
            />
        </div>
    {/if}
    {#if gameSession.flyingCards.length > 0}
        <div class="flights" aria-hidden="true">
            {#each gameSession.flyingCards as card (card.key)}
                <div
                    class="flying"
                    style:left="{card.left}px"
                    style:top="{card.top}px"
                    style:--card-w="{card.width}px"
                    {@attach gameSession.cardFlights.attach(card.key)}
                >
                    {#if card.cardId}
                        <Card cardId={card.cardId} style={gameSession.cardStyle} />
                    {:else}
                        {#each { length: card.count ?? 1 }, index (index)}
                            <div class="packet-back" style:--i={index}><CardBack /></div>
                        {/each}
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
    <div class="me">
        <div data-drop-edge><Seat playerId={seats[0]} showBacks={false} /></div>
        <Hand cardWidth={narrow.current ? 134 : 112} width={narrow.current ? 724 : 1000} />
    </div>
</div>

<style>
    .table {
        position: relative;
        width: 1200px;
        height: 860px;
        border-radius: 28px;
        background: radial-gradient(ellipse at center, #2f6b45 0%, #1f4d31 70%, #173b26 100%);
        box-shadow: inset 0 0 40px rgb(0 0 0 / 0.5);
    }

    /* The trick, side seats and middle talon centre on the room between the top seat and my hand. */
    .table.portrait {
        --middle: calc((var(--table-h) - 194px) / 2);
        width: 740px;
        height: var(--table-h);
    }

    .talon {
        position: absolute;
        top: 16px;
        left: 20px;
    }

    .seat {
        position: absolute;
    }

    .top {
        top: 18px;
        left: 50%;
        transform: translateX(-50%);
    }

    .left {
        top: 300px;
        left: 40px;
    }

    .right {
        top: 300px;
        right: 40px;
    }

    .portrait .left,
    .portrait .right {
        top: 150px;
    }

    .portrait .left {
        left: 16px;
    }

    .portrait .right {
        right: 16px;
    }

    /* Above the hand, so a card played from it flies over the rest. */
    .center {
        position: absolute;
        z-index: 2;
        top: 150px;
        left: 50%;
        transform: translateX(-50%);
    }

    .portrait .center {
        top: calc(var(--middle) - 150px * var(--trick-scale));
        scale: var(--trick-scale);
        transform-origin: top center;
    }

    /* Centred on the trick area, which is empty while the talon is in the middle. */
    .middle-talon {
        position: absolute;
        z-index: 3;
        top: 300px;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    /* Low enough to clear the side seats on a short table. */
    .portrait .middle-talon {
        top: max(var(--middle), 375px);
        scale: var(--talon-scale);
    }

    .hand-summary {
        position: absolute;
        top: 140px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 5;
    }

    /* On phones the summary covers the seats instead of the hand, a little larger to stay readable. */
    .portrait .hand-summary {
        top: 14px;
        --summary-scale: 1.15;
        --summary-height: calc(var(--table-h) - 340px);
    }

    /* Over the seats and hand, under the hand summary. */
    .flights {
        position: absolute;
        inset: 0;
        z-index: 4;
        pointer-events: none;
    }

    /* As wide as the place it left, with a narrower pack's card centred in it. */
    .flying {
        position: absolute;
        display: flex;
        justify-content: center;
        width: var(--card-w);
    }

    /* A packet: backs fanned a little from the first. */
    .packet-back + .packet-back {
        position: absolute;
        top: calc(var(--i) * -2px);
        left: calc(var(--i) * 3px);
    }

    .me {
        position: absolute;
        bottom: 14px;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
</style>
