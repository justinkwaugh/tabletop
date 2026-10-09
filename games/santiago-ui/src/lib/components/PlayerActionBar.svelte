<script lang="ts">
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'
    import { attachAnimator } from '$lib/animators/stateAnimator.js'
    import MoneyBadge from './MoneyBadge.svelte'
    import PlayerNameChip from './PlayerNameChip.svelte'
    import OverseerPill from './OverseerPill.svelte'

    let { boardCenterX = null }: { boardCenterX?: number | null } = $props()

    const session = getGameSession()
    const animator = session.actionBar
    const attachAnimatorToBar = attachAnimator(animator)
    const view = $derived(session.actionBarView)

    function overseerTint(playerId: string, percent: number): string {
        return `color-mix(in srgb, ${session.colors.getPlayerBgColorValue(playerId)} ${percent}%, rgb(0 0 0 / 0.45))`
    }
    const me = $derived(session.mySantiagoPlayer)
</script>

<!-- Action area. The wrapper is always present so ActionBarAnimator can measure and tween its
     height; it is empty, and zero height, whenever there is nothing to show. A previewed bar is
     inert because its state has not been published yet. -->
<div
    class="shrink-0 flow-root"
    inert={animator.previewInert}
    {@attach (el) => {
        animator.setBar(el)
        const detach = attachAnimatorToBar(el)
        return () => {
            detach()
            animator.setBar(undefined)
        }
    }}
