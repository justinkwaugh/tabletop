<script lang="ts">
    import CompanyCard from '$lib/components/CompanyCard.svelte'
    import ShipMarker from '$lib/components/ShipMarker.svelte'
    import { shadeHexColor } from '$lib/utils/color.js'
    import { Color } from '@tabletop/common'
    import {
        ActionType,
        BID_RESEARCH_MULTIPLIERS,
        CompanyType,
        MachineState,
        type TurnOrderBid
    } from '@tabletop/indonesia'
    import { PlayerName } from '@tabletop/frontend-components'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    let bidInput = $state('0')
    let placingTurnOrderBid = $state(false)
    let choosingOperatingCompany = $state(false)
    let deliveringGood = $state(false)
    let finishingOptionalProductionExpansion = $state(false)

    const showTurnOrderBidFormula = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.BiddingForTurnOrder &&
            gameSession.validActionTypes.includes(ActionType.PlaceTurnOrderBid)
        )
    })

    const bidResearchMultiplier = $derived.by(() => {
        const researchLevel = gameSession.myPlayerState?.research.bid ?? 0
        return BID_RESEARCH_MULTIPLIERS[researchLevel] ?? 1
    })

    const bidAmount = $derived.by(() => {
        if (bidInput.length === 0) {
            return 0
        }

        const parsed = Number.parseInt(bidInput, 10)
        if (!Number.isFinite(parsed)) {
            return 0
        }

        return parsed
    })

    const multipliedBidAmount = $derived.by(() => bidAmount * bidResearchMultiplier)
    const availableCash = $derived.by(() => gameSession.myPlayerState?.cash ?? 0)

    const bidInputInvalid = $derived.by(() => {
        if (!showTurnOrderBidFormula) {
            return false
        }
        if (bidInput.length === 0) {
            return true
        }
        return bidAmount > availableCash
    })

    const canSubmitTurnOrderBid = $derived.by(() => {
        return showTurnOrderBidFormula && !placingTurnOrderBid && !bidInputInvalid
    })

    const showTurnOrderBidTracker = $derived.by(() => {
        return (
            gameSession.gameState.machineState === MachineState.BiddingForTurnOrder &&
            !gameSession.gameState.result
        )
    })

    type TurnOrderBidEntry = {
        playerId: string
        turnOrderBid: TurnOrderBid | null
    }

    const turnOrderBidEntries: TurnOrderBidEntry[] = $derived.by(() => {
        const bidByPlayerId = gameSession.gameState.turnOrderBids ?? {}

        return gameSession.gameState.turnManager.turnOrder.map((playerId) => ({
            playerId,
            turnOrderBid: bidByPlayerId[playerId] ?? null
        }))
    })

    const submittedTurnOrderBidEntries: TurnOrderBidEntry[] = $derived.by(() =>
        turnOrderBidEntries.filter((entry) => entry.turnOrderBid !== null)
    )

    const showOperatingCompanyPicker = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.Operations &&
            gameSession.validActionTypes.includes(ActionType.ChooseOperatingCompany) &&
            !gameSession.gameState.result
        )
    })

    const showProductionOperationsPanel = $derived.by(() => {
        return (
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.ProductionOperations &&
            !gameSession.gameState.result
        )
    })

    const showDeliveryShippingChoices = $derived.by(() => {
        return (
            showProductionOperationsPanel &&
            gameSession.deliverySelectionStage === 'shipping' &&
            gameSession.deliveryShippingChoices.length > 0
        )
    })

    const showOptionalProductionExpansionDoneButton = $derived.by(() => {
        return (
            showProductionOperationsPanel &&
            gameSession.productionOperationStage === 'optional-expansion' &&
            gameSession.validActionTypes.includes(ActionType.Pass)
        )
    })

    const companyById: Map<string, (typeof gameSession.gameState.companies)[number]> = $derived.by(
        () => new Map(gameSession.gameState.companies.map((company) => [company.id, company]))
    )

    $effect(() => {
        if (!showOperatingCompanyPicker) {
            gameSession.setHoveredOperatingCompany(undefined)
        }
    })

    $effect(() => {
        if (!showDeliveryShippingChoices) {
            gameSession.setHoveredDeliveryRoute(undefined)
        }
    })

    type OwnedOperatingCompanyEntry = {
        company: (typeof gameSession.gameState.companies)[number]
        cultivatedAreaCount: number
        earnings: number | null
    }

    function shippingMarkerVisualForCompany(shippingCompanyId: string): {
        style: 'a' | 'b'
        hullFillColor: string
        hullStrokeColor: string
    } {
        const company = companyById.get(shippingCompanyId)
        if (!company) {
            return {
                style: 'a',
                hullFillColor: '#7ea6ad',
                hullStrokeColor: 'none'
            }
        }

        const hullFillColor = gameSession.colors.getPlayerUiColor(company.owner)
        const ownerPlayerColor = gameSession.colors.getPlayerColor(company.owner)
        return {
            style: shippingCompanyId.charCodeAt(0) % 2 === 0 ? 'a' : 'b',
            hullFillColor,
            hullStrokeColor:
                ownerPlayerColor === Color.Yellow ? shadeHexColor(hullFillColor, 0.35) : 'none'
        }
    }

    const cultivatedAreaCountByCompanyId: Record<string, number> = $derived.by(() => {
        const cultivatedCounts: Record<string, number> = {}
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('companyId' in area)) {
                continue
            }

            cultivatedCounts[area.companyId] = (cultivatedCounts[area.companyId] ?? 0) + 1
        }
        return cultivatedCounts
    })

    const ownedOperatingCompanies: OwnedOperatingCompanyEntry[] = $derived.by(() => {
        const myPlayerId = gameSession.myPlayer?.id
        if (!myPlayerId) {
            return []
        }
        const operableCompanyIdSet = new Set(gameSession.operableOwnedCompanyIds)

        return gameSession.gameState.companies
            .filter(
                (company) => company.owner === myPlayerId && operableCompanyIdSet.has(company.id)
            )
            .map((company) => ({
                company,
                cultivatedAreaCount:
                    company.type === CompanyType.Production
                        ? (cultivatedAreaCountByCompanyId[company.id] ?? 0)
                        : 0,
                earnings: null
            }))
    })

    const maxGoodsToShipForCurrentProductionOperation = $derived.by(() => {
        return gameSession.gameState.operatingCompanyDeliveryPlan?.totalDelivered ?? 0
    })

    const shippedGoodsCountForCurrentProductionOperation = $derived.by(() => {
        return gameSession.gameState.operatingCompanyShippedGoodsCount ?? 0
    })

    const remainingProductionExpansionCount = $derived.by(() => {
        if (
            gameSession.productionOperationStage !== 'mandatory-expansion' &&
            gameSession.productionOperationStage !== 'optional-expansion'
        ) {
            return 0
        }

        const expansionLimit = (gameSession.myPlayerState?.research.expansion ?? 0) + 1
        const expansionCount = gameSession.gameState.operatingCompanyExpansionCount ?? 0
        return Math.max(0, expansionLimit - expansionCount)
    })

    const message = $derived.by(() => {
        if (gameSession.isViewingHistory) {
            return 'Viewing history.'
        }

        if (gameSession.gameState.result) {
            return 'Game over.'
        }

        if (!gameSession.isMyTurn) {
            return 'Waiting for your turn.'
        }

        switch (gameSession.gameState.machineState) {
            case MachineState.NewEra: {
                if (gameSession.validActionTypes.includes(ActionType.PlaceCity)) {
                    return 'Select a highlighted area to place a city.'
                }
                if (gameSession.validActionTypes.includes(ActionType.PlaceCompanyDeeds)) {
                    return 'Place company deeds for the new era.'
                }
                if (gameSession.validActionTypes.includes(ActionType.Pass)) {
                    return 'No valid city placement. Passing will continue the round.'
                }
                return 'Complete New Era setup.'
            }
            case MachineState.BiddingForTurnOrder: {
                if (gameSession.validActionTypes.includes(ActionType.PlaceTurnOrderBid)) {
                    return 'Place your turn-order bid.'
                }
                if (gameSession.validActionTypes.includes(ActionType.SetTurnOrder)) {
                    return 'Set the new turn order.'
                }
                return 'Resolve turn order.'
            }
            case MachineState.Mergers:
                return 'Propose a merger.'
            case MachineState.Acquisitions:
                return 'Select a deed, then select a highlighted area to start the company.'
            case MachineState.ResearchAndDevelopment:
                return 'Choose an area to research.'
            case MachineState.Operations:
                return 'Choose a company to operate.'
            case MachineState.ShippingOperations:
                return 'Operate shipping company.'
            case MachineState.ProductionOperations: {
                if (gameSession.productionOperationStage === 'mandatory-expansion') {
                    const remainingExpansions = remainingProductionExpansionCount
                    const areasLabel = remainingExpansions === 1 ? 'area' : 'areas'
                    return `Expand ${remainingExpansions} ${areasLabel} for free.`
                }

                if (gameSession.productionOperationStage === 'optional-expansion') {
                    const remainingExpansions = remainingProductionExpansionCount
                    const areasLabel = remainingExpansions === 1 ? 'area' : 'areas'
                    return `You may expand up to ${remainingExpansions} ${areasLabel} or finish.`
                }

                const maxGoodsToShip = maxGoodsToShipForCurrentProductionOperation
                const goodsLabel = maxGoodsToShip === 1 ? 'good' : 'goods'
                const baseMessage =
                    shippedGoodsCountForCurrentProductionOperation > 0
                        ? `Ship ${maxGoodsToShip} more ${goodsLabel}.`
                        : `Ship ${maxGoodsToShip} ${goodsLabel}.`

                if (gameSession.deliverySelectionStage === 'cultivated') {
                    return `${baseMessage} Choose a cultivated area.`
                }
                if (gameSession.deliverySelectionStage === 'city') {
                    return `${baseMessage} Choose a destination city.`
                }
                if (gameSession.deliverySelectionStage === 'shipping') {
                    return `${baseMessage} Choose shipping.`
                }

                return baseMessage
            }
            case MachineState.CityGrowth: {
                if (gameSession.validActionTypes.includes(ActionType.GrowCity)) {
                    return 'Choose a highlighted city to grow.'
                }
                return 'Resolving city growth.'
            }
            case MachineState.EndOfGame:
                return 'Game over.'
            default:
                return 'Choose your next action.'
        }
    })

    function handleBidInput(event: Event): void {
        const target = event.currentTarget
        if (!(target instanceof HTMLInputElement)) {
            return
        }

        const digitsOnly = target.value.replace(/[^0-9]/g, '')
        if (digitsOnly.length === 0) {
            bidInput = '0'
            return
        }

        bidInput = digitsOnly.slice(0, 4).replace(/^0+(?=\d)/, '')
    }

    function handleBidBeforeInput(event: InputEvent): void {
        if (event.isComposing) {
            return
        }

        if (event.inputType.startsWith('insert') && event.data && /[^0-9]/.test(event.data)) {
            event.preventDefault()
        }
    }

    async function submitTurnOrderBid(event: SubmitEvent): Promise<void> {
        event.preventDefault()
        if (!canSubmitTurnOrderBid) {
            return
        }

        placingTurnOrderBid = true
        try {
            await gameSession.placeTurnOrderBid(bidAmount)
            bidInput = '0'
        } finally {
            placingTurnOrderBid = false
        }
    }

    async function submitChooseOperatingCompany(companyId: string): Promise<void> {
        if (!showOperatingCompanyPicker || choosingOperatingCompany) {
            return
        }

        choosingOperatingCompany = true
        try {
            await gameSession.chooseOperatingCompany(companyId)
        } finally {
            choosingOperatingCompany = false
        }
    }

    async function submitDeliveryShippingChoice(routeKey: string): Promise<void> {
        if (!showDeliveryShippingChoices || deliveringGood) {
            return
        }

        deliveringGood = true
        try {
            await gameSession.deliverGoodForRoute(routeKey)
        } finally {
            deliveringGood = false
        }
    }

    async function submitFinishOptionalProductionExpansion(): Promise<void> {
        if (!showOptionalProductionExpansionDoneButton || finishingOptionalProductionExpansion) {
            return
        }

        finishingOptionalProductionExpansion = true
        try {
            await gameSession.finishOptionalProductionExpansion()
        } finally {
            finishingOptionalProductionExpansion = false
        }
    }

