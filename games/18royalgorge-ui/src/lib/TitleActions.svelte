<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import { NuggetBonus, NuggetId, GoldBonus } from '@tabletop/18royalgorge'
    import { depotTurnNote } from './metalBoard.js'
    import { BridgeLeasePayerWords } from './bridgeLeaseWords.js'
    import {
        CompanyToken,
        SwitchTrack,
        counted,
        TitlePrompt,
        TrainBadge,
        contrastingTextColor
    } from '@tabletop/18xx-ui'
    import type {
        ExtensionOffer,
        SessionRoyalGorge,
        TrainExtensionChoices
    } from './session.svelte.js'
    let { session }: { session: SessionRoyalGorge } = $props()
    const money = $derived(session.presentation.money)
    const initials = (companyId: string) => session.companyInitials(companyId)
    const trainName = (definitionId: string) =>
        session.trainDepot.trainDefinition(definitionId).name
    const sourceName = (sourceId: string) => session.companyName(sourceId)
    const steelPrices = $derived(
        session.steel.colors.flatMap((color) => {
            if (!color.next) return []
            const fill = session.tileAppearance.colors[color.color]
            assertExists(fill, `Tiles of ${color.color} have a colour`)
            return [{ color: color.color, price: color.next.price, fill }]
        })
    )
    const lengthened = $derived(session.trainExtensions.filter((train) => train.added.length))
    const extensionSources = $derived(
        new Set(session.extensionOffers.map((offer) => offer.sourceId))
    )
    function offerText(offer: ExtensionOffer): string {
        const stops = offer.stops === 1 ? 'Add one stop to a train' : 'Add two stops to a train'
        return extensionSources.size > 1 ? `${stops} with the ${sourceName(offer.sourceId)}` : stops
    }
</script>

