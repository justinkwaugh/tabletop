<script lang="ts">
    import type { ComponentProps } from 'svelte'
    import { VARIETIES, chartYield, organicIfKeptClean } from '@tabletop/dicke-kartoffeln'
    import { Floater } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { marks } from '$lib/utils/format.js'
    import { compactTable } from '$lib/utils/tableLayout.svelte.js'
    import SeedBag from '../tokens/SeedBag.svelte'

    const gameSession = getGameSession()

    const fieldId = $derived(gameSession.seedPickerField)
    const field = $derived(
        gameSession.myPlayerState?.fields.find((candidate) => candidate.id === fieldId)
    )
    const bio = $derived(field !== undefined && organicIfKeptClean(field))
    const compact = $derived(compactTable.current)

    type Middleware = NonNullable<ComponentProps<typeof Floater>['middlewares']>[number]

    const GAP = 8
    const MARGIN = 4

    function clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(value, max))
    }

    // On a phone the picker opens below or above its field, whichever has more board, and stays
    // wholly on the board even if it then covers part of the field. It is mounted in the board's
    // toolbar, so the board shows from the toolbar's foot to the foot of the board's dialog.
    const onBoard: Middleware = {
        name: 'onBoard',
        fn({ x, y, rects, elements }) {
            const board = elements.floating.closest('dialog')?.getBoundingClientRect()
            const toolbar = elements.floating.parentElement?.getBoundingClientRect()
            if (!board || !toolbar) return { x, y }
            const field = elements.reference.getBoundingClientRect()
            const top = Math.max(toolbar.bottom, board.top, 0)
            const bottom = Math.min(board.bottom, window.innerHeight)
            const left = Math.max(board.left, 0)
            const right = Math.min(board.right, window.innerWidth)
            const { width, height } = rects.floating
            const below = bottom - field.bottom
            const above = field.top - top
            const clientY =
                below >= height + GAP || below >= above
                    ? field.bottom + GAP
                    : field.top - GAP - height
            const clientX = field.left + field.width / 2 - width / 2
            return {
                x: clamp(clientX, left + MARGIN, right - MARGIN - width) + rects.reference.x - field.x,
                y: clamp(clientY, top + MARGIN, bottom - MARGIN - height) + rects.reference.y - field.y
            }
        }
    }
</script>

{#if fieldId !== undefined && field}
    {#key fieldId}
        <Floater
            placement={compact ? 'bottom' : 'right'}
            offset={compact ? 0 : GAP}
            middlewares={compact ? [onBoard] : undefined}
            reference="#dk-field-{fieldId}-{gameSession.myPlayerId}"
            onClose={() => gameSession.closeSeedPicker()}
        >
            <div class="picker" class:compact>
                <div class="title">Sow field {fieldId}</div>
                <div class="bags">
                    {#each VARIETIES as variety (variety)}
                        {@const price = marks(gameSession.seedPrice(variety))}
                        {@const norm = chartYield(variety, true, field.worms)}
                        {@const organic = chartYield(variety, false, field.worms)}
                        <button
                            type="button"
                            class="bag"
                            aria-label="{variety}, {price}: {norm} sacks with fertilizer{bio
                                ? `, ${organic} Bio sacks without`
                                : ''}"
                            onclick={() => gameSession.chooseSeed(fieldId, variety)}
                        >
                            <span class="icon">
                                <SeedBag {variety} size={compact ? 60 : 54} />
                                <span class="bubble norm">{norm}</span>
                                {#if bio}
                                    <span class="bubble bio">{organic}</span>
                                {/if}
                            </span>
                            <span>{price}</span>
                        </button>
                    {/each}
                </div>
                <div class="legend">
                    <span><span class="key norm"></span>sacks fertilized</span>
                    {#if bio}
                        <span><span class="key bio"></span>Bio, unfertilized</span>
                    {/if}
                </div>
                {#if gameSession.sowing(fieldId)}
                    <button
                        type="button"
                        class="fallow"
                        onclick={() => gameSession.chooseSeed(fieldId, undefined)}
                        >Leave it unsown</button
                    >
                {/if}
            </div>
        </Floater>
    {/key}
{/if}

<style>
    .picker {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        border: 2px solid #6e3b1c;
        border-radius: 12px;
        background: #fdf8ea;
        padding: 8px 10px;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.3);
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        text-transform: uppercase;
        color: #4a2c16;
    }

    .title {
        font-size: 18px;
    }

    .bags {
        display: flex;
        gap: 8px;
    }

    .bag {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        border-radius: 8px;
        padding: 10px 8px 4px;
        font-size: 16px;
    }

    .bag:hover {
        background: rgba(110, 59, 28, 0.12);
    }

    .icon {
        position: relative;
    }

    /* Yield bubbles sit on the bag's top corners: Norm dark like the market's Norm markers. */
    .bubble {
        position: absolute;
        top: -9px;
        display: grid;
        place-items: center;
        min-width: 24px;
        height: 24px;
        border: 2px solid #fdf8ea;
        border-radius: 999px;
        padding: 0 4px;
        font-size: 16px;
        line-height: 1;
        color: #fff6dc;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    }

    .bubble.norm {
        right: -10px;
        background: #3b2a20;
    }

    .bubble.bio {
        left: -10px;
        background: #3f7d2c;
    }

    .legend {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 2px 12px;
        font-size: 12px;
    }

    .legend > span {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .key {
        width: 10px;
        height: 10px;
        border-radius: 999px;
    }

    .key.norm {
        background: #3b2a20;
    }

    .key.bio {
        background: #3f7d2c;
    }

    .fallow {
        font-size: 15px;
        text-decoration: underline;
    }

    .compact .title {
        font-size: 20px;
    }

    .compact .bags {
        gap: 10px;
    }

    .compact .bag {
        min-width: 76px;
        padding: 12px 6px 6px;
        font-size: 17px;
    }

    .compact .legend {
        font-size: 13px;
    }

    .compact .fallow {
        padding: 8px 12px;
        font-size: 17px;
    }
</style>
