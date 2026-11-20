<script lang="ts">
    import type { GameAction } from '@tabletop/common'
    import { cubicOut } from 'svelte/easing'
    import { prefersReducedMotion } from 'svelte/motion'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { companyLabels, type TitleActionDescription } from './historyDescription.js'
    import { creditedSentence, lastActionPrice, turnRecap } from './lastAction.js'
    import { describeLastAction } from './lastActionDescription.js'
    import PlaceText from '../places/PlaceText.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'

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
        return describeLastAction(session, action, describeAction, (id) =>
            session.historyCompanyName(id)
        )
    }
    const lines = $derived(
        session.gameState.machineState === 'StockRound'
            ? turnRecap(session.actions, playerId, (action) => !!describe(action).routine)
            : []
    )
    const lineKey = (line: (typeof lines)[number]) =>
        line.kind === 'passes' ? line.id : line.action.id
    const latestLine = $derived(lines.length ? lineKey(lines[lines.length - 1]) : undefined)
    const chosenAction = $derived(session.chosenStockAction ?? '')
    let pressed = $state<{ line?: string; folded: Record<string, boolean> }>({ folded: {} })
    const pressedHere = $derived(pressed.line === latestLine ? pressed.folded : {})
    const folded = $derived(pressedHere[chosenAction] ?? !!chosenAction)
    function toggle() {
        pressed = { line: latestLine, folded: { ...pressedHere, [chosenAction]: !folded } }
    }
    const listId = $props.id()
    function growFromTopRight(_node: HTMLElement) {
        return {
            duration: prefersReducedMotion.current ? 0 : 200,
            easing: cubicOut,
            css: (t: number) =>
                `opacity: ${t}; transform-origin: top right; transform: scale(${0.3 + 0.7 * t});`
        }
    }
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
    <div class="recap-slot" class:folded>
        <button
            type="button"
            class="recap-toggle"
            aria-label={folded ? 'Show turn recap' : 'Hide turn recap'}
            aria-expanded={!folded}
            aria-controls={folded ? undefined : listId}
            onclick={toggle}
        >
            {folded ? 'Turn recap' : 'Hide'}
            <svg class:folded viewBox="0 0 10 10" aria-hidden="true">
                <path d="M2 6.5 5 3.5 8 6.5"></path>
            </svg>
        </button>
        {#if !folded}
            <section
                id={listId}
                class="recap"
                aria-label="Since your last turn"
                in:growFromTopRight
                out:growFromTopRight
            >
                <header><strong>Since your last turn</strong></header>
                <ul>
                    {#each lines as line (lineKey(line))}
                        <li>
                            {#if line.kind === 'passes'}
                                <span class="dots"
                                    >{#each line.playerIds as id, index (index)}{@render dot(
                                            id
                                        )}{/each}</span
                                >
                                <p><strong>{names(line.playerIds)}</strong> passed</p>
                            {:else if line.kind === 'float'}
                                {@const { text, detail } = describe(line.action)}
                                <span class="dots"
                                    ><CompanyToken
                                        appearance={session.mapView.stations[line.action.companyId]}
                                        size={14}
                                    /></span
                                >
                                <p>
                                    <strong>{text}</strong>{#if detail}{' · '}{detail}{/if}
                                </p>
                            {:else}
                                {@const { sentence, price } = decision(line.action)}
                                <span class="dots">{@render dot(line.action.playerId)}</span>
                                <p>
                                    {#if sentence.actor}<strong>{sentence.actor}</strong
                                        >{' '}{/if}<PlaceText
                                        text={sentence.text}
                                    />{#if price}{price.connective === '·' ? ' · ' : ' '}<span
                                            class="price"
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
    </div>
{/if}

<style>
    .recap-slot {
        position: relative;
    }
    .recap-slot.folded {
        min-height: 30px;
    }
    .recap {
        display: flow-root;
        color: var(--rail-text, #514536);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
    }
    .recap-slot.folded .recap {
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        pointer-events: none;
    }
    header {
        display: flex;
        justify-content: center;
        margin: 6px 0 4px;
    }
    .recap-toggle {
        position: absolute;
        z-index: 1;
        top: 4px;
        right: 8px;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 7px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface, #fbf7f0);
        color: var(--rail-text, #514536);
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
    }
    /* The action panel's padding is 10px by 16px at this width: stand in its corner. */
    @media (width < 40rem) {
        .recap-slot.folded {
            min-height: 20px;
        }
        .recap-toggle {
            top: -6px;
            right: -12px;
        }
    }
    .recap-toggle:hover {
        background: var(--rail-hover, #efe7db);
    }
    .recap-toggle:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: 1px;
    }
    svg {
        width: 10px;
        height: 10px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    svg.folded {
        transform: rotate(180deg);
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