{#snippet trainBadge(train: TrainExtensionChoices)}<TrainBadge
        name={trainName(train.definitionId)}
        color={session.presentation.trainColors[train.definitionId]}
    />{/snippet}

{#if session.buyingSteel && steelPrices.length}
    <p class="steel-line">
        Steel:{#each steelPrices as entry (entry.color)}{' '}<span
                class="steel-price"
                title={`Steel for a ${entry.color} tile`}
                style:--tile-color={entry.fill}
                style:--tile-ink={contrastingTextColor(entry.fill)}>{money(entry.price)}</span
            >{/each}
    </p>
    {#if session.steelChoosable}<p class="note">Change columns on CF&I’s market.</p>{/if}
    {#if session.steel.depot?.turn}
        {@const depot = session.steel.depot.turn}
        <p class="depot-line">
            <button
                class="depot-switch"
                role="switch"
                aria-checked={depot.on}
                disabled={!depot.choosable || session.actionsLocked}
                onclick={() => void session.toggleSteelDepot()}
                ><SwitchTrack on={depot.on} instant={session.restoredSilently} />Free yellow steel
                from the Steel Depot</button
            ><span class="depot-note">{depotTurnNote(session.steel.depot.steel, depot)}</span>
        </p>
    {/if}
{/if}

{#if session.extensionOffers.length || lengthened.length}
    <section class="extensions" aria-label="Lengthen trains">
        {#each session.extensionOffers as offer (`${offer.sourceId}:${offer.stops}`)}
            {@const text = offerText(offer)}
            <TitlePrompt {text}>
                <span class="choices"
                    >{#each offer.trains as train (train.trainId)}<button
                            class="action-button inline-action train-choice"
                            disabled={session.actionsLocked}
                            aria-label={`${text}: the ${trainName(train.definitionId)}’s`}
                            onclick={() =>
                                session.extendTrain(train.trainId, offer.sourceId, offer.stops)}
                            >{@render trainBadge(train)}</button
                        >{/each}</span
                >
            </TitlePrompt>
        {/each}
        {#if lengthened.length}<p class="lengthened">
                {#each lengthened as train (train.trainId)}{@const extra = train.added.reduce(
                        (sum, added) => sum + added.stops,
                        0
                    )}<span class="train-note"
                        ><span class="route-color" style:background={train.routeColor}
                        ></span>{@render trainBadge(train)} +{counted(extra, 'stop')}</span
                    >{/each}
            </p>{/if}
    </section>
{/if}

{#if session.bridgeLeaseOffered}
    <TitlePrompt
        text="Use the Hanging Bridge Lease to run through the Royal Gorge? Rio Grande gets 10% of each train that does."
        answer={{ label: 'Use the lease', onAct: () => void session.useBridgeLease() }}
    />
{:else if session.bridgeLeaseInUse}
    <p class="note">
        Using the Hanging Bridge Lease: Rio Grande gets 10% of each train through the gorge.
    </p>
{/if}

{#if session.bridgeLease}
    {@const lease = session.bridgeLease}
    <TitlePrompt
        text="{initials(lease.companyId)} ran through the Royal Gorge: pay Rio Grande {money(
            lease.owed
        )} for the Hanging Bridge Lease."
    >
        <span class="choices"
            >{#each lease.payers as payer (payer)}<button
                    class="action-button inline-action"
                    disabled={session.actionsLocked}
                    onclick={() => session.payBridgeLease(payer)}
                    >{BridgeLeasePayerWords[payer].pays} {money(lease.owed)}</button
                >{/each}</span
        >
    </TitlePrompt>
{/if}

{#if session.shippableGold.length}
    <TitlePrompt
        text={session.nuggetAvailable
            ? `Choose a gold cube on the map to add +${money(GoldBonus)}, or +${money(NuggetBonus)} with the ${session.companyName(NuggetId)}`
            : `Choose a gold cube on the map to add +${money(GoldBonus)}`}
    />
{/if}

{#if session.goldShipped}
    <p class="steel-line">
        The revenue includes +{money(session.goldShipped.amount)} for gold shipped from {session.placeName(
            session.goldShipped.locationId
        )}.
    </p>
{/if}

{#if session.ghostTownSite}
    <TitlePrompt
        text="Leave a ghost town at {session.placeName(session.ghostTownSite)}?"
        answer={{ label: 'Place ghost town', onAct: () => void session.placeGhostTown() }}
    />
{/if}

{#if session.debtPayment}
    {@const debt = session.debtPayment}
    {#snippet debtor()}<span
            class="debtor"
            role="img"
            aria-label={session.companyName(debt.companyId)}
            ><CompanyToken appearance={session.mapView.stations[debt.companyId]} size={22} /></span
        >{/snippet}
    <TitlePrompt
        lead={debtor}
        text="owes {counted(debt.owed, 'debt')}:"
        answer={{
            label: `Repay one for ${money(debt.price)}`,
            onAct: () => void session.payDebt()
        }}
    />
{/if}

<style>
    .debtor {
        display: inline-flex;
    }
    .steel-price {
        display: inline-block;
        padding: 0 5px;
        border-radius: 3px;
        background: var(--tile-color);
        color: var(--tile-ink);
        font-weight: 600;
        line-height: 18px;
    }
    .depot-line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin: 2px 0;
        font-size: 12px;
    }
    .depot-switch {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 2px 4px;
        border: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }
    .depot-switch:disabled {
        cursor: default;
        opacity: 0.6;
    }
    .depot-note {
        color: var(--rail-muted, #887969);
    }
    .note {
        margin: 0 0 4px;
        text-align: center;
        font-size: 12px;
        color: var(--rail-muted, #887969);
    }
    .steel-line {
        margin: 4px 0;
        text-align: center;
        font-size: 13px;
        color: var(--rail-text, #514536);
    }
    .extensions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        margin: 4px 0 8px;
    }
    .train-choice {
        --train-badge-font: 13px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
    }
    .route-color {
        width: 5px;
        height: 14px;
        border-radius: 2px;
    }
    .lengthened {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
        margin: 2px 0;
        font-size: 12px;
        color: var(--rail-muted, #887969);
    }
    .train-note {
        --train-badge-font: 13px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    /* A prompt's choices wrap below its question together, never one by one. */
    .choices {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
</style>
