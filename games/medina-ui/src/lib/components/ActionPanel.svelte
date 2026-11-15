<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import type { PieceBay } from '$lib/model/session.svelte'
    import { COLOR_NAMES, describeAction } from '$lib/utils/describeAction.js'
    import ActionLineView from './ActionLine.svelte'
    import Niche from './Niche.svelte'
    import RoofedName from './RoofedName.svelte'
    import PieceInNiche from './PieceInNiche.svelte'

    const session = getGameSession()

    const BAY_FIT: Record<PieceBay['tool']['kind'], { width: number; height: number }> = {
        building: { width: 36, height: 39 },
        rooftop: { width: 33, height: 30 },
        neutralRooftop: { width: 33, height: 30 },
        stable: { width: 31, height: 30 },
        merchant: { width: 25, height: 34 },
        wall: { width: 38, height: 30 }
    }

    const nameOf = (playerId: string) => session.getPlayerName(playerId)
    const state = $derived(session.gameState)
    const activePlayerId = $derived(state.activePlayerIds[0])
    const piecesLeft = $derived(
        activePlayerId && session.showsPieceCounts(activePlayerId)
            ? Math.min(
                  session.placementsLeft,
                  state.getPlayerState(activePlayerId).componentsLeft()
              )
            : session.placementsLeft
    )
    const placementsMade = $derived(state.turn?.placementsMade ?? 0)
    const heading = $derived(`Place ${piecesLeft} ${piecesLeft === 1 ? 'piece' : 'pieces'}`)

    const hint = $derived.by(() => {
        const tool = session.activeTool
        if (!tool) {
            return 'Choose a piece, then choose where it goes.'
        }
        switch (tool.kind) {
            case 'building':
                return state.unfinishedPalaces(tool.color).length > 0
                    ? `Add to the unfinished ${COLOR_NAMES[tool.color]} palace.`
                    : `Start a new ${COLOR_NAMES[tool.color]} palace.`
            case 'rooftop':
                return 'Claim an unfinished palace. One per colour.'
            case 'neutralRooftop':
                return 'Close a palace so nobody scores it.'
            case 'stable':
                return 'Beside any palace, touching no other.'
            case 'merchant':
                return 'Extend either end of the market street.'
            case 'wall':
                return 'Extend a wall from its tower, leaving a gate.'
        }
    })

    const lastLine = $derived.by(() => {
        for (const action of session.actions.toReversed()) {
            const line = describeAction(action, nameOf)
            if (line && action.playerId) {
                return { line, playerId: action.playerId }
            }
        }
        return undefined
    })
    const historyLine = $derived(
        session.currentAction ? describeAction(session.currentAction, nameOf) : undefined
    )
</script>