</script>

<div
    class="action-panel flex min-h-[50px] items-center justify-center px-4 py-2 text-center text-[18px] tracking-[0.02em] text-[#333]"
>
    {#if showTurnOrderBidTracker}
        <div class="bid-tracker-panel">
            {#if showTurnOrderBidFormula}
                <form class="bid-formula" onsubmit={submitTurnOrderBid}>
                    <label class="sr-only" for="turn-order-bid-input">Turn order bid amount</label>
                    <span class="formula-equation">
                        <span class={`bid-slot ${bidInputInvalid ? 'is-invalid' : ''}`}>
                            <input
                                id="turn-order-bid-input"
                                class="bid-value-input indonesia-font"
                                type="text"
                                inputmode="numeric"
                                pattern="[0-9]*"
                                maxlength="4"
                                autocomplete="off"
                                spellcheck={false}
                                value={bidInput}
                                onbeforeinput={handleBidBeforeInput}
                                oninput={handleBidInput}
                            />
                        </span>
                        <span class="formula-token">x</span>
                        <span class="formula-number">{bidResearchMultiplier}</span>
                        <span class="formula-token">=</span>
                        <span class="formula-total">{multipliedBidAmount}</span>
                    </span>
                    <button type="submit" class="commit-bid" disabled={!canSubmitTurnOrderBid}>
                        {#if placingTurnOrderBid}
                            placing...
                        {:else}
                            place bid
                        {/if}
                    </button>
                </form>
            {:else}
                <span class="bid-tracker-message">{message}</span>
            {/if}

            {#if submittedTurnOrderBidEntries.length > 0}
                <div class="bid-tracker-columns" aria-label="Turn order bids">
                    {#each submittedTurnOrderBidEntries as entry (entry.playerId)}
                        <div class="bid-player-cell">
                            <PlayerName
                                playerId={entry.playerId}
                                capitalization="none"
                                additionalClasses="text-[11px] leading-none tracking-[0.02em]"
                            />
                        </div>
                        <div class="bid-value-cell">
                            <span class="bid-value-text">
                                <span class="bid-eq-number">{entry.turnOrderBid?.bid}</span>
                                <span class="bid-eq-token">x</span>
                                <span class="bid-eq-number">{entry.turnOrderBid?.multiplier}</span>
                                <span class="bid-eq-token">=</span>
                                <span class="bid-eq-total">{entry.turnOrderBid?.total}</span>
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {:else if showOperatingCompanyPicker}
        <div class="operating-company-panel">
            <span class="operating-company-message">{message}</span>
            <div class="operating-company-cards" aria-label="Operating companies">
                {#each ownedOperatingCompanies as companyEntry (companyEntry.company.id)}
                    <button
                        type="button"
                        class="operating-company-button"
                        disabled={choosingOperatingCompany}
                        onmouseenter={() => {
                            gameSession.setHoveredOperatingCompany(companyEntry.company.id)
                        }}
                        onmouseleave={() => {
                            gameSession.setHoveredOperatingCompany(undefined)
                        }}
                        onfocus={() => {
                            gameSession.setHoveredOperatingCompany(companyEntry.company.id)
                        }}
                        onblur={() => {
                            gameSession.setHoveredOperatingCompany(undefined)
                        }}
                        onclick={() => {
                            submitChooseOperatingCompany(companyEntry.company.id)
                        }}
                    >
                        <svg class="operating-company-card-svg" viewBox="0 0 126 78" aria-hidden="true">
                            <CompanyCard
                                company={companyEntry.company}
                                x={63}
                                y={39}
                                height={58}
                                cultivatedAreaCount={companyEntry.cultivatedAreaCount}
                                earnings={companyEntry.earnings}
                            />
                        </svg>
                    </button>
                {/each}
            </div>
        </div>
    {:else if showProductionOperationsPanel}
        <div class="production-delivery-panel">
            <span class="operating-company-message">{message}</span>
            {#if showDeliveryShippingChoices}
                <div class="delivery-shipping-choices" aria-label="Delivery shipping choices">
                    {#each gameSession.deliveryShippingChoices as choice (choice.routeKey)}
                        {@const markerVisual = shippingMarkerVisualForCompany(
                            choice.candidate.shippingCompanyId
                        )}
                        <div
                            class={`delivery-shipping-choice ${deliveringGood ? 'is-disabled' : ''}`}
                            role="button"
                            tabindex={deliveringGood ? -1 : 0}
                            aria-disabled={deliveringGood}
                            aria-label={`Deliver via shipping company ${choice.candidate.shippingCompanyId}`}
                            title={`${choice.candidate.shippingCompanyId}: ${choice.candidate.seaAreaIds.join(' -> ')}`}
                            onmouseenter={() => {
                                gameSession.setHoveredDeliveryRoute(choice.routeKey)
                            }}
                            onmouseleave={() => {
                                gameSession.setHoveredDeliveryRoute(undefined)
                            }}
                            onfocus={() => {
                                gameSession.setHoveredDeliveryRoute(choice.routeKey)
                            }}
                            onblur={() => {
                                gameSession.setHoveredDeliveryRoute(undefined)
                            }}
                            onclick={() => {
                                submitDeliveryShippingChoice(choice.routeKey)
                            }}
                            onkeydown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') {
                                    return
                                }
                                event.preventDefault()
                                submitDeliveryShippingChoice(choice.routeKey)
                            }}
                        >
                            <span class="delivery-route-icon-wrap" aria-hidden="true">
                                <svg
                                    class="delivery-route-icon-svg"
                                    viewBox="0 0 102 72"
                                    width="102"
                                    height="72"
                                >
                                    <ShipMarker
                                        x={51}
                                        y={36}
                                        style={markerVisual.style}
                                        height={54}
                                        outline={false}
                                        hullFillColor={markerVisual.hullFillColor}
                                        hullStrokeColor={markerVisual.hullStrokeColor}
                                        hullStrokeWidth={12}
                                    />
                                </svg>
                            </span>
                        </div>
                    {/each}
                </div>
            {/if}
            {#if showOptionalProductionExpansionDoneButton}
                <button
                    type="button"
                    class="finish-production-expansion"
                    disabled={finishingOptionalProductionExpansion}
                    onclick={submitFinishOptionalProductionExpansion}
                >
                    {#if finishingOptionalProductionExpansion}
                        finishing...
                    {:else}
                        done expanding
                    {/if}
                </button>
            {/if}
        </div>
    {:else}
        <span>{message}</span>
    {/if}
</div>

<style>
    .action-panel {
        background:
            radial-gradient(
                135% 185% at 12% 6%,
                rgba(248, 244, 240, 0.72),
                rgba(236, 228, 221, 0.82)
            ),
            repeating-linear-gradient(
                -30deg,
                rgba(128, 120, 111, 0.024) 0 2px,
                rgba(255, 255, 255, 0.02) 2px 7px
            ),
            #ede2dc;
        border: 1px solid rgba(154, 143, 130, 0.68);
        border-radius: 10px;
        margin: 5px 8px 7px;
        box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.52),
            inset 0 -1px 0 rgba(98, 68, 39, 0.2);
    }

    .bid-tracker-panel {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px 30px;
        padding: 0;
    }

    .operating-company-panel {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .production-delivery-panel {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .operating-company-message {
        font-size: 16px;
        line-height: 1.15;
        letter-spacing: 0.02em;
    }

    .operating-company-cards {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
    }

    .operating-company-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
        border-radius: 0;
        background: transparent;
        transition: opacity 140ms ease;
    }

    .operating-company-button:hover:enabled {
        opacity: 0.9;
    }

    .operating-company-button:disabled {
        opacity: 0.58;
        cursor: default;
    }

    .operating-company-card-svg {
        display: block;
        width: 126px;
        height: 78px;
    }

    .delivery-shipping-choices {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
    }

    .delivery-shipping-choice {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0;
        max-width: 100%;
        border: none;
        border-radius: 8px;
        background: transparent;
        padding: 2px 3px;
        transition: opacity 120ms ease;
        cursor: pointer;
    }

    .delivery-shipping-choice:hover,
    .delivery-shipping-choice:focus-visible {
        opacity: 0.9;
        outline: none;
    }

    .delivery-shipping-choice.is-disabled {
        opacity: 0.45;
        cursor: default;
    }

    .delivery-route-icon-wrap {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 102px;
        height: 72px;
        flex: 0 0 auto;
    }

    .delivery-route-icon-svg {
        display: block;
    }

    .bid-formula {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        justify-content: center;
        gap: 12px;
        white-space: nowrap;
    }

    .bid-tracker-message {
        font-size: 16px;
        letter-spacing: 0.02em;
    }

    .bid-tracker-columns {
        display: grid;
        grid-template-columns: max-content max-content;
        column-gap: 10px;
        row-gap: 2px;
        width: max-content;
        max-width: 100%;
    }

    .bid-player-cell {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        min-width: 0;
        text-align: right;
        padding-right: 0;
        white-space: nowrap;
    }

    .bid-player-cell :global(span) {
        display: inline-flex;
        align-items: center;
        line-height: 1;
        padding-left: 0.3rem;
        padding-right: 0.3rem;
    }

    .bid-value-cell {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        min-width: 0;
        text-align: right;
        font-size: 12px;
        line-height: 1;
        color: rgba(63, 46, 28, 0.9);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .bid-value-text {
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 2px;
        min-width: 0;
        line-height: 1;
    }

    .bid-eq-number,
    .bid-eq-total {
        min-width: 1ch;
        text-align: right;
    }

    .bid-eq-number {
        color: rgba(63, 46, 28, 0.6);
        font-weight: 400;
    }

    .bid-eq-token {
        color: rgba(63, 46, 28, 0.56);
        opacity: 0.9;
        font-size: 11px;
        font-weight: 400;
    }

    .bid-eq-total {
        font-weight: 600;
        color: rgba(63, 46, 28, 0.96);
    }

    .formula-equation {
        display: inline-flex;
        align-items: flex-end;
        gap: 12px;
        color: #3f2e1c;
        font-family: 'scriptina-pro', cursive;
        font-size: clamp(36px, 2.3vw + 22px, 56px);
        line-height: 0.8;
    }

    .bid-slot {
        position: relative;
        display: inline-flex;
        min-width: 4.4ch;
        padding: 0 0.24em 0.02em;
    }

    .bid-slot::after {
        content: '';
        position: absolute;
        left: 0.24em;
        right: 0.24em;
        bottom: 0.03em;
        border-bottom: 2.5px solid rgba(93, 68, 40, 0.78);
    }

    .bid-slot.is-invalid::after {
        border-bottom-color: rgba(151, 50, 37, 0.9);
    }

    .bid-value-input {
        width: 4.4ch;
        margin: 0;
        padding: 0.02em 0.1em 0;
        border: none;
        background: transparent;
        appearance: none;
        -webkit-appearance: none;
        border-radius: 0;
        box-sizing: content-box;
        overflow: visible;
        text-align: center;
        line-height: 0.7;
        height: 0.82em;
        color: #352312;
        font-size: 0.74em;
        letter-spacing: 0.02em;
        font-variant-numeric: tabular-nums;
    }

    .bid-value-input:focus {
        outline: none;
        box-shadow: none;
    }

    .bid-value-input:focus-visible {
        outline: none;
        box-shadow: none;
    }

    .formula-token {
        padding-bottom: 0.08em;
        opacity: 0.8;
        font-size: 0.68em;
    }

    .formula-number,
    .formula-total {
        min-width: 1.7ch;
        font-size: 0.74em;
        text-align: center;
        font-variant-numeric: tabular-nums;
    }

    .formula-total {
        min-width: 2.6ch;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0.86;
        padding: 0.25em 0.45em 0.04em 0.34em;
        border-radius: 999px;
        background: rgba(114, 84, 47, 0.14);
    }

    .commit-bid {
        border: 1px solid rgba(96, 71, 43, 0.44);
        border-radius: 999px;
        background: linear-gradient(
            180deg,
            rgba(250, 241, 220, 0.86),
            rgba(219, 198, 163, 0.78)
        );
        color: #3d2d1d;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 12px;
        padding: 7px 12px 6px;
        transition: background 140ms ease, opacity 140ms ease;
    }

    .commit-bid:hover:enabled {
        background: linear-gradient(
            180deg,
            rgba(255, 246, 226, 0.92),
            rgba(228, 208, 174, 0.82)
        );
    }

    .commit-bid:disabled {
        opacity: 0.45;
        cursor: default;
    }

    .finish-production-expansion {
        border: 1px solid rgba(96, 71, 43, 0.44);
        border-radius: 999px;
        background: linear-gradient(
            180deg,
            rgba(250, 241, 220, 0.86),
            rgba(219, 198, 163, 0.78)
        );
        color: #3d2d1d;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 12px;
        padding: 7px 12px 6px;
        transition: background 140ms ease, opacity 140ms ease;
    }

    .finish-production-expansion:hover:enabled {
        background: linear-gradient(
            180deg,
            rgba(255, 246, 226, 0.92),
            rgba(228, 208, 174, 0.82)
        );
    }

    .finish-production-expansion:disabled {
        opacity: 0.45;
        cursor: default;
    }

    @media (max-width: 980px) {
        .bid-formula {
            gap: 12px;
        }

        .formula-equation {
            font-size: clamp(30px, 2vw + 18px, 48px);
        }
    }
</style>
