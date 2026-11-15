<script lang="ts">
    import { isCallGameAction } from '@tabletop/common'
    import { CalledGameDescription, createTimeAgo } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { historyEntries } from '$lib/utils/historyEntries.js'
    import ActionLineView from './ActionLine.svelte'
    import RoofedName from './RoofedName.svelte'

    const session = getGameSession()
    const timeAgo = createTimeAgo()

    const actions = $derived(session.actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0)))
    const callAction = $derived(actions.find(isCallGameAction))
    const entries = $derived(
        historyEntries(actions, (playerId) => session.getPlayerName(playerId)).toReversed()
    )
    const finishedAt = $derived(session.isViewingHistory ? undefined : session.game.finishedAt)
</script>

<div class="history">
    {#if finishedAt}
        <div class="milestone">
            <span>Game over</span>
            {#if !callAction}
                <span class="winners">
                    {#each session.gameState.winningPlayerIds as playerId (playerId)}
                        <RoofedName {playerId} onDark={true} />
                    {/each}
                </span>
            {/if}
            <span class="when">{timeAgo.format(finishedAt)}</span>
        </div>
    {/if}
    {#if callAction}
        <div class="milestone"><CalledGameDescription action={callAction} /></div>
    {/if}
    {#each entries as entry (entry.key)}
        <article class="turn">
            <div class="head">
                <RoofedName playerId={entry.playerId} onDark={true} />
                {#if entry.lastAt}
                    <span class="when">{timeAgo.format(entry.lastAt)}</span>
                {/if}
            </div>
            <div class="lines">
                {#each entry.lines as line (line.key)}
                    <ActionLineView {line} />
                {/each}
            </div>
        </article>
    {/each}
    <div class="milestone start">
        <span>Game started</span>
        <span class="when">{timeAgo.format(session.game.createdAt)}</span>
    </div>
</div>

<style>
    .history {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        overflow: auto;
        padding: 8px;
        background: #231610;
        color: #e6c595;
        text-align: left;
    }

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3px 8px 3px 4px;
        border-radius: 4px;
        background: #3a291f;
        font:
            700 18px/1.25 'Medina Display',
            Georgia,
            serif;
    }

    .lines {
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin-top: 5px;
        padding: 0 4px;
    }

    .when {
        color: #b39a76;
        font:
            400 13px/1 'Medina Body',
            system-ui,
            sans-serif;
    }

    .milestone {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 6px 8px;
        border-radius: 5px;
        background: #47332a;
        font:
            700 16px/1.2 'Medina Display',
            Georgia,
            serif;
    }

    .winners {
        display: inline-flex;
        gap: 6px;
    }
</style>
