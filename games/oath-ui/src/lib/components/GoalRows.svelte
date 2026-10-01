<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { goalSymbolImage } from '$lib/images/goalImages.js'
    import { cardName, oathName } from '$lib/model/names.js'
    import { nextWinPhrase } from '$lib/model/nextWin.js'
    import {
        standingWords,
        type GoalBoard,
        type GoalKind,
        type Standing
    } from '$lib/model/goalBoard.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-3 — every live win condition: the next win, then a box for the Oath, each Vision and each Successor.
    let {
        board,
        scale,
        across = false
    }: { board: GoalBoard; scale: number; across?: boolean } = $props()

    let gameSession = getGameSession()
    let viewerId = $derived(gameSession.myPlayer?.id)

    function discStyle(playerId: string): string {
        const colors = gameSession.colors
        return `background:${colors.getPlayerBgColorValue(playerId)};color:${colors.getPlayerTextColorValue(playerId)}`
    }
</script>

{#snippet symbol(kind: GoalKind)}
    {@const src = goalSymbolImage(kind)}
    <span
        class="symbol"
        role="img"
        aria-label={standingWords(kind)}
        style:mask-image={`url("${src}")`}
        style:-webkit-mask-image={`url("${src}")`}
    ></span>
{/snippet}

{#snippet standing(kind: GoalKind, value: Standing)}
    <div class="discs">
        {#if value.shape === 'count'}
            {#each value.counts as { playerId, count } (playerId)}
                {@const words = `${gameSession.getPlayerName(playerId)}: ${standingWords(kind, count)}`}
                <span
                    class="disc"
                    class:disc--ring={playerId === value.ringedId}
                    style={discStyle(playerId)}
                    title={words}
                    aria-label={words}>{count}</span
                >
            {/each}
        {:else if value.holderId}
            {@const words = `${gameSession.getPlayerName(value.holderId)} holds ${standingWords(kind)}`}
            <span
                class="disc disc--ring"
                style={discStyle(value.holderId)}
                title={words}
                aria-label={words}
            ></span>
        {:else}
            <span class="disc disc--empty" title="{standingWords(kind)}: unclaimed"></span>
            <span class="unclaimed">unclaimed</span>
        {/if}
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

    <div class="boxes">
        <section class="box" style="--goal:var(--oath-goal-oath)">
            <h4>The Oath of {oathName(board.oath.oathType)}</h4>
            <div class="goal">
                {@render symbol(board.oath.kind)}
                <div class="facts">
                    {#if board.oath.holderId}
                        <p class="who">
                            <PlayerName playerId={board.oath.holderId} />
                            {board.oath.holderId === viewerId ? 'are' : 'is'} the {board.oath
                                .usurper
                                ? 'Usurper'
                                : 'Oathkeeper'}
                        </p>
                    {:else}
                        <p class="who who--none">No one is the Oathkeeper</p>
                    {/if}
                    {@render standing(board.oath.kind, board.oath.standing)}
                </div>
            </div>
        </section>

        {#each board.visions as vision (vision.playerId + vision.visionId)}
            <section class="box" style="--goal:var(--oath-goal-vision)">
                <h4>Vision {@render chip(vision.met)}</h4>
                <div class="goal">
                    {@render symbol(vision.kind)}
                    <div class="facts">
                        <p class="who">
                            <PlayerName playerId={vision.ownerId ?? vision.playerId} possessive />
                            {cardName(vision.visionId)}
                            {#if vision.shared}
                                <span class="shared"
                                    >shared with <PlayerName playerId={vision.playerId} /></span
                                >
                            {/if}
                        </p>
                        {@render standing(vision.kind, vision.standing)}
                    </div>
                </div>
            </section>
        {/each}

        {#each board.successors as successor (successor.citizenId)}
            <section class="box" style="--goal:var(--oath-goal-successor)">
                <h4>Successor {@render chip(successor.met)}</h4>
                <div class="goal">
                    {@render symbol(successor.kind)}
                    <div class="facts">
                        <p class="who">
                            <PlayerName playerId={successor.citizenId} />
                            {successor.citizenId === viewerId ? 'are' : 'is'} a Citizen
                        </p>
                        {@render standing(successor.kind, successor.standing)}
                    </div>
                </div>
            </section>
        {/each}
    </div>
</div>

<style>
    .goals {
        display: flex;
        flex-direction: column;
        gap: calc(var(--s) * 12px);
        color: var(--oath-text);
    }
    .next {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: calc(var(--s) * 10px);
        margin: 0;
        font-size: calc(var(--s) * 22px);
        font-weight: 600;
    }
    .next__label {
        font-size: calc(var(--s) * 16px);
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--oath-heading);
    }
    .boxes {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: calc(var(--s) * 18px);
    }
    .goals--across .boxes {
        flex-direction: row;
        gap: calc(var(--s) * 28px);
    }
    .box {
        display: flex;
        flex-direction: column;
        gap: calc(var(--s) * 8px);
        padding: calc(var(--s) * 12px) calc(var(--s) * 20px) calc(var(--s) * 14px);
        border-radius: calc(var(--s) * 10px);
        background: rgba(0, 0, 0, 0.3);
    }
    h4 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: calc(var(--s) * 12px);
        margin: 0;
        font-size: calc(var(--s) * 22px);
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--oath-heading);
    }
    .goal {
        display: flex;
        align-items: center;
        gap: calc(var(--s) * 20px);
    }
    .symbol {
        flex: none;
        width: calc(var(--s) * 96px);
        height: calc(var(--s) * 100px);
        background: var(--goal);
        mask-position: center;
        mask-size: contain;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        -webkit-mask-size: contain;
        -webkit-mask-repeat: no-repeat;
    }
    .facts {
        display: flex;
        flex-direction: column;
        gap: calc(var(--s) * 12px);
    }
    .who {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: calc(var(--s) * 8px);
        margin: 0;
        font-size: calc(var(--s) * 21px);
        font-weight: 600;
    }
    .who--none,
    .shared {
        color: var(--oath-text-muted);
    }
    .shared {
        font-size: calc(var(--s) * 15px);
        font-weight: 400;
    }
    .discs {
        display: flex;
        align-items: center;
        gap: calc(var(--s) * 10px);
    }
    .disc {
        flex: none;
        width: calc(var(--s) * 36px);
        height: calc(var(--s) * 36px);
        border-radius: 999px;
        font-size: calc(var(--s) * 20px);
        font-weight: 800;
        line-height: calc(var(--s) * 36px);
        text-align: center;
    }
    .disc--ring {
        box-shadow:
            0 0 0 calc(var(--s) * 3px) var(--oath-surface-raised),
            0 0 0 calc(var(--s) * 6px) var(--oath-accent);
    }
    .disc--empty {
        border: calc(var(--s) * 2px) dashed var(--oath-text-muted);
    }
    .unclaimed {
        font-size: calc(var(--s) * 17px);
        font-style: italic;
        color: var(--oath-text-muted);
    }
    .chip {
        padding: calc(var(--s) * 1px) calc(var(--s) * 9px);
        border-radius: 999px;
        background: var(--oath-control);
        color: var(--oath-text-muted);
        font-size: calc(var(--s) * 14px);
        font-weight: 800;
        letter-spacing: 0.1em;
    }
    .chip--met {
        background: var(--oath-accent);
        color: var(--oath-surface-raised);
    }
</style>
