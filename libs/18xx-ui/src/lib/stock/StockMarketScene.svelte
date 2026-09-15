<script lang="ts">
    import { marketColors } from './marketColors.js'
    import { onMount, tick, untrack } from 'svelte'
    import { prefersReducedMotion } from 'svelte/motion'
    import {
        requireFinanceExampleState,
        type StockMarket as StockMarketModel,
        type Company
    } from '@tabletop/18xx'
    import type { AnimationContext } from '@tabletop/frontend-components'
    import type { FinanceExampleSession } from '../examples/financeExampleSession.svelte.js'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import {
        marketTokenLayout,
        expandedMarketStack,
        MarketCellWidth,
        MarketCellHeight,
        MarketTokenSize
    } from './marketTokenLayout.js'

    let {
        market,
        companies,
        appearances,
        session,
        renderScale = 1
    }: {
        market: StockMarketModel
        companies: readonly Company[]
        appearances: Readonly<Record<string, StationAppearance>>
        session?: FinanceExampleSession
        renderScale?: number
    } = $props()
    const columns = $derived(Math.max(...market.spaces.map((space) => space.column)) + 1)
    const rows = $derived(Math.max(...market.spaces.map((space) => space.row)) + 1)
    let tokens = $derived(marketTokenLayout(market))
    let hoveredSpace: string | undefined = $derived.by(() => {
        market
        session?.updatingVisibleState
        return undefined
    })
    const expanded = $derived(hoveredSpace ? expandedMarketStack(market, hoveredSpace) : [])
    const expandedIds = $derived(
        market.stacks.find((stack) => stack.spaceId === hoveredSpace)?.companyIds ?? []
    )
    const hitbox = $derived(
        expanded.length
            ? {
                  x: Math.min(...expanded.map((point) => point.x)) - MarketTokenSize / 2 - 3,
                  y: Math.min(...expanded.map((point) => point.y)) - MarketTokenSize / 2 - 3,
                  width:
                      Math.max(...expanded.map((point) => point.x)) -
                      Math.min(...expanded.map((point) => point.x)) +
                      MarketTokenSize +
                      6,
                  height:
                      Math.max(...expanded.map((point) => point.y)) -
                      Math.min(...expanded.map((point) => point.y)) +
                      MarketTokenSize +
                      6
              }
            : undefined
    )
    let board: HTMLDivElement | undefined = $state()
    const elements = new Map<string, HTMLElement>()
    const timelines = new Set<AnimationContext['actionTimeline']>()
    function register(node: HTMLElement, key: string) {
        elements.set(key, node)
        return {
            destroy() {
                for (const timeline of timelines) timeline.killTweensOf(node)
                elements.delete(key)
            }
        }
    }
    onMount(() => {
        const activeSession = untrack(() => session)
        if (!activeSession) return
        const listener = async ({
            to,
            from,
            action,
            animationContext
        }: Parameters<FinanceExampleSession['onGameStateChange']>[0]) => {
            if (!from || !board || getComputedStyle(board).visibility !== 'visible') return
            const before = marketTokenLayout(requireFinanceExampleState(from).stockMarket)
            const after = marketTokenLayout(requireFinanceExampleState(to).stockMarket)
            if (JSON.stringify(before) === JSON.stringify(after)) return
            hoveredSpace = undefined
            const beforeById = new Map(before.map((item) => [item.companyId, item]))
            const afterById = new Map(after.map((item) => [item.companyId, item]))
            tokens = [
                ...after.map((item) => ({
                    ...item,
                    x: beforeById.get(item.companyId)?.x ?? item.x,
                    y: beforeById.get(item.companyId)?.y ?? item.y
                })),
                ...before.filter((item) => !afterById.has(item.companyId))
            ]
            await tick()
            if (!board) return
            const timeline = animationContext.actionTimeline
            timelines.add(timeline)
            const duration = prefersReducedMotion.current ? 0 : action ? 0.3 : 0.18
            for (const item of tokens) {
                const start = beforeById.get(item.companyId)
                const end = afterById.get(item.companyId)
                const element = elements.get(item.companyId)
                if (!element) continue
                const origin = start ?? item
                const destination = end ?? item
                timeline.fromTo(
                    element,
                    {
                        x: origin.x * renderScale,
                        y: origin.y * renderScale,
                        opacity: start ? 1 : 0
                    },
                    {
                        x: destination.x * renderScale,
                        y: destination.y * renderScale,
                        opacity: end ? 1 : 0,
                        duration,
                        ease: 'power2.inOut'
                    },
                    0
                )
            }

            animationContext.afterAnimations(() => {
                timelines.delete(timeline)
                if (board) tokens = after
            })
        }
        activeSession.addGameStateChangeListener(listener)
        return () => {
            activeSession.removeGameStateChangeListener(listener)
            for (const timeline of timelines)
                for (const element of elements.values()) timeline.killTweensOf(element)
            timelines.clear()
            board = undefined
        }
    })
    function expandStack(spaceId: string) {
        if (session?.updatingVisibleState) return
        hoveredSpace = tokens.some((token) => token.spaceId === spaceId && token.overlapped)
            ? spaceId
            : undefined
    }

</script>

<div
    class="market"
    bind:this={board}
    role="region"
    aria-label="Stock market board"
    aria-busy={session?.updatingVisibleState ?? false}
    style:--render-scale={renderScale}
