<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { ActionType, MachineState } from '@tabletop/oath'
    import ActionGrid from '$lib/components/ActionGrid.svelte'
    import SearchPanel from '$lib/components/SearchPanel.svelte'
    import CampaignPanel from '$lib/components/CampaignPanel.svelte'
    import CampaignBattlePanel from '$lib/components/CampaignBattlePanel.svelte'
    import WentHomeLine from '$lib/components/WentHomeLine.svelte'
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
    import TravelWays from '$lib/components/TravelWays.svelte'
    import WoodTravelPanel from '$lib/components/WoodTravelPanel.svelte'
    import BannerRecoverPanel from '$lib/components/BannerRecoverPanel.svelte'
    import CitizenshipPanel from '$lib/components/CitizenshipPanel.svelte'
    import ConsentPanel from '$lib/components/ConsentPanel.svelte'
    import QuestionPanel from '$lib/components/QuestionPanel.svelte'
    import OathkeeperPanel from '$lib/components/OathkeeperPanel.svelte'
    import SetupPanel from '$lib/components/SetupPanel.svelte'
    import WakePanel from '$lib/components/WakePanel.svelte'
    import RestPanel from '$lib/components/RestPanel.svelte'
    import EndOfRoundPanel from '$lib/components/EndOfRoundPanel.svelte'
    import WaitingOn from '$lib/components/WaitingOn.svelte'
    import ActorOnlyNotice from '$lib/components/ActorOnlyNotice.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import {
        MINOR_TARGETED_ACTIONS,
        MODIFIABLE_ACTIONS,
        TRAVEL_ON_THE_MAP_PROMPT,
        actionName
    } from '$lib/model/actionCatalogue.js'

    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let isMyTurn = $derived(gameSession.isMyTurn)
    let busy = $derived(gameSession.busy)

    let selection = $derived(gameSession.selection)
    let chosen = $derived(selection.action)

    // Travel picks on the lit map at every width: the panel keeps one line, or the picked site's
    // ways, laid out for the phone held upright or for a wider panel.
    const layout = new PhoneLayout()
    let travelOnMap = $derived(chosen === ActionType.Travel && gameSession.travelRows.length > 0)
    let travelWaysOpen = $derived(travelOnMap ? gameSession.travelWaysOpen : undefined)

    // R-5.5.5 to R-5.5.7 — the attacker's steps after the roll, and the defending side's losses.
    const BATTLE_STEPS: ReadonlySet<string> = new Set([
        MachineState.CampaignSkullLosses,
        MachineState.CampaignSacrifice,
        MachineState.CampaignDefeat,
        MachineState.CampaignVictory
    ])

    let inActPhase = $derived(gameState.machineState === MachineState.ActPhase)
    let wakeNeedsDecision = $derived(gameSession.wakeNeedsDecision)
</script>

{#snippet chosenAction(action: ActionType)}
    {#if travelWaysOpen}
        <div class="mb-2">
            <TravelWays row={travelWaysOpen} upright={layout.upright} />
        </div>
    {:else}
        <div class="mb-2 rounded bg-oath-accent-soft px-2 py-1.5">
            <span class="text-sm"
                >{travelOnMap ? TRAVEL_ON_THE_MAP_PROMPT : actionName(action)}</span
            >
        </div>
    {/if}

    {#if MODIFIABLE_ACTIONS.has(action)}
        <ModifierPicker {action} />
    {/if}

    {#if MINOR_TARGETED_ACTIONS.has(action)}
        <div class="mb-2">
            <MinorActionPanel {action} />
        </div>
    {/if}

    {#if action === ActionType.Travel && gameSession.shroudedWoodChooser}
        <div class="mb-2">
            <WoodTravelPanel
                rulerId={gameSession.shroudedWoodChooser}
                regions={gameSession.woodRegions}
            />
        </div>
    {/if}

    {#if action === ActionType.Recover && !gameSession.stagedBanner}
        <div class="mb-2">
            <RecoverMenu />
        </div>
    {/if}

    {#if action === ActionType.Recover && gameSession.stagedBanner}
        <div class="mb-2">
            <BannerRecoverPanel />
        </div>
    {/if}

    {#if action === ActionType.UseActionPower}
        <div class="mb-2">
            <PowerPanel />
        </div>
    {/if}

    {#if action === ActionType.Search}
        <div class="mb-2">
            <SearchMenu />
        </div>
    {/if}

    {#if action === ActionType.Muster}
        <div class="mb-2">
            <MusterMenu />
        </div>
    {/if}

    {#if action === ActionType.Trade}
        <div class="mb-2">
            <TradeMenu />
        </div>
    {/if}
{/snippet}

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
    {:else if gameSession.travelOutOfTurnOpen}
        {@render chosenAction(ActionType.Travel)}
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
    {:else if gameState.machineState === MachineState.EndOfRound}
        <EndOfRoundPanel />
    {:else if !isMyTurn}
        <!-- R-5.5.6 — another seat reads where the defence went above whose turn it is. -->
        {#if gameState.machineState === MachineState.CampaignVictory}
            <WentHomeLine />
        {/if}
        <WaitingOn />
    {:else if BATTLE_STEPS.has(gameState.machineState)}
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
            <!-- Undo backs out of the offer one pick at a time, then puts the action down. -->
            <div class="mb-2">
                <CitizenshipPanel />
            </div>
        {:else if chosen}
            {@render chosenAction(chosen)}
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
