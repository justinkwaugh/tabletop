<script lang="ts">
    import {
        ActionType,
        BID_RESEARCH_MULTIPLIERS,
        MachineState,
        PlaceTurnOrderBid
    } from '@tabletop/indonesia'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    const gameSession = getGameSession()
    let bidInput = $state('')
    let placingTurnOrderBid = $state(false)

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
                return 'Start a company.'
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
            const action = gameSession.createPlayerAction(PlaceTurnOrderBid, {
                type: ActionType.PlaceTurnOrderBid,
                amount: bidAmount
            })
            await gameSession.applyAction(action)
            bidInput = ''
        } finally {
            placingTurnOrderBid = false
        }
    }
</script>

<div
    class="action-panel flex min-h-[50px] items-center justify-center border-b border-[#c9ccd1] px-4 py-1 text-center text-[18px] tracking-[0.02em] text-[#333]"
>
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
        <span>{message}</span>
    {/if}
</div>

<style>
    .action-panel {
        background:
            radial-gradient(140% 180% at 12% 6%, rgba(248, 241, 225, 0.82), rgba(228, 214, 188, 0.82)),
            linear-gradient(175deg, rgba(255, 251, 240, 0.56), rgba(181, 159, 123, 0.2));
        box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.52),
            inset 0 -1px 0 rgba(98, 68, 39, 0.2);
    }

    .bid-formula {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 6px 0 8px;
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

    @media (max-width: 980px) {
        .bid-formula {
            gap: 12px;
        }

        .formula-equation {
            font-size: clamp(30px, 2vw + 18px, 48px);
        }
    }
</style>