>
    <div
        class="grid"
        role="group"
        aria-label="Market spaces"
        onpointerleave={() => (hoveredSpace = undefined)}
        style:grid-template-columns={`repeat(${columns}, ${MarketCellWidth * renderScale}px)`}
        style:grid-template-rows={`repeat(${rows}, ${MarketCellHeight * renderScale}px)`}
    >
        {#each market.spaces as space (space.id)}
            {@const crowded = tokens.some(
                (token) => token.spaceId === space.id && token.overlapped
            )}
            <div
                class="space"
                role="button"
                tabindex={crowded ? 0 : -1}
                aria-label={`Market value ${space.price}${crowded ? ', expand company stack' : ''}`}
                data-market-space={space.id}
                style:grid-column={space.column + 1}
                style:grid-row={space.row + 1}
                style:background={marketColors[space.color] ?? space.color}
                onpointerenter={() => expandStack(space.id)}
                onfocus={() => expandStack(space.id)}
                onblur={() => (hoveredSpace = undefined)}
                onclick={() => expandStack(space.id)}
                onkeydown={(event) => {
                    if (event.key === 'Escape') hoveredSpace = undefined
                    else if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        expandStack(space.id)
                    }
                }}
            >
                <strong>{space.price}</strong>
                {#if !space.moves.right && space.moves.up}<svg
                        class="edge-arrow right"
                        viewBox="0 0 10 32"
                        role="img"
                        aria-label="Right moves up"><path d="M7 28V4L3 10" /></svg
                    >{/if}
                {#if !space.moves.left && space.moves.down}<svg
                        class="edge-arrow left"
                        viewBox="0 0 10 32"
                        role="img"
                        aria-label="Left moves down"><path d="M7 28V4L3 10" /></svg
                    >{/if}
            </div>
        {/each}
        {#if hitbox}<div
                class="stack-hitbox"
                aria-hidden="true"
                style:left={`${hitbox.x * renderScale}px`}
                style:top={`${hitbox.y * renderScale}px`}
                style:width={`${hitbox.width * renderScale}px`}
                style:height={`${hitbox.height * renderScale}px`}
            ></div>{/if}
        {#each tokens as token (token.companyId)}
            {@const target =
                hoveredSpace === token.spaceId
                    ? expanded[expandedIds.indexOf(token.companyId)]
                    : undefined}
            <div
                class="positioned market-token"
                use:register={token.companyId}
                data-market-company={token.companyId}
                data-market-token-space={token.spaceId}
                style:transform={`translate(${token.x * renderScale}px, ${token.y * renderScale}px)`}
                style:z-index={(target ? 101 : 1) + token.z}
            >
                <div
                    class="hover-offset"
                    class:moving={session?.updatingVisibleState}
                    style:transform={`translate(${((target?.x ?? token.x) - token.x) * renderScale}px, ${((target?.y ?? token.y) - token.y) * renderScale}px)`}
                >
                    <div
                        class="token-payload"
                        role="img"
                        aria-label={companies.find((company) => company.id === token.companyId)
                            ?.name}
                        onpointerenter={() => expandStack(token.spaceId)}
                    >
                        <CompanyToken
                            appearance={appearances[token.companyId]}
                            size={MarketTokenSize * renderScale}
                        />
                    </div>
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .market {
        width: max-content;
        padding: calc(6px * var(--render-scale));
        color: #253b35;
        font:
            14px/1.4 ui-sans-serif,
            system-ui,
            sans-serif;
    }
    .positioned {
        position: absolute;
        left: 0;
        top: 0;
    }
    .grid {
        position: relative;
        display: grid;
        width: max-content;
    }
    .space {
        position: relative;
        border: calc(1px * var(--render-scale)) solid #a4b3a7;
        margin-right: calc(-1px * var(--render-scale));
        margin-bottom: calc(-1px * var(--render-scale));
        font-size: calc(12px * var(--render-scale));
    }
    .space:focus-visible {
        outline: calc(2px * var(--render-scale)) solid #796047;
        outline-offset: calc(-2px * var(--render-scale));
    }
    strong {
        position: absolute;
        top: calc(2px * var(--render-scale));
        left: calc(4px * var(--render-scale));
        font-size: calc(13px * var(--render-scale));
    }
    .market-token {
        pointer-events: none;
    }
    .token-payload {
        transform: translate(-50%, -50%);
        width: max-content;
        height: calc(26px * var(--render-scale));
        pointer-events: auto;
    }
    .hover-offset {
        transition: transform 140ms ease-out;
    }
    .hover-offset.moving {
        transition: none;
    }
    .stack-hitbox {
        position: absolute;
        z-index: 100;
        border-radius: calc(8px * var(--render-scale));
        background: #faf7f1e8;
        box-shadow: 0 2px 8px #0003;
    }
    .edge-arrow {
        opacity: 0.4;
        position: absolute;
        bottom: calc(3px * var(--render-scale));
        width: calc(10px * var(--render-scale));
        height: calc(32px * var(--render-scale));
        fill: none;
        stroke: currentColor;
        stroke-width: 1.25;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .edge-arrow.right {
        right: calc(4px * var(--render-scale));
    }
    .edge-arrow.left {
        left: calc(4px * var(--render-scale));
        transform: rotate(180deg);
    }
    @media (prefers-reduced-motion: reduce) {
        .hover-offset {
            transition: none;
        }
    }
</style>
