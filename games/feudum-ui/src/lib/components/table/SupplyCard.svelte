<script lang="ts">
    import type { Color } from '@tabletop/common'
    import {
        Goods,
        VesselTypes,
        writDeckCount,
        type HydratedFeudumGameState
    } from '@tabletop/feudum'
    import ArcheryTarget from '$lib/components/pieces/ArcheryTarget.svelte'
    import GoodToken from '$lib/components/pieces/GoodToken.svelte'
    import SealFace from '$lib/components/pieces/SealFace.svelte'
    import ShillingToken from '$lib/components/pieces/ShillingToken.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import VesselToken from '$lib/components/pieces/VesselToken.svelte'
    import WritFace from '$lib/components/pieces/WritFace.svelte'
    import { influencePools } from '$lib/model/boardView.js'
    import { sealFaceShown } from '$lib/model/perspective.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { CrownPath } from '$lib/utils/pieceShapes.js'
    import { SackPath } from '$lib/utils/trackShape.js'

    /** Contract, Supply: counts only, the same for every viewer (R-4.4.1, R-4.4.2). */
    let {
        state,
        paintOf,
        colourPaintOf,
        nameOf,
        openWrits
    }: {
        state: HydratedFeudumGameState
        paintOf: (playerId: string) => SeatPaint
        colourPaintOf: (colour: Color) => SeatPaint
        nameOf: (playerId: string) => string
        openWrits?: () => void
    } = $props()

    const Piece = 28

    let deck = $derived(writDeckCount(state))
    let influence = $derived(
        influencePools(state).map(({ colour, count, playerId }) => ({
            colour,
            count,
            paint: playerId ? paintOf(playerId) : colourPaintOf(colour),
            name: playerId ? nameOf(playerId) : colourPaintOf(colour).owner
        }))
    )
</script>

