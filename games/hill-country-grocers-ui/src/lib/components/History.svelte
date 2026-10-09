<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        SPACE_NAMES,
        actionSale,
        describeAction,
        saleDescription,
        winVerb,
        withdrawnBidders
    } from '$lib/utils/describeAction.js'
    import { entryActions, historyEntries, type HistoryEntry } from '$lib/utils/history.js'
    import CompanyBadge from './CompanyBadge.svelte'
    import Description from './Description.svelte'

    const gameSession = getGameSession()

    const entries = $derived(
        historyEntries(
            gameSession.actions.toSorted((a, b) => (a.index ?? 0) - (b.index ?? 0))
        ).toReversed()
    )

    async function jumpTo(entry: HistoryEntry) {
        const index = entryActions(entry).at(-1)?.index
        if (index !== undefined) {
            await gameSession.history.goToActionIndex(index)
        }
    }

    function onKey(event: KeyboardEvent, entry: HistoryEntry) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void jumpTo(entry)
        }
    }

    // A turn only its own player acted in names that player once, in its heading.
    function soloPlayer(entry: HistoryEntry): string | undefined {
        if (entry.kind !== 'turn') {
            return undefined
        }
        const alone = detailActions(entry).every(
            (action) => !action.playerId || action.playerId === entry.playerId
        )
        return alone ? entry.playerId : undefined
    }

    function detailActions(entry: HistoryEntry): GameAction[] {
        return entry.kind === 'turn' ? entry.actions.slice(1) : entryActions(entry)
    }
</script>

<div class="roll">
    <div class="masthead">
        <div class="store">Hill Country Grocers</div>
        <div class="subtitle">Transaction log</div>
    </div>
    <div class="double-rule"></div>
    {#if gameSession.gameState.result && gameSession.gameState.winningPlayerIds.length > 0}
        <div class="final">
            <div class="stars">*** Final total ***</div>
            <div class="winners">
                {#each gameSession.gameState.winningPlayerIds as playerId, index (playerId)}
                    {#if index > 0}and{/if}
                    <PlayerName
                        {playerId}
                        capitalization={index > 0 && playerId === gameSession.myPlayerId
                            ? 'none'
                            : 'capitalize'}
                    />
                {/each}
                {winVerb(gameSession.gameState.winningPlayerIds, gameSession.myPlayerId)}
            </div>
        </div>
        <div class="double-rule"></div>
    {/if}
    {#each entries as entry, index (entry.key)}
        {@const number = entries.length - index}
        {#if entry.kind === 'dividend'}
            <div
                class="dividend jump"
                role="button"
                tabindex="0"
                onclick={() => jumpTo(entry)}
                onkeydown={(event) => onKey(event, entry)}
            >
                <div class="stars">*** Dividends paid ***</div>
                <Description description={describeAction(entry.action)} />
            </div>
        {:else}
            <section
                class="entry"
                style:--stripe={entry.kind === 'turn'
                    ? gameSession.colors.getPlayerUiColor(entry.playerId)
                    : '#b59a68'}
            >
                <div
                    class="head jump"
                    role="button"
                    tabindex="0"
                    title="Show the board after this"
                    onclick={() => jumpTo(entry)}
                    onkeydown={(event) => onKey(event, entry)}
                >
                    {#if entry.kind === 'turn'}
                        <PlayerName playerId={entry.playerId} />
                        <span class="space">{SPACE_NAMES[entry.space]}</span>
                    {:else}
                        <span class="space">Initial auction</span>
                        {#if entry.companyId}<CompanyBadge companyId={entry.companyId} />{/if}
                    {/if}
                    <span class="number">#{String(number).padStart(3, '0')}</span>
                </div>
                {#each detailActions(entry) as action (action.id)}
                    {@const sale = actionSale(action)}
                    <div class="line">
                        {#if action.playerId && action.playerId !== soloPlayer(entry)}<PlayerName
                                playerId={action.playerId}
                            />{/if}
                        <Description description={describeAction(action)} />
                    </div>
                    {#each withdrawnBidders(action) as playerId (playerId)}
                        <div class="line sub"><PlayerName {playerId} /> cannot afford to bid</div>
                    {/each}
                    {#if sale}
                        <div class="line result">
                            <Description description={saleDescription(sale)} />
                        </div>
                    {/if}
                {/each}
            </section>
        {/if}
    {/each}
    <div class="thanks">Thank you for shopping local</div>
</div>

<style>
    .roll {
        display: flex;
        flex-direction: column;
        padding: 10px 10px 12px;
        background: #fffdf6;
        color: #2b1a10;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 14px;
        filter: drop-shadow(0 1px 1.5px rgba(43, 26, 16, 0.25));
        mask:
            radial-gradient(circle 3.5px at 50% 100%, #000 95%, #0000) 50% 0 / 8px 3px repeat-x,
            linear-gradient(#000 0 0) center / 100% calc(100% - 6px) no-repeat,
            radial-gradient(circle 3.5px at 50% 0, #000 95%, #0000) 50% 100% / 8px 3px repeat-x;
    }

    .masthead {
        text-align: center;
    }

    .store {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #7a1d22;
    }

    .subtitle,
    .stars,
    .thanks {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        text-align: center;
    }

    .double-rule {
        margin: 5px 0;
        border-top: 3px double #2b1a10;
    }

    .final {
        padding: 2px 0;
        text-align: center;
        color: #7a1d22;
    }

    .winners {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-weight: 700;
    }

    .entry {
        position: relative;
        padding: 5px 0 6px 12px;
        border-bottom: 1.5px dashed #b59a68;
    }

    .entry::before {
        content: '';
        position: absolute;
        inset: 5px auto 6px 0;
        width: 5px;
        border-radius: 1px;
        background: var(--stripe);
    }

    .head {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
    }

    .space {
        font-size: 12.5px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .number {
        margin-left: auto;
        font-size: 11.5px;
        font-weight: 400;
        color: #9a6a45;
    }

    .jump {
        cursor: pointer;
        border-radius: 2px;
    }

    .jump:hover,
    .jump:focus-visible {
        outline: none;
        background: rgba(200, 150, 26, 0.14);
    }

    .line {
        padding-left: 10px;
        font-size: 13px;
        line-height: 1.55;
    }

    .line.sub {
        color: #9a6a45;
        font-style: italic;
    }

    .line.result {
        font-weight: 700;
    }

    .dividend {
        margin: 4px 0;
        padding: 4px 6px;
        border-top: 3px double #7a1d22;
        border-bottom: 3px double #7a1d22;
        color: #7a1d22;
        font-size: 13px;
        text-align: center;
    }

    .thanks {
        margin-top: 8px;
        font-weight: 400;
        color: #6b4a28;
    }
</style>
