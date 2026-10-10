<script lang="ts">
    import { ROUNDS, Side, isEndTurn, roundLabel } from '@tabletop/napoleons-triumph'
    import { ARMY_COLORS } from '$lib/definitions/palette.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { describeAction } from '$lib/utils/describeAction.js'

    const gameSession = getGameSession()
    const game = $derived(gameSession.gameState)

    const context = $derived({
        map: game.map,
        sideOf: (playerId: string | undefined) => game.findPlayerState(playerId ?? '')?.side
    })

    interface Entry {
        index: number
        side?: Side
        text: string
    }

    interface Chapter {
        title: string
        entries: Entry[]
    }

    /** Actions grouped under the round they were taken in; ending a turn tells nothing by itself. */
    const chapters = $derived.by(() => {
        const rounds = game.rounds.series
        const result: Chapter[] = []
        for (const action of gameSession.actions) {
            const index = action.index ?? 0
            const round = rounds.findLast((candidate) => candidate.start <= index)
            const definition = round ? ROUNDS[game.scenario][round.number - 1] : undefined
            const title = definition
                ? `${roundLabel(definition)}${definition.night ? '' : `, ${definition.day} December`}`
                : 'Before the battle'
            let chapter = result.at(-1)
            if (!chapter || chapter.title !== title) {
                chapter = { title, entries: [] }
                result.push(chapter)
            }
            const text = isEndTurn(action) ? '' : describeAction(action, context)
            if (text) {
                chapter.entries.push({ index, side: context.sideOf(action.playerId), text })
            }
        }
        return result.filter((chapter) => chapter.entries.length > 0).toReversed()
    })
</script>

<div class="nt-history">
    {#each chapters as chapter (chapter.title)}
        <h3>{chapter.title}</h3>
        {#each chapter.entries.toReversed() as entry (entry.index)}
            <button
                type="button"
                class="nt-history-entry"
                onclick={() => gameSession.history.goToActionIndex(entry.index)}
            >
                <span
                    class="nt-history-mark"
                    style="background: {entry.side ? ARMY_COLORS[entry.side].block : '#8a857a'};"
                ></span>
                <span>{entry.text}</span>
            </button>
        {/each}
    {:else}
        <p>Nothing has happened yet.</p>
    {/each}
</div>

<style>
    .nt-history {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 6px 4px;
        color: #2b2620;
        font-size: 13px;
        line-height: 1.3;
    }

    h3 {
        margin-top: 6px;
        font-size: 14px;
        font-style: italic;
        border-bottom: 1px solid rgba(43, 38, 32, 0.3);
    }

    .nt-history-entry {
        display: grid;
        grid-template-columns: 6px 1fr;
        gap: 6px;
        text-align: left;
        padding: 2px 0;
    }

    .nt-history-entry:hover {
        background: rgba(43, 38, 32, 0.07);
    }

    .nt-history-mark {
        border-radius: 1px;
    }
</style>
