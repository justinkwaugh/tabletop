<script lang="ts">
    import type { Snippet } from 'svelte'
    import { assertExists } from '@tabletop/common'
    import {
        cashOwnedBy,
        trainsOwnedBy,
        type Company,
        type FinancialState,
        type TrainState,
        type StationState,
        type TrainDepot
    } from '@tabletop/18xx'
    import type { StationAppearance } from '../maps/stationPresentation.js'
    import TrainBadge from '../trains/TrainBadge.svelte'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    let {
        companies,
        state: financialState,
        trainDepot,
        trainColors,
        requiresTrain,
        appearances,
        currentCompanyId,
        completedCompanyIds = [],
        prospective = false,
        companyDetails
    }: {
        companies: readonly Company[]
        state: Pick<FinancialState, 'cash'> & TrainState & StationState
        trainColors: Readonly<Record<string, string>>
        trainDepot: TrainDepot
        requiresTrain: (companyId: string) => boolean
        appearances: Readonly<Record<string, StationAppearance>>
        currentCompanyId?: string
        completedCompanyIds?: readonly string[]
        prospective?: boolean
        companyDetails: Snippet<[Company]>
    } = $props()
    const detailsId = $props.id()
    let expandedCompanyId = $state<string>()
    const expandedCompany = $derived(companies.find((company) => company.id === expandedCompanyId))
    const entries = $derived(
        companies.map((company) => {
            const appearance = appearances[company.id]
            assertExists(appearance, `Missing company appearance: ${company.id}`)
            return {
                company,
                appearance,
                amount: cashOwnedBy(financialState, { kind: 'company', companyId: company.id }),
                trains: trainsOwnedBy(financialState, {
                    kind: 'company',
                    companyId: company.id
                }).map((train) => ({
                    id: train.id,
                    color: trainColors[train.definitionId],
                    name: trainDepot.trainDefinition(train.definitionId).name
                })),
                remainingTokens: financialState.stations.filter(
                    (station) => station.companyId === company.id && station.status === 'available'
                )
            }
        })
    )
</script>

<section aria-label="Company order" class="company-order">
    <span class="heading">{prospective ? 'Next operating order' : 'Operating order'}</span>
    <ol>
        {#each entries as { company, appearance, amount, trains, remainingTokens } (company.id)}
            {@const completed = completedCompanyIds.includes(company.id)}
            <li
                data-company-id={company.id}
                class:completed
                aria-current={currentCompanyId === company.id ? 'step' : undefined}
                aria-label={`${company.name}, cash ${amount === undefined ? 'not applicable' : amount}, trains ${trains.map((train) => train.name).join(', ') || 'none'}, ${remainingTokens.length} station tokens remaining${currentCompanyId === company.id ? ', operating' : completed ? ', operated' : ''}`}
                title={company.name}
            >
                <button
                    id={`${detailsId}-${company.id}`}
                    class="pill"
                    aria-label={company.name}
                    aria-expanded={expandedCompanyId === company.id}
                    aria-controls={`${detailsId}-panel`}
                    onclick={() =>
                        (expandedCompanyId =
                            expandedCompanyId === company.id ? undefined : company.id)}
                >
                    <CompanyToken {appearance} size={38} />
                    <div class="details">
                        <div class="summary">
                            <span class="cash"
                                >{amount === undefined
                                    ? '—'
                                    : amount === 'unlimited'
                                      ? '$∞'
                                      : `$${amount.toLocaleString('en-US')}`}</span
                            >
                            <span
                                class="tokens"
                                class:empty-tokens={remainingTokens.length === 0}
                                title={`${remainingTokens.length} station tokens remaining`}
                            >
                                <span>{remainingTokens.length}</span>
                                <CompanyToken {appearance} size={14} />
                            </span>
                        </div>
                        <div class="trains">
                            {#each trains as train (train.id)}
                                <TrainBadge name={train.name} color={train.color} />
                            {:else}
                                <span
                                    class="no-trains"
                                    class:train-required={requiresTrain(company.id)}
                                    title={requiresTrain(company.id)
                                        ? 'Must buy a train when operating'
                                        : undefined}>No trains</span
                                >
                            {/each}
                        </div>
                    </div>
                    {#if completed}<span class="done" aria-hidden="true">✓</span>{/if}
                </button>
            </li>
        {/each}
    </ol>
    <div id={`${detailsId}-panel`} class="expanded-panel">
        {#if expandedCompany}{@render companyDetails(expandedCompany)}{/if}
    </div>
    {#if !companies.length}<span class="empty">No operating companies</span>{/if}
</section>

<style>
    .company-order {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        flex-shrink: 0;
        gap: 5px;
        padding: 8px 16px 2px;
        min-height: 52px;
        min-width: 0;
    }
    .heading {
        flex-shrink: 0;
        font-size: 10px;
        font-weight: 650;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #817261;
    }
    ol {
        display: flex;
        align-items: center;
        gap: 7px;
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scrollbar-width: thin;
        list-style: none;
        padding: 0 2px 3px 0;
        margin: 0;
    }
    li {
        position: relative;
        flex-shrink: 0;
    }
    .pill {
        position: relative;
        display: flex;
        align-items: center;
        flex-shrink: 0;
        gap: 8px;
        padding: 0 7px 0 0;
        border-radius: 20px 8px 8px 20px;
        border: 1px solid #d2c5b7;
        background: #f8f3ec;
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .pill:hover {
        background: #fffaf3;
        border-color: #ae9983;
    }
    .pill:focus-visible {
        outline: 2px solid #796047;
        outline-offset: -2px;
    }
    .expanded-panel {
        width: 100%;
        min-width: 0;
    }
    .expanded-panel:empty {
        display: none;
    }
    .details {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }
    .summary {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 16px;
    }
    .tokens,
    .no-trains {
        color: #695540;
        font-size: 12px;
        white-space: nowrap;
        line-height: 15px;
    }
    .tokens {
        display: flex;
        align-items: center;
        gap: 3px;
        height: 15px;
        font-size: 13px;
    }
    .train-required {
        color: #b33a32;
    }
    .empty-tokens {
        filter: grayscale(1);
        opacity: 0.45;
    }
    .trains {
        display: flex;
        align-items: center;
        gap: 3px;
        min-height: 16px;
    }
    .cash {
        padding-right: 6px;
        line-height: 15px;
        border-right: 1px solid #d2c5b7;
        color: #5e4937;
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .completed {
        opacity: 0.55;
    }
    .done {
        position: absolute;
        right: -2px;
        bottom: -1px;
        color: #4c6653;
        background: #ede2dc;
        border-radius: 50%;
        font-size: 12px;
        line-height: 16px;
        width: 16px;
        text-align: center;
    }
    .empty {
        font-size: 12px;
        color: #938371;
    }
</style>