>
{#if view.kind !== 'none'}
    <div class="action-area shrink-0 mt-1 min-h-[56px]">
    <div class="centered-row h-full max-w-full px-3 py-2 flex flex-wrap items-center gap-3 text-white text-base"
         style="--board-center: {boardCenterX !== null ? `${boardCenterX}px` : '50%'}">

        <!-- SPRING PLACEMENT -->
        {#if view.kind === 'placeSpring'}
            <span class="shrink sm:shrink-0 sm:whitespace-nowrap text-amber-300 font-semibold">Place the spring</span>
            <span class="shrink-0 whitespace-nowrap text-sm text-amber-500">Click a highlighted intersection on the board</span>

        <!-- BIDDING -->
        {:else if view.kind === 'bidding'}
            <div class="decision-row flex items-center flex-wrap sm:flex-nowrap justify-center gap-x-8 gap-y-2">
                {#if view.canBid}
                    <div class="flex flex-col gap-1 shrink-0">
                        <div class="flex items-center gap-2">
                            <button class="step shrink-0 w-[40px] h-[40px] rounded-full bg-white/10 hover:bg-white/20 font-bold text-[20px] text-white disabled:opacity-30"
                                onclick={() => session.setBidValue(session.bidValue - 1)} disabled={session.bidValue <= 0}>−</button>
                            <span style="font-size: 1.287em" class="inline-flex items-center shrink-0">
                                <MoneyBadge amount={session.bidValue} />
                            </span>
                            <button class="step shrink-0 w-[40px] h-[40px] rounded-full bg-white/10 hover:bg-white/20 font-bold text-[20px] text-white disabled:opacity-30"
                                onclick={() => session.setBidValue(session.bidValue + 1)} disabled={session.bidValue >= session.maxBid}>+</button>
                            <button class="shrink-0 whitespace-nowrap px-[15px] py-[6px] rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                onclick={() => session.placeBid()} disabled={session.bidIsInvalid}>
                                Place Bid
                            </button>
                        </div>
                        <!-- Bracket under the whole control row above, marking what we're
                             bidding for — the two line segments are flex-1 so the caption
                             stays centered regardless of its own width, with a short
                             upturned tick at each outer end. This row is a plain flex-col
                             child (no items-center), so it stretches to the control row's
                             full width rather than just the caption's intrinsic width. -->
                        <div class="caption flex items-center gap-1 text-stone-400">
                            <div class="flex-1 relative">
                                <div class="absolute inset-x-0 top-0 border-t border-current"></div>
                                <div class="absolute left-0 -top-1.5 h-1.5 border-l border-current"></div>
                            </div>
                            <span class="font-ui text-[10px] uppercase tracking-wide whitespace-nowrap shrink-0">Bid for player order</span>
                            <div class="flex-1 relative">
                                <div class="absolute inset-x-0 top-0 border-t border-current"></div>
                                <div class="absolute right-0 -top-1.5 h-1.5 border-r border-current"></div>
                            </div>
                        </div>
                    </div>
                {/if}
                {#if view.rows.length > 0}
                    <div class="flex flex-col items-center gap-1">
                        <div class="paper-texture border border-stone-500/60 rounded-md px-2 py-1.5">
                            <div class="player-table grid items-center gap-x-1.5 gap-y-1 shrink-0"
                                 style="grid-template-columns: auto auto auto; justify-content: start">
                                {#each view.rows as p (p.playerId)}
                                    <div class="table-row" class:is-overseer={p.playerId === view.overseerId}>
                                    <div class="flex items-center justify-self-end whitespace-nowrap">
                                        <PlayerNameChip playerId={p.playerId} />
                                    </div>
                                    <div class="flex items-center whitespace-nowrap">
                                        {#if p.bid !== undefined}
                                            <MoneyBadge amount={p.bid} />
                                        {:else}
                                            <MoneyBadge blank />
                                        {/if}
                                    </div>
                                    <!-- Every row keeps an Overseer pill, styled like the player panels'
                                         and hidden unless that player is the overseer, so the column's
                                         width never changes and the pill can wipe in where it stands. -->
                                    <div class="overseer-slot flex items-center whitespace-nowrap">
                                        <OverseerPill
                                            style="background-color: {overseerTint(p.playerId, 30)}; box-shadow: inset 0 0 0 1px {overseerTint(p.playerId, 55)}; visibility: {p.playerId === view.overseerId ? 'visible' : 'hidden'}"
                                            {@attach animator.overseerTag(p.playerId)} />
                                    </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                        <span class="caption font-ui text-[10px] text-stone-400 uppercase tracking-wide whitespace-nowrap">Current bids</span>
                    </div>
                {/if}
            </div>

        <!-- TILE REVEAL: THE FIRST BIDDER OPENS THE ROUND -->
        {:else if view.kind === 'revealTiles'}
            <span class="shrink sm:shrink-0 sm:whitespace-nowrap text-amber-300">Click the draw pile beside the board to reveal this round's fields.</span>

        <!-- PLANTING: CHOOSE AND PLACE A FIELD -->
        {:else if view.kind === 'plant'}
            <span class="shrink sm:shrink-0 sm:whitespace-nowrap text-amber-300">Choose a field and plant it on the board</span>

        <!-- PLANTING: NEUTRAL TILE PLACEMENT (3-player highest bidder) -->
        {:else if view.kind === 'placeNeutral'}
            <span class="shrink sm:shrink-0 sm:whitespace-nowrap font-semibold text-amber-300 mt-2">Place the fourth field next to an existing field</span>

        <!-- CANAL BUILDING: PROPOSING/BRIBING -->
        {:else if view.kind === 'canalBuilding'}
            <div class="decision-row flex items-center flex-wrap sm:flex-nowrap justify-center gap-x-8 gap-y-2">
                {#if view.role === 'proposer'}
                    <div class="flex flex-col items-center gap-1 shrink-0">
                        {#if !view.bribeSpotChosen}
                            <div class="flex items-center gap-2">
                                <span class="shrink sm:shrink-0 sm:whitespace-nowrap text-amber-300">Click a canal location to place a bribe, or</span>
                                <button class="shrink-0 whitespace-nowrap px-[14px] py-[7px] rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[18px] transition-colors"
                                    onclick={() => session.passProposal()}>Pass</button>
                            </div>
                        {:else}
                            <div class="flex flex-col gap-1 mt-2">
                                <div class="flex items-center gap-2">
                                    <button class="step shrink-0 w-[40px] h-[40px] rounded-full bg-white/10 hover:bg-white/20 font-bold text-[20px] text-white disabled:opacity-30"
                                        onclick={() => session.setProposalAmount(session.proposalAmount - 1)} disabled={session.proposalAmount <= 1}>−</button>
                                    <span style="font-size: 1.287em" class="inline-flex items-center shrink-0">
                                        <MoneyBadge amount={session.proposalAmount} />
                                    </span>
                                    <button class="step shrink-0 w-[40px] h-[40px] rounded-full bg-white/10 hover:bg-white/20 font-bold text-[20px] text-white disabled:opacity-30"
                                        onclick={() => session.setProposalAmount(session.proposalAmount + 1)} disabled={session.proposalAmount >= (me?.money ?? 0)}>+</button>
                                    <button class="shrink-0 whitespace-nowrap px-[15px] py-[6px] rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-[15px] transition-colors"
                                        onclick={() => session.confirmProposal()}>Place Bribe</button>
                                </div>
                                <!-- Bracket spans exactly the − through Place Bribe group above. -->
                                <div class="caption flex items-center gap-1 text-stone-400">
                                    <div class="flex-1 relative">
                                        <div class="absolute inset-x-0 top-0 border-t border-current"></div>
                                        <div class="absolute left-0 -top-1.5 h-1.5 border-l border-current"></div>
                                    </div>
                                    <span class="font-ui text-[10px] uppercase tracking-wide whitespace-nowrap shrink-0">
                                        Bribe <span class="tracking-normal"><PlayerNameChip playerId={view.overseerId} /></span>
                                    </span>
                                    <div class="flex-1 relative">
                                        <div class="absolute inset-x-0 top-0 border-t border-current"></div>
                                        <div class="absolute right-0 -top-1.5 h-1.5 border-r border-current"></div>
                                    </div>
                                </div>
                                <!-- "or Pass" centered under the whole group above (stretched to
                                     its width by the flex-col, then centered within that). -->
                                <div class="flex items-center justify-center gap-2 mt-1">
                                    <span class="shrink sm:shrink-0 sm:whitespace-nowrap text-amber-300 font-semibold">or</span>
                                    <button class="shrink-0 whitespace-nowrap px-[15px] py-[6px] rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[15px] transition-colors"
                                        onclick={() => session.passProposal()}>Pass</button>
                                </div>
                            </div>
                        {/if}
                    </div>
                {:else if view.role === 'overseer'}
                    <span class="shrink sm:shrink-0 sm:whitespace-nowrap text-amber-300">
                        Click a bribe or canal on the board, or pay
                        <span class="mx-1 inline-flex items-center justify-center text-white font-bold"
                              style="background-color: rgba(102, 102, 102, 0.7); font-family: sans-serif; width: 40px; height: 28px; border-radius: 6px; font-size: 16px">
                            {view.rejectPenalty}
                        </span>
                        to the bank
                    </span>
                {/if}
                {#if view.rows.length > 0}
                    <div class="flex flex-col items-center gap-1">
                        <div class="paper-texture border border-stone-500/60 rounded-md px-2 py-1.5">
                            <div class="player-table grid items-center gap-x-1.5 gap-y-1 shrink-0"
                                 style="grid-template-columns: auto auto; justify-content: start">
                                {#each view.rows as p (p.playerId)}
                                    <div class="table-row">
                                    <div class="flex items-center justify-self-end whitespace-nowrap">
                                        <PlayerNameChip playerId={p.playerId} />
                                    </div>
                                    <div class="flex items-center whitespace-nowrap">
                                        {#if p.amount !== undefined}
                                            <MoneyBadge amount={p.amount} />
                                        {:else if p.hasActed}
                                            <span class="text-[0.85em] text-stone-400 uppercase tracking-wide">Pass</span>
                                        {:else}
                                            <MoneyBadge blank />
                                        {/if}
                                    </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                        <span class="caption font-ui text-[10px] text-stone-400 uppercase tracking-wide whitespace-nowrap">Current bribes</span>
                    </div>
                {/if}
            </div>

        <!-- EXTRA IRRIGATION: PERSONAL CANAL -->
        {:else if view.kind === 'extraIrrigation'}
            {#if view.hasPersonalCanal}
                <span class="shrink sm:shrink-0 sm:whitespace-nowrap text-amber-300">Place your personal canal or</span>
                <button class="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                    onclick={() => session.passPersonalCanal()}>Pass</button>
            {:else}
                <span class="shrink sm:shrink-0 sm:whitespace-nowrap text-amber-600">Personal canal already used</span>
            {/if}
        {/if}

    </div>
    </div>
{/if}
</div>

<style>
    .centered-row {
        margin-left: var(--board-center);
        transform: translateX(-50%);
        width: fit-content;
    }
    .table-row {
        display: contents;
    }
    .player-table {
        font-size: 0.87em;
    }
    /* Narrow screens: use the full width, so prompts wrap and controls stack instead of
       running off the screen. */
    @media (max-width: 639px), (max-height: 500px) {
        .centered-row {
            margin-left: 0;
            transform: none;
            width: auto;
            justify-content: center;
        }
    }
    /* Short screens, such as a phone held sideways: every pixel here comes out of the board,
       so the tables become one wrapping strip and the captions go. */
    @media (max-height: 500px) {
        .action-area {
            min-height: 0;
            margin-top: 2px;
        }
        .centered-row {
            padding-top: 2px;
            padding-bottom: 2px;
        }
        .caption {
            display: none;
        }
        .decision-row {
            flex-wrap: wrap;
            column-gap: 12px;
            row-gap: 4px;
        }
        .step {
            width: 30px;
            height: 30px;
            font-size: 16px;
        }
        .player-table {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 3px 10px;
            font-size: 0.72em;
        }
        .table-row {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .table-row:not(.is-overseer) .overseer-slot {
            display: none;
        }
    }
</style>
