<script lang="ts">
    import { ActionType, MachineState, TradeOption } from '@tabletop/oath'
    import ActionGrid from '$lib/components/ActionGrid.svelte'
    import SearchPanel from '$lib/components/SearchPanel.svelte'
    import CampaignPanel from '$lib/components/CampaignPanel.svelte'
    import CampaignBattlePanel from '$lib/components/CampaignBattlePanel.svelte'
    import CampaignDice from '$lib/components/CampaignDice.svelte'
    import CampaignPlansPanel from '$lib/components/CampaignPlansPanel.svelte'
    import AttackPlansPanel from '$lib/components/AttackPlansPanel.svelte'
    import MinorActionPanel from '$lib/components/MinorActionPanel.svelte'
    import ModifierPicker from '$lib/components/ModifierPicker.svelte'
    import PowerPanel from '$lib/components/PowerPanel.svelte'
    import BannerRecoverPanel from '$lib/components/BannerRecoverPanel.svelte'
    import TravelWayPanel from '$lib/components/TravelWayPanel.svelte'
    import CitizenshipPanel from '$lib/components/CitizenshipPanel.svelte'
    import ConsentPanel from '$lib/components/ConsentPanel.svelte'
    import QuestionPanel from '$lib/components/QuestionPanel.svelte'
    import OathkeeperPanel from '$lib/components/OathkeeperPanel.svelte'
    import SetupPanel from '$lib/components/SetupPanel.svelte'
    import WakePanel from '$lib/components/WakePanel.svelte'
    import RestPanel from '$lib/components/RestPanel.svelte'
    import ActorOnlyNotice from '$lib/components/ActorOnlyNotice.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { humanizeReason } from '$lib/model/names.js'
    import {
        MINOR_TARGETED_ACTIONS,
        MODIFIABLE_ACTIONS,
        actionPrompt
    } from '$lib/model/actionCatalogue.js'

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let isMyTurn = $derived(gameSession.isMyTurn)
    let busy = $derived(gameSession.busy)

    let selection = $derived(gameSession.selection)
    let chosen = $derived(selection.action)

    let prompt = $derived(
        chosen === undefined
            ? undefined
            : actionPrompt(chosen, {
                  cardChosen: selection.value('card') !== undefined,
                  adviserChosen: gameSession.adviserCardId !== undefined,
                  moveChosen: gameSession.warbandMoves.chosen !== undefined
              })
    )

    // R-5.3.2 — both options are offered only when the card allows both.
    let tradeOptions = $derived.by(() => {
        const cardId = selection.value('card')
        if (chosen !== ActionType.Trade || cardId === undefined) return []
        return gameSession.tradeOptionsFor(cardId)
    })

    const TRADE_LABELS: Record<TradeOption, string> = {
        [TradeOption.ForFavor]: 'Place a secret, gain favor',
        [TradeOption.ForSecrets]: 'Place two favor, gain secrets'
    }

    let inActPhase = $derived(gameState.machineState === MachineState.ActPhase)
    let wakeNeedsDecision = $derived(gameSession.wakeNeedsDecision)
</script>

