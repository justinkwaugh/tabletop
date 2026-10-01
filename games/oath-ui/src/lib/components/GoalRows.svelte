<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import CardImage from '$lib/components/CardImage.svelte'
    import { goalCardImage } from '$lib/images/tileImages.js'
    import { avatarImage } from '$lib/images/boardImages.js'
    import { cardName } from '$lib/model/names.js'
    import { nextWinPhrase } from '$lib/model/nextWin.js'
    import { tallyLabel, type GoalBoard, type GoalTally } from '$lib/model/goalBoard.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-3 — every live win condition: the next win, the Oath, each Vision and the Successor goal.
    let {
        board,
        scale,
        across = false
    }: { board: GoalBoard; scale: number; across?: boolean } = $props()

    let gameSession = getGameSession()
    let viewerId = $derived(gameSession.myPlayer?.id)
    let cardWidth = $derived(Math.round(110 * scale))
</script>

{#snippet counts(tally: GoalTally)}
    <div class="counts">
        {#each tally.counts as { playerId, count } (playerId)}
            <span class="count">
                <span
                    class="swatch"
                    style="background:{gameSession.colors.getPlayerUiColor(playerId)}"
                ></span>
                <PlayerName {playerId} />
                {tallyLabel(tally.unit, count)}
            </span>
        {/each}
    </div>
{/snippet}

{#snippet chip(met: boolean)}
    <span class="chip" class:chip--met={met}>{met ? 'met' : 'not met'}</span>
{/snippet}

<div class="goals" class:goals--across={across} style="--s:{scale}">
    {#if board.next}
        {@const next = board.next}
        <p class="next">
            <span class="next__label">Next to win</span>
            <PlayerName playerId={next.playerId} />
            {nextWinPhrase(next, next.playerId === viewerId)}
        </p>
    {/if}

    <section class="goal">
        <img class="half" src={goalCardImage(board.oath.oathType)} alt="" />
        <div class="facts">
            <h4>The Oath</h4>
            {#if board.oath.holderId}
                {@const holder = gameSession.gameState.getPlayerState(board.oath.holderId)}
                <p class="who">
                    <img
                        class="avatar"
                        src={avatarImage(
                            holder.status,
                            gameSession.colors.getPlayerColor(board.oath.holderId)
                        )}
                        alt=""
                    />
                    <PlayerName playerId={board.oath.holderId} />
                    {board.oath.holderId === viewerId ? 'are' : 'is'} the {board.oath.usurper
                        ? 'Usurper'
                        : 'Oathkeeper'}
                </p>
            {/if}
            {#if board.oath.tally}{@render counts(board.oath.tally)}{/if}
        </div>
    </section>

    {#each board.visions as vision (vision.playerId + vision.visionId)}
        <section class="goal">
            <CardImage
                cardId={vision.visionId}
                width={cardWidth}
                label={cardName(vision.visionId)}
            />
            <div class="facts">
                <h4>Vision{vision.shared ? ', shared' : ''}</h4>
                <p class="who">
                    <PlayerName playerId={vision.playerId} possessive />
                    {cardName(vision.visionId)}
                    {@render chip(vision.met)}
                </p>
            </div>
        </section>
    {/each}

    {#if board.successor}
        {@const successor = board.successor}
        <section class="goal">
            <img class="half half--successor" src={goalCardImage(board.oath.oathType)} alt="" />
            <div class="facts">
                <h4>Successor</h4>
                {#each successor.citizens as citizen (citizen.playerId)}
                    <p class="who">
                        <PlayerName playerId={citizen.playerId} />
                        {@render chip(citizen.met)}
                    </p>
                {/each}
                {#if successor.tally}{@render counts(successor.tally)}{/if}
            </div>
        </section>
    {/if}
</div>

<style>
    .goals {
        display: flex;
        flex-direction: column;
        gap: calc(var(--s) * 10px);
        color: #e7e5e4;
        font-size: calc(var(--s) * 15px);
    }
    .goals--across {
        flex-flow: row wrap;
        column-gap: calc(var(--s) * 28px);
        row-gap: calc(var(--s) * 6px);
    }
    .goals--across .goal {
        max-width: calc(var(--s) * 430px);
    }
    .next {
        flex-basis: 100%;
        margin: 0;
        font-weight: 600;
        color: #fef3c7;
    }
    .next__label {
        margin-right: calc(var(--s) * 6px);
        font-size: calc(var(--s) * 11px);
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #fbbf24;
    }
    .goal {
        display: flex;
        align-items: flex-start;
        gap: calc(var(--s) * 12px);
    }
    .half {
        flex: none;
        width: calc(var(--s) * 110px);
        height: calc(var(--s) * 80px);
        object-fit: cover;
        object-position: top;
        border-radius: calc(var(--s) * 4px);
    }
    .half--successor {
        height: calc(var(--s) * 64px);
        object-position: bottom;
    }
    .facts {
        display: flex;
        flex-direction: column;
        gap: calc(var(--s) * 4px);
    }
    h4 {
        margin: 0;
        font-size: calc(var(--s) * 11px);
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(253, 230, 138, 0.75);
    }
    .who {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: calc(var(--s) * 6px);
        margin: 0;
        font-weight: 600;
        color: #fde68a;
    }
    .avatar {
        width: calc(var(--s) * 30px);
        height: calc(var(--s) * 30px);
        border-radius: 999px;
        border: calc(var(--s) * 2px) solid #fbbf24;
    }
    .counts {
        display: flex;
        flex-wrap: wrap;
        gap: calc(var(--s) * 12px);
    }
    .count {
        display: flex;
        align-items: center;
        gap: calc(var(--s) * 4px);
        white-space: nowrap;
    }
    .swatch {
        flex: none;
        width: calc(var(--s) * 10px);
        height: calc(var(--s) * 10px);
        border-radius: 999px;
    }
    .chip {
        padding: calc(var(--s) * 1px) calc(var(--s) * 7px);
        border-radius: 999px;
        background: #d6d3d1;
        color: #292524;
        font-size: calc(var(--s) * 11px);
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }
    .chip--met {
        background: #fbbf24;
        color: #1c1917;
    }
</style>
