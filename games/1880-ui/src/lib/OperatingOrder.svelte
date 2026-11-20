<script lang="ts">
    import { MajorHomes1880 } from '@tabletop/1880'
    import { homeStationId } from '@tabletop/18xx'
    import { CompanyToken } from '@tabletop/18xx-ui'
    import type { Session1880 } from './session.svelte.js'
    import {
        operatingOrderList,
        type OperatingOrderSlot,
        type OperatingStanding
    } from './operatingOrder.js'
    let { session, reveal }: { session: Session1880; reveal: (locationId: string) => void } =
        $props()
    const view = $derived(operatingOrderList(session.gameState))
    const money = $derived(session.presentation.money)
    const TokenSize = 34

    const StandingWords: Record<OperatingStanding, string> = {
        unfloated: 'not yet floated',
        operated: 'operated this round',
        current: 'its turn under way',
        waiting: 'still to operate this round'
    }

    function home(companyId: string): string {
        const station = session.gameState.stations.find(
            (entry) => entry.id === homeStationId(companyId)
        )
        return station?.status === 'placed'
            ? station.position.locationId
            : MajorHomes1880[companyId]
    }

    function description(price: number, slot: OperatingOrderSlot): string {
        const place = `${slot.place}. ${money(price)}`
        if (!slot.companyId || !slot.standing) return `${place}, free`
        const marker = slot.trainMarker ? '; holds the train marker' : ''
        return `${place}, ${session.companyName(slot.companyId)}, ${StandingWords[slot.standing]}${marker}`
    }
</script>

<section class="operating-order" aria-label="Operating order">
    <h3>Operating order</h3>
    <ol class="rows">
        {#each view.rows as row (row.price)}
            <li class="row">
                <span class="price">{money(row.price)}</span>
                <ol class="slots">
                    {#each row.slots as slot (slot.place)}
                        {@const words = description(row.price, slot)}
                        <li class={['slot', slot.standing ?? 'free']} title={words}>
                            {#if slot.companyId}
                                {@const companyId = slot.companyId}
                                <button
                                    class="token"
                                    aria-label={`Show ${words}`}
                                    onclick={() => reveal(home(companyId))}
                                    ><CompanyToken
                                        appearance={session.mapView.stations[companyId]}
                                        size={TokenSize}
                                    /></button
                                >
                                {#if slot.standing === 'operated'}<span
                                        class="operated-mark"
                                        aria-hidden="true"
                                        ><svg viewBox="0 0 12 12"
                                            ><path d="M2.5 6.2 5 8.6 9.6 3.6"></path></svg
                                        ></span
                                    >{/if}
                                {#if slot.trainMarker}<span class="train-marker" aria-hidden="true"
                                        >{@render locomotive()}</span
                                    >{/if}
                            {:else}
                                <span class="place" aria-label={words}>{slot.place}</span>
                            {/if}
                        </li>
                    {/each}
                </ol>
            </li>
        {/each}
    </ol>
    {#if view.trainMarkerId}
        {@const name = session.companyName(view.trainMarkerId)}
        <p class="marker-note">
            <span class="note-icon">{@render locomotive()}</span>
            {#if view.finalRound !== undefined}
                Game ends after {name} in OR {view.finalRound}
            {:else}
                Last train bought by {name}
            {/if}
        </p>
    {/if}
</section>

{#snippet locomotive()}<svg viewBox="0 0 20 14" class="locomotive"
        ><path d="M2 2h6v4h3V3h2v3h3.5c.8 0 1.5.7 1.5 1.5V10H2zM1 10.5h18V11.5H1z"></path><circle
            cx="5"
            cy="12"
            r="1.8"
        ></circle><circle cx="10" cy="12" r="1.8"></circle><circle cx="15" cy="12" r="1.8"
        ></circle></svg
    >{/snippet}

<style>
    .operating-order {
        padding: 8px 10px 9px;
        border: 1px solid var(--rail-border, #d2c5b7);
        border-radius: 4px;
        background: var(--rail-surface, #faf7f2);
        color: var(--rail-text, #463e35);
    }
    h3 {
        margin: 0 0 6px;
        font-size: 13px;
        font-weight: 650;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--rail-muted, #817261);
    }
    ol {
        margin: 0;
        padding: 0;
        list-style: none;
    }
    .rows {
        display: grid;
        gap: 4px;
    }
    .row {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .price {
        width: 40px;
        font-size: 14px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        text-align: right;
    }
    .slots {
        display: flex;
        gap: 6px;
    }
    .slot {
        position: relative;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 50%;
    }
    .slot.free {
        border: 1px dashed var(--rail-border, #c9baa8);
    }
    .slot.current {
        box-shadow: 0 0 0 3px #f2c94c;
    }
    .place {
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--rail-muted, #a39482);
    }
    .token {
        width: 40px;
        height: 40px;
        padding: 3px;
        border: 0;
        border-radius: 50%;
        background: none;
        cursor: pointer;
    }
    .token :global(svg) {
        display: block;
    }
    .token:focus-visible {
        outline: 2px solid #bd865e;
        outline-offset: 2px;
    }
    .unfloated .token {
        opacity: 0.4;
    }
    .operated .token {
        opacity: 0.6;
    }
    .operated-mark {
        position: absolute;
        top: -2px;
        right: -3px;
        display: grid;
        place-items: center;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #4f7a43;
    }
    .operated-mark svg {
        width: 12px;
        height: 12px;
        fill: none;
        stroke: #fff;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    .train-marker {
        position: absolute;
        right: -8px;
        bottom: -3px;
        display: grid;
        place-items: center;
        width: 24px;
        height: 18px;
        border-radius: 4px;
        background: #f2c94c;
        color: #2a2416;
    }
    .train-marker .locomotive {
        width: 18px;
        height: 13px;
    }
    .locomotive {
        display: block;
        fill: currentColor;
    }
    .marker-note {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 7px 0 0;
        font-size: 12px;
        color: var(--rail-text, #463e35);
    }
    .note-icon {
        display: grid;
        place-items: center;
        width: 24px;
        height: 18px;
        border-radius: 4px;
        background: #f2c94c;
        color: #2a2416;
    }
    .note-icon .locomotive {
        width: 18px;
        height: 13px;
    }
</style>
