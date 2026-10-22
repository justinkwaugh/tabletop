<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import TokenText from '$lib/components/TokenText.svelte'
    import {
        CampaignTargetKind,
        CardKind,
        type CampaignDefender,
        type CampaignTarget,
        powerKey
    } from '@tabletop/oath'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import StepHeading from '$lib/components/StepHeading.svelte'
    import type { MenuPointerTarget } from '$lib/model/menuPointer.svelte.js'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { pawnImage } from '$lib/images/pieceImages.js'
    import { bannerImage } from '$lib/images/tileImages.js'
    import AttackDiceRow from '$lib/components/AttackDiceRow.svelte'
    import PlanRows from '$lib/components/PlanRows.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import type { CampaignStep } from '$lib/model/campaignDraft.js'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { PhoneLayout } from '$lib/model/phoneLayout.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { powerUseKey } from '$lib/model/powerUse.js'
    import {
        campaignTargetText,
        cardName,
        ownForcePlaceName,
        regionName,
        relicSiteName,
        siteName
    } from '$lib/model/names.js'
    import { pickerWords } from '$lib/model/powerPickerWords.js'

    // The draft lives on the session, because the board's site layer toggles targets.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let draft = $derived(gameSession.campaign)
    let defender = $derived(draft.defender)
    let busy = $derived(gameSession.busy)

    function defenderKey(candidate: CampaignDefender): string {
        return candidate.kind === 'bandits' ? 'bandits' : candidate.playerId
    }

    function targetLabel(target: CampaignTarget): string {
        const text = campaignTargetText(target, {
            site: (siteId) => siteName(gameState, siteId),
            relicSlot: (slotId) => relicSiteName(gameState, slotId)
        })
        return text.charAt(0).toUpperCase() + text.slice(1)
    }

    function targetImage(target: CampaignTarget): string {
        switch (target.kind) {
            case CampaignTargetKind.Site: {
                const cardId = gameState.isSiteFaceup(target.siteId)
                    ? gameState.siteCardAt(target.siteId)
                    : undefined
                return (cardId ? cardImage(cardId) : undefined) ?? cardBack(CardKind.Site)
            }
            case CampaignTargetKind.Relic:
                return cardImage(target.cardId) ?? cardBack(CardKind.Relic)
            case CampaignTargetKind.Banner:
                return bannerImage(target.banner, gameState.isOnMobSide(target.banner))
            case CampaignTargetKind.PawnAndFavor:
                return defender?.kind === 'player'
                    ? pawnImage(gameSession.colors.getPlayerColor(defender.playerId))
                    : cardBack(CardKind.Relic)
            case CampaignTargetKind.SiteRelic:
                return cardBack(CardKind.Relic)
        }
    }

    function targetPoints(target: CampaignTarget): MenuPointerTarget | undefined {
        switch (target.kind) {
            case CampaignTargetKind.Site:
                return { kind: 'site', slotId: target.siteId }
            case CampaignTargetKind.Banner:
                return { kind: 'banner', banner: target.banner }
            case CampaignTargetKind.SiteRelic:
                return { kind: 'relic', slotId: target.slotId }
            default:
                return undefined
        }
    }

    function targetDetail(target: CampaignTarget): string | undefined {
        if (target.kind === CampaignTargetKind.Site) {
            return regionName(gameState.regionOf(target.siteId))
        }
        return target.kind === CampaignTargetKind.SiteRelic ? '+1 die' : undefined
    }

    // R-5.5.2 — a target the rules refuse with what is chosen is not listed until it can be.
    let shownTargets = $derived(draft.targetOptions.filter((target) => draft.isOffered(target)))
    // The headings name the kinds; the line above them names the defender. A group's rows share
    // its widest row's width and wrap across the panel. On a phone held upright the Sites rows
    // are left out: the map lights the same sites and a tap there targets one (`BoardSitesLayer`).
    const layout = new PhoneLayout()
    const TARGET_GROUPS = [
        {
            heading: 'Sites',
            kinds: [CampaignTargetKind.Site],
            width: new ChoiceWidth(),
            onMapUpright: true
        },
        {
            heading: 'Relics and banners',
            kinds: [
                CampaignTargetKind.Relic,
                CampaignTargetKind.Banner,
                CampaignTargetKind.SiteRelic
            ],
            width: new ChoiceWidth()
        },
        {
            heading: 'Pawn and favor',
            kinds: [CampaignTargetKind.PawnAndFavor],
            width: new ChoiceWidth()
        }
    ]
    let targetGroups = $derived(
        TARGET_GROUPS.filter((group) => !(layout.upright && group.onMapUpright))
            .map((group) => ({
                ...group,
                targets: shownTargets.filter((t) => group.kinds.includes(t.kind))
            }))
            .filter((group) => group.targets.length > 0)
    )

    // R-5.5.2 then R-5.5.3 — the declaration one step at a time; Undo goes back a step.
    const STEP_HEADINGS: Record<CampaignStep, string> = {
        targets: 'Targets',
        dice: 'Attack dice',
        plans: 'Battle plans'
    }
    let step = $derived(draft.step)
    let refusedBecause = $derived(draft.stoppedBecause)
</script>