{#snippet counted(kind: string, value: number, caption: string, art: import('svelte').Snippet)}
    <li class="entry">
        <span class="art" aria-hidden="true">{@render art()}</span>
        <span class="count" data-general-count={kind}>{value}</span>
        <span class="caption">{caption}</span>
    </li>
{/snippet}

<div class="supply" role="group" aria-label="General supply" data-supply-card>
    <h3 class="title">General supply</h3>

    <section class="wide" role="group" aria-label="Writ deck">
        <h4>Writ deck</h4>
        <p class="line" data-general-line="deck">
            <span class="art" aria-hidden="true"><WritFace faceShown={false} width={20} /></span>
            <span class="count" data-general-count="deck">{deck}</span>
            <span class="caption">writs</span>
            {#if openWrits}
                <button
                    type="button"
                    class="open"
                    data-open-writ-reference
                    onclick={(event) => {
                        event.stopPropagation()
                        openWrits?.()
                    }}>Writ reference</button
                >
            {/if}
        </p>
    </section>

    <section class="wide" role="group" aria-label="Haversack">
        <h4>
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                <path d={SackPath} fill="var(--feudum-wood-piece)" stroke="var(--feudum-wood-dark)"
                ></path>
            </svg>
            Haversack
        </h4>
        <ul class="row">
            {#each Goods as good (good)}
                {#snippet cube()}<GoodToken {good} size={Piece} />{/snippet}
                {@render counted(`haversack-${good}`, state.supply.haversack[good], good, cube)}
            {/each}
        </ul>
    </section>

    <section role="group" aria-label="King's seals">
        <h4>King's seals</h4>
        <ul>
            {#snippet seal()}<SealFace faceShown={sealFaceShown(false)} size={Piece} />{/snippet}
            {@render counted('seals', state.supply.sealPileCount, 'seals', seal)}
        </ul>
    </section>

    <section role="group" aria-label="Vessels">
        <h4>Vessels</h4>
        <ul class="row">
            {#each VesselTypes as vessel (vessel)}
                {#snippet token()}<VesselToken {vessel} size={Piece} />{/snippet}
                {@render counted(
                    `vessels-${vessel}`,
                    state.supply.vessels[vessel],
                    vessel.replace('-', ' '),
                    token
                )}
            {/each}
        </ul>
    </section>

    <section role="group" aria-label="Targets">
        <h4>Targets</h4>
        <ul>
            {#snippet target()}<ArcheryTarget size={Piece} />{/snippet}
            {@render counted('targets', state.supply.targets, 'targets', target)}
        </ul>
    </section>

    <section role="group" aria-label="Shillings">
        <h4>Shillings</h4>
        <ul>
            {#snippet coin()}<ShillingToken value={1} size={Piece} />{/snippet}
            {@render counted('shillings', state.supply.shillings, 'shillings', coin)}
        </ul>
    </section>

    <section role="group" aria-label="Location discs">
        <h4>Location discs</h4>
        <ul>
            {#snippet disc()}
                <svg width={Piece} height={Piece} viewBox="0 0 24 24">
                    <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="var(--feudum-disc-outpost)"
                        stroke="var(--feudum-map-ink)"
                    ></circle>
                </svg>
            {/snippet}
            {@render counted('discs', state.supply.discs.length, 'location discs', disc)}
        </ul>
    </section>

    <section class="wide" role="group" aria-label="Influence markers">
        <h4>Influence markers</h4>
        <ul class="row">
            {#each influence as row (row.colour)}
                {#snippet marker()}<SeatToken
                        kind="marker"
                        paint={row.paint}
                        size={Piece}
                    />{/snippet}
                {@render counted(`influence-${row.colour}`, row.count, row.name, marker)}
            {/each}
        </ul>
    </section>

    <section class="wide" role="group" aria-label="Start player">
        <h4>Start player</h4>
        <p class="entry" data-start-player={state.startingPlayerId}>
            <span class="art token" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d={CrownPath} fill="var(--feudum-accent)" stroke="var(--feudum-ink)"
                    ></path>
                </svg>
                <SeatToken kind="disc" paint={paintOf(state.startingPlayerId)} size={18} />
            </span>
            <span class="caption">{nameOf(state.startingPlayerId)}</span>
        </p>
    </section>
</div>

<style>
    .supply {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem 1rem;
        box-sizing: border-box;
        width: 26rem;
        max-width: 100%;
        max-height: min(30rem, 70dvh);
        min-height: 0;
        overflow-y: auto;
        padding: 0.75rem 0.875rem;
        border: 1px solid var(--feudum-accent);
        border-radius: 0.5rem;
        background: var(--feudum-surface-raised);
        color: var(--feudum-text);
        font-size: 0.8125rem;
        cursor: pointer;
    }

    .title {
        grid-column: 1 / -1;
        margin: 0;
        font-family: var(--feudum-font-title);
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--feudum-accent);
    }

    .wide {
        grid-column: 1 / -1;
    }

    h4 {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        margin: 0 0 0.25rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--feudum-text-muted);
    }

    ul {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    ul.row {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 0.25rem 0.875rem;
    }

    .entry {
        display: grid;
        grid-template-columns: auto auto;
        grid-template-rows: auto auto;
        align-items: center;
        column-gap: 0.25rem;
        margin: 0;
    }

    .art {
        display: inline-flex;
        grid-row: 1 / 3;
        align-items: center;
        gap: 0.125rem;
        line-height: 0;
    }

    .count {
        font-size: 0.9375rem;
        font-weight: 700;
        line-height: 1.1;
    }

    .caption {
        font-size: 0.6875rem;
        line-height: 1.1;
        color: var(--feudum-text-muted);
    }

    /* Contract, Spacing: the deck's count and its button read as one group. */
    .line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem;
        margin: 0;
    }

    .line .open {
        margin-left: 0.25rem;
    }

    .open {
        min-height: 2.75rem;
        padding: 0 0.75rem;
        border: 1px solid var(--feudum-frame);
        border-radius: 0.375rem;
        background: var(--feudum-surface);
        color: var(--feudum-text);
        font-weight: 600;
    }
</style>
