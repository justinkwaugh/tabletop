<script lang="ts">
    import type { MoneyFormat } from '../presentation/money.js'
    import { flip } from 'svelte/animate'
    import { prefersReducedMotion } from 'svelte/motion'
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
    import CompanyOrderOverview from './CompanyOrderOverview.svelte'
    let {
        money,
        showDetails,
        companies,
        gameState,
        trainDepot,
        trainColors,
        requiresTrain,
        appearances,
        currentCompanyId,
        completedCompanyIds = [],
        companyDetails,
        overview = true,
        overflowing = $bindable(false),
        firstVisible = $bindable(-1),
        lastVisible = $bindable(-1)
    }: {
        money: MoneyFormat
        showDetails: boolean
        companies: readonly Company[]
        gameState: Pick<FinancialState, 'cash'> & TrainState & StationState
        trainColors: Readonly<Record<string, string>>
        trainDepot: TrainDepot
        requiresTrain: (companyId: string) => boolean
        appearances: Readonly<Record<string, StationAppearance>>
        currentCompanyId?: string
        completedCompanyIds?: readonly string[]
        companyDetails: Snippet<[Company]>
        /** Whether the overflow overview renders here; off when the host shows it elsewhere. */
        overview?: boolean
        overflowing?: boolean
        firstVisible?: number
        lastVisible?: number
    } = $props()
    function trackVisibleCompanies(area: HTMLOListElement) {
        let frame: number | undefined
        function measure() {
            frame = undefined
            overflowing = area.scrollWidth > area.clientWidth + 1
            const visible = [...area.children].flatMap((child, index) =>
                child instanceof HTMLElement &&
                child.offsetLeft - area.offsetLeft >= area.scrollLeft - 0.5 &&
                child.offsetLeft - area.offsetLeft + child.offsetWidth <=
                    area.scrollLeft + area.clientWidth + 0.5
                    ? [index]
                    : []
            )
            firstVisible = visible[0] ?? -1
            lastVisible = visible.at(-1) ?? -1
        }
        function scheduleMeasure() {
            if (frame === undefined) frame = requestAnimationFrame(measure)
        }
        const resize = new ResizeObserver(scheduleMeasure)
        function observeCompanies() {
            resize.disconnect()
            resize.observe(area)
            for (const child of area.children) resize.observe(child)
            scheduleMeasure()
        }
        const companiesChanged = new MutationObserver(observeCompanies)
        companiesChanged.observe(area, { childList: true })
        area.addEventListener('scroll', scheduleMeasure, { passive: true })
        observeCompanies()
        return {
            destroy() {
                resize.disconnect()
                companiesChanged.disconnect()
                area.removeEventListener('scroll', scheduleMeasure)
                if (frame !== undefined) cancelAnimationFrame(frame)
            }
        }
    }
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
                amount: cashOwnedBy(gameState, { kind: 'company', companyId: company.id }),
                trains: trainsOwnedBy(gameState, {
                    kind: 'company',
                    companyId: company.id
                }).map((train) => ({
                    id: train.id,
                    color: trainColors[train.definitionId],
                    name: trainDepot.trainDefinition(train.definitionId).name
                })),
                remainingTokens: gameState.stations.filter(
                    (station) => station.companyId === company.id && station.status === 'available'
                )
            }
        })
    )
</script>

<section aria-label="Company order" class="company-order">
    {#if overview && overflowing}
        <div class="order-heading">
            <CompanyOrderOverview {companies} {appearances} {firstVisible} {lastVisible} />
        </div>
    {/if}
    <ol use:trackVisibleCompanies>
        {#each entries as { company, appearance, amount, trains, remainingTokens } (company.id)}
            {@const completed = completedCompanyIds.includes(company.id)}
            {@const detailed = showDetails || currentCompanyId === company.id}
            <li
                animate:flip={{ duration: prefersReducedMotion.current ? 0 : 180 }}
                data-company-id={company.id}
                class:completed
                aria-current={currentCompanyId === company.id ? 'step' : undefined}
                aria-label={`${company.name}, cash ${amount === undefined ? 'not applicable' : amount}, trains ${trains.map((train) => train.name).join(', ') || 'none'}, ${remainingTokens.length} station tokens remaining${currentCompanyId === company.id ? ', operating' : completed ? ', operated' : ''}`}
                title={company.name}
            >
                <button
                    id={`${detailsId}-${company.id}`}
                    class="pill"
                    class:token-only={!detailed}
                    aria-label={company.name}
                    aria-expanded={expandedCompanyId === company.id}
                    aria-controls={`${detailsId}-panel`}
                    onclick={() =>
                        (expandedCompanyId =
                            expandedCompanyId === company.id ? undefined : company.id)}
                >
                    <CompanyToken {appearance} size={38} />
                    {#if detailed}<div class="details">
                            <div class="summary">
                                <span class="cash"
                                    >{amount === undefined
                                        ? '—'
                                        : amount === 'unlimited'
                                          ? '$∞'
                                          : `${money(amount)}`}</span
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
                        </div>{/if}
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
        padding: 8px 0 0;
        background: transparent;
        min-height: 52px;
        min-width: 0;
    }
    .order-heading {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        max-width: 100%;
    }
    ol {
        display: flex;
        justify-content: safe center;
        align-items: center;
        gap: 7px;
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scrollbar-width: thin;
        scrollbar-color: var(--rail-muted, #9b8874) transparent;
        list-style: none;
        padding: 0 2px 0 0;
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
        border: 1px solid var(--rail-border, #d2c5b7);
        background: var(--rail-surface, #f8f3ec);
        font: inherit;
        text-align: left;
        cursor: pointer;
    }
    .pill:hover {
        background: var(--rail-surface, #fffaf3);
        border-color: var(--rail-border, #ae9983);
    }
    .pill.token-only {
        padding: 0;
        border-radius: 50%;
        background: transparent;
        border-color: transparent;
    }
    .pill:focus-visible {
        outline: 2px solid var(--rail-focus, #796047);
        outline-offset: -2px;
    }
    .expanded-panel {
        display: flex;
        justify-content: safe center;
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
        color: var(--rail-text, #695540);
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
        color: var(--rail-negative, #b33a32);
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
        border-right: 1px solid var(--rail-border, #d2c5b7);
        color: var(--rail-text, #5e4937);
        font-size: 13px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
    .completed {
        opacity: 0.55;
    }
    .empty {
        font-size: 12px;
        color: var(--rail-muted, #a18c75);
    }
</style>