<div class="action">
    {#if session.isViewingHistory}
        <div class="prompt told">
            {#if session.currentAction?.playerId && historyLine}
                <h2><RoofedName playerId={session.currentAction.playerId} /></h2>
                <ActionLineView line={historyLine} />
            {:else}
                <h2>The city stands empty</h2>
            {/if}
        </div>
    {:else if session.canAct}
        <div class="prompt">
            <h2>
                {heading}
                <span class="tokens" aria-hidden="true">
                    {#each { length: placementsMade + piecesLeft } as _, index (index)}
                        <i class:spent={index < placementsMade}></i>
                    {/each}
                </span>
            </h2>
            <p class="hint">{hint}</p>
            {#if session.canTakeTeaBreak}
                <button
                    type="button"
                    class="tea"
                    title="Place one piece instead of two, and hand back a tea tile"
                    onclick={() => session.takeTeaBreak()}
                >
                    Tea break ({session.myTeaTiles})
                </button>
            {/if}
        </div>
        <div class="arcade">
            {#each session.bays as bay (bay.label)}
                {@const fit = BAY_FIT[bay.tool.kind]}
                <button
                    type="button"
                    class="bay"
                    class:on={bay.selected}
                    disabled={!bay.enabled}
                    aria-pressed={bay.selected}
                    aria-label="{bay.label}, {bay.count} left"
                    onclick={() => session.choose(bay.tool)}
                >
                    <Niche
                        height={58}
                        rim={bay.selected ? '#2a1609' : '#7f5228'}
                        fill={bay.selected ? '#2a7f8e' : '#231610'}
                    >
                        <g class="piece">
                            <PieceInNiche
                                name={bay.sprite}
                                fitWidth={fit.width}
                                fitHeight={fit.height}
                                floor={54}
                            />
                        </g>
                    </Niche>
                    <span class="count">{bay.count}</span>
                    <span class="label">{bay.label}</span>
                </button>
            {/each}
        </div>
    {:else if activePlayerId}
        <div class="prompt told">
            <h2>
                <RoofedName playerId={activePlayerId} />
                <span class="status"
                    >is placing {piecesLeft} {piecesLeft === 1 ? 'piece' : 'pieces'}</span
                >
            </h2>
            {#if lastLine}
                <div class="last">
                    <RoofedName playerId={lastLine.playerId} />
                    <ActionLineView line={lastLine.line} />
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .action {
        display: flex;
        gap: 16px;
        align-items: center;
        padding: 8px 14px 10px;
        min-height: 92px;
    }

    .prompt {
        flex: 1;
        min-width: 180px;
    }

    .prompt.told {
        display: flex;
        flex-direction: column;
        gap: 3px;
        align-items: center;
        padding: 0;
        text-align: center;
    }

    .prompt.told h2 {
        justify-content: center;
        column-gap: 7px;
    }

    .status {
        position: relative;
        top: 3px;
    }

    h2 {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 10px;
        margin: 0;
        font:
            700 25px/1.05 'Medina Display',
            Georgia,
            serif;
    }

    .status {
        font-weight: 500;
    }

    .hint {
        margin: 3px 0 0;
        color: #452a14;
        font:
            500 18px/1.2 'Medina Body',
            system-ui,
            sans-serif;
    }

    .last {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 2px 8px;
        margin-top: 3px;
        font:
            700 17px/1.25 'Medina Display',
            Georgia,
            serif;
    }

    .tokens {
        display: inline-flex;
        gap: 4px;
    }

    .tokens i {
        display: block;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #2a1609;
    }

    .tokens i.spent {
        border: 2px solid #7f5228;
        background: transparent;
    }

    .tea {
        margin-top: 7px;
        padding: 7px 14px 4px;
        border: 2px solid #2a1609;
        border-radius: 5px;
        background: transparent;
        color: #2a1609;
        font:
            700 16px/1 'Medina Display',
            Georgia,
            serif;
        cursor: pointer;
    }

    .tea:hover {
        background: #2a1609;
        color: #c8935a;
    }

    .arcade {
        display: flex;
        gap: 3px;
        align-items: flex-start;
    }

    .bay {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 72px;
        padding: 0;
        border: 0;
        background: none;
        color: #2a1609;
        cursor: pointer;
    }

    .bay[disabled] {
        cursor: default;
    }

    .bay[disabled] .piece {
        opacity: 0.34;
    }

    .bay[disabled] .count,
    .bay[disabled] .label {
        opacity: 0.45;
    }

    .bay:not([disabled]):not(.on):hover :global(.rim) {
        fill: #2a1609;
    }

    .bay:not([disabled]):not(.on):hover :global(.inner) {
        fill: #1d5661;
    }

    .count {
        margin-top: 5px;
        height: 22px;
        font:
            700 22px/1 'Medina Display',
            Georgia,
            serif;
    }

    .label {
        margin-top: 2px;
        height: 18px;
        color: #2a1609;
        white-space: nowrap;
        font:
            700 15.5px/1.1 'Medina Body',
            system-ui,
            sans-serif;
    }

    @media (max-width: 639px) {
        .action {
            display: block;
            min-height: 0;
            padding: 5px 6px;
        }

        .prompt {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            padding: 0 4px 3px;
        }

        h2 {
            flex-wrap: nowrap;
            font-size: 18px;
            white-space: nowrap;
        }

        .hint {
            margin: 0;
            overflow: hidden;
            font-size: 14px;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .tokens i {
            width: 12px;
            height: 12px;
        }

        .tea {
            flex: none;
            margin: 0;
            padding: 5px 8px 3px;
            font-size: 13px;
        }

        .arcade {
            display: grid;
            grid-auto-columns: 1fr;
            grid-auto-flow: column;
            gap: 0;
        }

        .bay {
            width: auto;
            min-width: 0;
        }

        .label {
            display: none;
        }

        .count {
            margin-top: 3px;
            height: 18px;
            font-size: 18px;
        }
    }
</style>
