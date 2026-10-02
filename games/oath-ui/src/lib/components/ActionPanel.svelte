<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { ActionType, MachineState } from '@tabletop/oath'
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
    import MusterMenu from '$lib/components/MusterMenu.svelte'
    import RecoverMenu from '$lib/components/RecoverMenu.svelte'
    import SearchMenu from '$lib/components/SearchMenu.svelte'
    import TradeMenu from '$lib/components/TradeMenu.svelte'
    import TravelMenu from '$lib/components/TravelMenu.svelte'
    import BannerRecoverPanel from '$lib/components/BannerRecoverPanel.svelte'
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
                  adviserChosen: gameSession.adviserCardId !== undefined
              })
    )

    let inActPhase = $derived(gameState.machineState === MachineState.ActPhase)
    let wakeNeedsDecision = $derived(gameSession.wakeNeedsDecision)
</script>

<div class="panel rounded-lg bg-oath-surface border border-oath-frame px-3 py-2 text-oath-text">
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
            class="mb-2 w-full rounded bg-oath-control hover:bg-oath-control-hover px-2 py-1 text-xs"
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
        <p class="text-sm text-oath-text-muted">Waiting for another player.</p>
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
            <p class="text-sm text-oath-text-muted">Starting the turn.</p>
        {/if}
    {:else if gameState.machineState === MachineState.RestPhase}
        <RestPanel />
    {:else if !inActPhase}
        <p class="text-sm text-oath-text-muted">
            Nothing to choose here — no panel is wired for {gameState.machineState}.
        </p>
    {:else}
        {#if chosen === ActionType.OfferCitizenship}
            <div class="mb-2">
                <CitizenshipPanel />
            </div>
            <button
                disabled={busy}
                class="mb-2 w-full rounded bg-oath-control hover:bg-oath-control-hover px-2 py-1 text-xs"
                onclick={() => gameSession.resetAction()}
            >
                Cancel the offer
            </button>
        {:else if chosen}
            <!-- docs/user-interactions.md — `Back` unwinds local selection only. -->
            <div
                class="mb-2 rounded bg-oath-accent-soft px-2 py-1.5
                       flex items-center justify-between gap-2"
            >
                <span class="text-sm"><TokenText text={prompt ?? ''} /></span>
                <button
                    disabled={busy}
                    class="shrink-0 rounded bg-oath-control hover:bg-oath-control-hover px-2 py-1
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
                        <p class="text-[11px] text-oath-danger">
                            <TokenText text={humanizeReason(woodReason) ?? ''} />
                        </p>
                    {/if}
                    <button
                        class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40 px-2 py-1 text-xs"
                        disabled={busy || !!woodReason}
                        onclick={() => gameSession.travelFromShroudedWood()}
                    >
                        Travel for 2 Supply
                    </button>
                </div>
            {/if}

            {#if chosen === ActionType.Travel && gameSession.travelRows.length > 0}
                <div class="mb-2">
                    <TravelMenu />
                </div>
            {/if}

            {#if chosen === ActionType.Recover && !gameSession.stagedBanner}
                <div class="mb-2">
                    <RecoverMenu />
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

            {#if chosen === ActionType.Search}
                <div class="mb-2">
                    <SearchMenu />
                </div>
            {/if}

            {#if chosen === ActionType.Muster}
                <div class="mb-2">
                    <MusterMenu />
                </div>
            {/if}

            {#if chosen === ActionType.Trade}
                <div class="mb-2">
                    <TradeMenu />
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