{#snippet confirm(label: string, onclick: () => void)}
    <button
        type="button"
        class="rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
               border-[1.5px] border-oath-primary-border px-3 py-1.5 text-sm font-semibold max-sm:min-h-11"
        disabled={busy}
        {onclick}
    >
        {label}
    </button>
{/snippet}

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">
        Campaign
        <span class="ml-2 normal-case tracking-normal text-oath-accent">
            {draft.supplyCost === 0 ? 'Free' : `${draft.supplyCost} Supply`}
        </span>
    </h3>

    {#if !defender}
        <p class="text-sm mb-1">Attack who?</p>
        <!-- One width for the choices, the widest one's; nothing stretched. -->
        <div class="grid w-max max-w-full gap-1">
            {#each draft.defenderOptions as candidate (defenderKey(candidate))}
                <button
                    type="button"
                    class="rounded-md border border-oath-frame bg-oath-surface px-3 py-1.5 text-[15px]
                           font-semibold hover:border-oath-accent hover:bg-oath-accent-soft
                           disabled:opacity-40 max-sm:min-h-11"
                    disabled={busy}
                    onclick={() => draft.chooseDefender(candidate)}
                >
                    {#if candidate.kind === 'player'}<PlayerName
                            playerId={candidate.playerId}
                        />{:else}The bandits{/if}
                </button>
            {/each}
        </div>
    {:else}
        <p class="text-sm mb-1">
            Against {#if defender.kind === 'player'}<PlayerName
                    playerId={defender.playerId}
                />{:else}the bandits{/if}.
        </p>
        {#if step}
            <StepHeading
                heading={STEP_HEADINGS[step]}
                step={draft.stepNumber}
                steps={draft.steps.length}
                level="h4"
            />
        {/if}

        {#if step === 'targets'}
            <div class="mb-2 flex flex-col gap-1.5">
                {#each targetGroups as group (group.heading)}
                    <h4
                        class="mt-1 text-[11px] font-semibold uppercase tracking-widest text-oath-heading"
                    >
                        {group.heading}
                    </h4>
                    <div class="flex flex-wrap gap-1.5">
                        {#each group.targets as target (JSON.stringify(target))}
                            {#if target.kind === CampaignTargetKind.PawnAndFavor && defender.kind === 'player'}
                                {@const defenderId = defender.playerId}
                                <MenuToggleRow
                                    image={targetImage(target)}
                                    tag="target"
                                    shape="piece"
                                    width={group.width}
                                    on={draft.hasTarget(target)}
                                    disabled={busy}
                                    onclick={() => draft.toggleTarget(target)}
                                >
                                    {#snippet name()}<PlayerName playerId={defenderId} />{/snippet}
                                </MenuToggleRow>
                            {:else}
                                <MenuToggleRow
                                    image={targetImage(target)}
                                    name={targetLabel(target)}
                                    detail={targetDetail(target)}
                                    tag="target"
                                    shape={target.kind === CampaignTargetKind.Site ||
                                    target.kind === CampaignTargetKind.Banner
                                        ? 'wide'
                                        : 'relic'}
                                    width={group.width}
                                    on={draft.hasTarget(target)}
                                    points={targetPoints(target)}
                                    disabled={busy}
                                    onclick={() => draft.toggleTarget(target)}
                                />
                            {/if}
                        {/each}
                    </div>
                {/each}
            </div>
        {:else if step === 'dice'}
            <div class="mb-2 text-sm">
                <AttackDiceRow />
            </div>

            {#if draft.lossSources.length > 1}
                <!-- R-5.5.5, R-10.22 — the attacker chooses where the skulls' kills come from. -->
                <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                    <div class="mb-1 text-oath-text-muted">Skull losses, in order:</div>
                    <!-- One width for the rows; the first keeps the ↑'s place so the rows line up. -->
                    <div
                        class="grid w-max max-w-full grid-cols-[minmax(0,auto)_auto] items-center gap-x-2 gap-y-0.5"
                    >
                        {#each draft.lossOrder as source, index (JSON.stringify(source))}
                            {@const where = ownForcePlaceName(
                                gameState,
                                source,
                                draft.lossOrder,
                                (owner) => gameSession.warbandOwnerName(owner)
                            )}
                            <span>{where}</span>
                            <button
                                type="button"
                                class="rounded bg-oath-control hover:bg-oath-control-hover px-2 py-0.5 max-sm:h-11 max-sm:w-11"
                                class:invisible={index === 0}
                                aria-label="Lose {where} sooner"
                                disabled={busy || index === 0}
                                onclick={() => draft.moveLossSourceUp(index)}
                            >
                                ↑
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        {:else if step === 'plans'}
            <div class="mb-2 text-xs">
                <PlanRows
                    plans={draft.planOptions}
                    isOn={(power) => draft.isPlanDeclared(powerUseKey(power))}
                    toggle={(power) => {
                        const use = powerUseKey(power)
                        draft.declarePlan(use, !draft.isPlanDeclared(use))
                    }}
                    {busy}
                />
                {#each draft.planOptions as power (powerKey(power.cardId, power.powerIndex))}
                    {@const use = powerUseKey(power)}
                    {@const choices = draft.planChoicesOf(power)}
                    {#if draft.isPlanDeclared(use) && choices.length > 0}
                        <div class="mt-1 mb-1">
                            <div class="text-oath-text-muted">{cardName(power.cardId)}:</div>
                            <PowerChoicePicker
                                {choices}
                                bind:picks={
                                    () => draft.planPicksOf(use),
                                    (picks) => draft.setPlanPicks(use, picks)
                                }
                                words={pickerWords(power.cardId)}
                            />
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}

        <!-- Next, or Declare on the last step, waits for the step's picks; the reason they are
             refused takes its place. -->
        <div class="flex flex-wrap items-center gap-2">
            {#if refusedBecause}
                <p class="text-[11px] text-oath-danger">
                    <TokenText text={gameSession.humanizeReason(refusedBecause) ?? ''} />
                </p>
            {:else if draft.nextShown}
                {@render confirm('Next', () => draft.next())}
            {:else if draft.declareShown}
                {@render confirm('Declare', () => draft.declare())}
            {/if}
        </div>
    {/if}
</div>