<div class="panel rounded-lg bg-stone-900/70 border border-stone-700 px-3 py-2 text-stone-100">
    <ActorOnlyNotice />
    {#if gameState.campaign}
        <CampaignDice campaign={gameState.campaign} />
    {/if}
    <!-- Interrupt states come first: the clock is usually on a player whose turn it is not. -->
    {#if gameSession.campaign.open}
        <div class="mb-2">
            <CampaignPanel />
        </div>
        <button
            disabled={busy}
            class="mb-2 w-full rounded bg-stone-700 hover:bg-stone-600 px-2 py-1 text-xs"
            onclick={() => gameSession.resetAction()}
        >
            {gameSession.sneakAttackDefenderId ? 'Back to the question' : 'Cancel the Campaign'}
        </button>
    {:else if gameState.machineState === MachineState.ConsentRequest}
        <ConsentPanel />
    {:else if gameState.machineState === MachineState.PowerQuestion}
        <QuestionPanel />
    {:else if gameState.machineState === MachineState.OathkeeperChoice}
        <OathkeeperPanel />
    {:else if gameState.machineState === MachineState.CampaignPlans}
        {#if gameSession.attackPlans.attackerId !== undefined}
            <AttackPlansPanel />
        {:else}
            <CampaignPlansPanel />
        {/if}
    {:else if !isMyTurn}
        <p class="text-sm text-stone-400">Waiting for another player.</p>
    {:else if gameState.machineState === MachineState.CampaignSacrifice || gameState.machineState === MachineState.CampaignDefeat || gameState.machineState === MachineState.CampaignVictory}
        <CampaignBattlePanel />
    {:else if gameState.machineState === MachineState.Searching}
        <SearchPanel />
    {:else if gameState.machineState === MachineState.Setup}
        <SetupPanel />
    {:else if gameState.machineState === MachineState.WakePhase}
        {#if wakeNeedsDecision}
            <WakePanel />
        {:else}
            <p class="text-sm text-stone-400">Starting the turn.</p>
        {/if}
    {:else if gameState.machineState === MachineState.RestPhase}
        <RestPanel />
    {:else if !inActPhase}
        <p class="text-sm text-stone-300">
            Nothing to choose here — no panel is wired for {gameState.machineState}.
        </p>
    {:else}
        {#if chosen === ActionType.OfferCitizenship}
            <div class="mb-2">
                <CitizenshipPanel />
            </div>
            <button
                disabled={busy}
                class="mb-2 w-full rounded bg-stone-700 hover:bg-stone-600 px-2 py-1 text-xs"
                onclick={() => gameSession.resetAction()}
            >
                Cancel the offer
            </button>
        {:else if chosen}
            <!-- docs/user-interactions.md — `Back` unwinds local selection only. -->
            <div
                class="mb-2 rounded bg-amber-950/40 px-2 py-1.5
                       flex items-center justify-between gap-2"
            >
                <span class="text-sm">{prompt}</span>
                <button
                    disabled={busy}
                    class="shrink-0 rounded bg-stone-700 hover:bg-stone-600 px-2 py-1
                           text-xs font-semibold"
                    onclick={() => gameSession.back()}
                >
                    Back
                </button>
            </div>

            {#if MODIFIABLE_ACTIONS.has(chosen)}
                <ModifierPicker action={chosen} />
            {/if}

            {#if MINOR_TARGETED_ACTIONS.has(chosen)}
                <div class="mb-2">
                    <MinorActionPanel action={chosen} />
                </div>
            {/if}

            {#if chosen === ActionType.Travel && gameSession.shroudedWoodChooser}
                {@const woodReason = gameSession.woodTravelReason}
                <div class="mb-2 text-sm">
                    <p class="mb-1">
                        An enemy rules this Shrouded Wood: {gameSession.getPlayerName(
                            gameSession.shroudedWoodChooser
                        )} chooses where you go.
                    </p>
                    {#if woodReason}
                        <p class="text-[11px] text-rose-300">{humanizeReason(woodReason)}</p>
                    {/if}
                    <button
                        class="rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 px-2 py-1 text-xs"
                        disabled={busy || !!woodReason}
                        onclick={() => gameSession.travelFromShroudedWood()}
                    >
                        Travel for 2 Supply
                    </button>
                </div>
            {/if}

            {#if chosen === ActionType.Travel && gameSession.travelChoices.length > 0}
                <div class="mb-2">
                    <TravelWayPanel />
                </div>
            {/if}

            {#if chosen === ActionType.Recover && gameSession.stagedBanner}
                <div class="mb-2">
                    <BannerRecoverPanel />
                </div>
            {/if}

            {#if chosen === ActionType.UseActionPower}
                <div class="mb-2">
                    <PowerPanel />
                </div>
            {/if}

            {#if tradeOptions.length > 1}
                <div class="mb-2 flex flex-col gap-1">
                    {#each tradeOptions as option (option)}
                        <button
                            class="rounded border border-amber-500/40 bg-stone-800/60
                                   hover:border-amber-300 px-2 py-1 text-sm text-left"
                            disabled={busy}
                            onclick={() => gameSession.chooseTradeOption(option)}
                        >
                            {TRADE_LABELS[option]}
                        </button>
                    {/each}
                </div>
            {/if}
        {/if}

        {#if !chosen}
            <ActionGrid />
        {/if}
    {/if}
</div>

<style>
    /* A phone held sideways: `ActionGrid` sets its strip into this panel's header. */
    @media (max-height: 520px) and (orientation: landscape) {
        .panel {
            position: relative;
        }
    }
</style>
