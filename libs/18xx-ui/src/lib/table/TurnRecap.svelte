<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { companyLabels, type TitleActionDescription } from './historyDescription.js'
    import { creditedSentence, lastActionPrice, turnRecap } from './lastAction.js'
    import { describeLastAction } from './lastActionDescription.js'
    import PlaceText from '../places/PlaceText.svelte'

    let {
        session,
        playerId,
        describeAction
    }: {
        session: EighteenXXSessionView
        playerId: string
        describeAction?: TitleActionDescription
    } = $props()

    const labels = $derived(
        companyLabels(
            session.gameState.companies,
            (id) => session.companyInitials(id),
            (id) => session.companyName(id)
        )
    )
    function describe(action: GameAction) {
        return describeLastAction(session, action, describeAction)
    }
    const lines = $derived(
        session.gameState.machineState === 'StockRound'
            ? turnRecap(session.actions, playerId, (action) => !!describe(action).routine)
            : []
    )
    function decision(action: GameAction & { playerId: string }) {
        const description = describe(action)
        const actor = description.omitActor ? undefined : session.getPlayerName(action.playerId)
        return {
            sentence: creditedSentence(
                description.afterActorText ?? description.text,
                actor,
                labels
            ),
            price: lastActionPrice(action, description)
        }
    }
    function names(playerIds: readonly string[]) {
        const all = playerIds.map((id) => session.getPlayerName(id))
        return all.length < 2 ? all.join('') : `${all.slice(0, -1).join(', ')} and ${all.at(-1)}`
    }
</script>

{#snippet dot(playerId: string)}<span
        class="player-dot"
        style:background={session.colors.getPlayerBgColorValue(playerId)}
    ></span>{/snippet}

{#if lines.length}
    <section class="recap" aria-label="Since your last turn">
        <header><strong>Since your last turn</strong></header>
        <ul>
            {#each lines as line (line.kind === 'passes' ? line.id : line.action.id)}
                <li>
                    {#if line.kind === 'passes'}
                        <span class="dots"
                            >{#each line.playerIds as id, index (index)}{@render dot(
                                    id
                                )}{/each}</span
                        >
                        <p><strong>{names(line.playerIds)}</strong> passed</p>
                    {:else}
                        {@const { sentence, price } = decision(line.action)}
                        <span class="dots">{@render dot(line.action.playerId)}</span>
                        <p>
                            {#if sentence.actor}<strong>{sentence.actor}</strong
                                >{' '}{/if}<PlaceText
                                text={sentence.text}
                            />{#if price}{price.connective === '·' ? ' · ' : ' '}<span class="price"
                                    >{price.connective === 'for' ? 'for ' : ''}<strong
                                        >{price.amount}</strong
                                    ></span
                                >{/if}
                        </p>
                    {/if}
                </li>
            {/each}
        </ul>
    </section>
{/if}

<style>
    .recap {
        color: var(--rail-text, #514536);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }
    header {
        display: flex;
        justify-content: center;
        margin: 6px 0 4px;
    }
    header strong {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 500;
    }
    ul {
        display: grid;
        gap: 2px;
        width: fit-content;
        max-width: min(360px, 100%);
        margin: 0 auto 16px;
        padding: 0;
        list-style: none;
    }
    li {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: start;
        column-gap: 6px;
    }
    .dots {
        display: flex;
        gap: 2px;
        height: 18px;
        align-items: center;
    }
    .player-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }
    p {
        margin: 0;
        line-height: 18px;
    }
    strong {
        font-weight: 600;
    }
    .price {
        white-space: nowrap;
    }
</style>
