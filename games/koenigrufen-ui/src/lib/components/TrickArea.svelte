<script lang="ts">
    import type { TrickPlay } from '@tabletop/koenigrufen'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Card from './Card.svelte'

    const gameSession = getGameSession()
    const animator = gameSession.trickAnimator

    // Bottom is me; play goes to my right, so the next seat in turn order is on the right.
    const Places = ['bottom', 'right', 'top', 'left'] as const
    // The side places lean in; the trick animator turns a card into its lean as it lands.
    const Tilt = { bottom: 0, right: 8, top: 0, left: -8 } as const

    function placed(plays: TrickPlay[]) {
        return plays.map((play, order) => {
            const place = Places[Math.max(gameSession.seatsFromMe.indexOf(play.playerId), 0)]
            return { ...play, order, place, tilt: Tilt[place] }
        })
    }

    const plays = $derived(placed(gameSession.shownTrick.plays))
    const winnerId = $derived(gameSession.shownTrick.winnerId)
</script>

<div class="trick">
    {#each plays as play (play.cardId)}
        {@const winning = play.playerId === winnerId}
        <div class="place {play.place}" style:z-index={play.order}>
            <div class="fly" data-tilt={play.tilt} {@attach animator.trickCard(play.cardId)}>
                <div class="tilt" style:rotate="{play.tilt}deg">
                    <Card cardId={play.cardId} style={gameSession.cardStyle} />
                    {#if winning}
                        <div class="ring" {@attach animator.winnerMark('ring')}></div>
                    {/if}
                </div>
            </div>
        </div>
    {/each}
    {#if winnerId}
        <div class="caption" {@attach animator.winnerMark('caption')}>
            {gameSession.getPlayerName(winnerId)} won the trick
        </div>
    {/if}
</div>

<style>
    .trick {
        --card-w: 104px;
        position: relative;
        width: 320px;
        height: 300px;
    }

    /* Placement only; the fly wrapper inside belongs to the trick animator. */
    .place {
        position: absolute;
        left: 50%;
        top: 50%;
    }

    .tilt {
        position: relative;
    }

    .bottom {
        transform: translate(-50%, -22%);
    }

    .top {
        transform: translate(-50%, -78%);
    }

    .left {
        transform: translate(-112%, -50%);
    }

    .right {
        transform: translate(12%, -50%);
    }

    /* A thin blue edge around the winning card. */
    .ring {
        position: absolute;
        inset: -1px;
        border: 2px solid #4a9eff;
        border-radius: calc(var(--card-w) * 0.07 + 1px);
        outline: 2px solid rgb(74 158 255 / 0.35);
        pointer-events: none;
    }

    .caption {
        position: absolute;
        left: 50%;
        bottom: -14px;
        transform: translateX(-50%);
        z-index: 20;
        white-space: nowrap;
        font-size: 0.85rem;
        color: #f1e7cf;
        text-shadow: 0 1px 0 rgb(0 0 0 / 0.7);
    }
</style>
