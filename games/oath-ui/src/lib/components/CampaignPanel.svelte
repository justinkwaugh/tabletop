<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import {
        CampaignTargetKind,
        CardKind,
        type CampaignDefender,
        type CampaignTarget,
        powerKey
    } from '@tabletop/oath'
    import MenuToggleRow from '$lib/components/MenuToggleRow.svelte'
    import type { MenuPointerTarget } from '$lib/model/menuPointer.svelte.js'
    import { cardBack, cardImage } from '$lib/images/cardImages.js'
    import { pawnImage } from '$lib/images/pieceImages.js'
    import { bannerImage } from '$lib/images/tileImages.js'
    import AttackDiceRow from '$lib/components/AttackDiceRow.svelte'
    import CardChoiceRow from '$lib/components/CardChoiceRow.svelte'
    import PowerChoicePicker from '$lib/components/PowerChoicePicker.svelte'
    import { powerUseCards } from '$lib/model/cardChoice.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { powerUseKey } from '$lib/model/powerUse.js'
    import {
        campaignTargetText,
        cardName,
        regionName,
        relicSiteName,
        siteName
    } from '$lib/model/names.js'

    // The draft lives on the session, because the board's site layer toggles targets.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let draft = $derived(gameSession.campaign)
    let defender = $derived(draft.defender)
    let busy = $derived(gameSession.busy)

    function defenderLabel(candidate: CampaignDefender): string {
        return candidate.kind === 'bandits'
            ? 'The bandits'
            : gameSession.getPlayerName(candidate.playerId)
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
    let shownTargets = $derived(
        draft.targetOptions.filter(
            (target) => draft.hasTarget(target) || draft.canToggleTarget(target)
        )
    )
    let targetGroups = $derived.by(() => {
        const name = defender ? defenderLabel(defender) : ''
        const groups = [
            {
                heading:
                    defender?.kind === 'bandits' ? 'Sites the bandits hold' : `Sites ${name} rules`,
                kinds: [CampaignTargetKind.Site]
            },
            {
                heading: 'Relics and banners',
                kinds: [
                    CampaignTargetKind.Relic,
                    CampaignTargetKind.Banner,
                    CampaignTargetKind.SiteRelic
                ]
            },
            { heading: name, kinds: [CampaignTargetKind.PawnAndFavor] }
        ]
        return groups
            .map((group) => ({
                heading: group.heading,
                targets: shownTargets.filter((t) => group.kinds.includes(t.kind))
            }))
            .filter((group) => group.targets.length > 0)
    })
</script>

<div>
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading mb-2">
        Campaign
        <span class="ml-2 normal-case tracking-normal text-oath-accent">
            {draft.supplyCost === 0 ? 'no Supply' : `${draft.supplyCost} Supply`}
        </span>
    </h3>

    {#if !defender}
        <p class="text-sm mb-1">Choose who you are attacking.</p>
        <div class="flex flex-col gap-1">
            {#each draft.defenderOptions as candidate (defenderLabel(candidate))}
                <button
                    class="rounded border border-oath-frame bg-oath-surface-raised
                           hover:border-oath-accent disabled:opacity-40 px-2 py-1 text-sm text-left"
                    disabled={busy}
                    onclick={() => draft.chooseDefender(candidate)}
                >
                    {defenderLabel(candidate)}
                </button>
            {/each}
        </div>
    {:else}
        {#if draft.defenderFixed && defender.kind === 'player'}
            <p class="text-sm mb-1">
                Sneak Attack: the defender is {gameSession.getPlayerName(defender.playerId)}.
            </p>
        {/if}
        <p class="text-sm mb-1">Tap a target to add it, and again to drop it.</p>
        <div class="mb-2 flex flex-col gap-1.5">
            {#each targetGroups as group (group.heading)}
                <h4
                    class="mt-1 text-[11px] font-semibold uppercase tracking-widest text-oath-heading"
                >
                    {group.heading}
                </h4>
                {#each group.targets as target (JSON.stringify(target))}
                    <MenuToggleRow
                        image={targetImage(target)}
                        name={targetLabel(target)}
                        detail={targetDetail(target)}
                        tag="target"
                        shape={target.kind === CampaignTargetKind.Site ||
                        target.kind === CampaignTargetKind.Banner
                            ? 'wide'
                            : target.kind === CampaignTargetKind.PawnAndFavor
                              ? 'piece'
                              : 'relic'}
                        on={draft.hasTarget(target)}
                        points={targetPoints(target)}
                        disabled={busy}
                        onclick={() => draft.toggleTarget(target)}
                    />
                {/each}
            {/each}
        </div>

        <div class="mb-2 text-sm">
            <div class="mb-1">Attack dice — tap to set the pool</div>
            <AttackDiceRow />
        </div>

        {#if draft.lossSources.length > 1}
            <!-- R-5.5.5, R-10.22 — the attacker chooses where the skulls' kills come from. -->
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1 text-oath-text-muted">
                    Skulls kill your warbands from, in order:
                </div>
                {#each draft.lossOrder as source, index (JSON.stringify(source))}
                    <div class="flex items-center gap-2 mb-0.5">
                        <span class="grow"
                            >{gameSession.warbandOwnerName(source.owner)}
                            {source.at.kind === 'board'
                                ? 'on your board'
                                : `at ${siteName(gameState, source.at.siteId)}`}</span
                        >
                        {#if index > 0}
                            <button
                                type="button"
                                class="rounded bg-oath-control hover:bg-oath-control-hover px-2 py-0.5"
                                disabled={busy}
                                onclick={() => draft.moveLossSourceUp(index)}
                            >
                                ↑
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}

        {#if draft.plansWaitForAllies}
            <p class="mb-2 text-[11px] text-oath-text-muted">
                A Citizen may join the defence, so your battle plans are chosen after they answer.
            </p>
        {/if}
        {#if draft.planOptions.length > 0}
            <div class="mb-2 border-t border-oath-divider pt-1.5 text-xs">
                <div class="mb-1 text-oath-text-muted">Battle plans to use:</div>
                <CardChoiceRow
                    choices={powerUseCards(draft.planOptions)}
                    picked={draft.planOptions
                        .filter((power) => draft.isPlanDeclared(powerUseKey(power)))
                        .map((power) => powerKey(power.cardId, power.powerIndex))}
                    onpick={(key) => {
                        const power = draft.planOptions.find(
                            (p) => powerKey(p.cardId, p.powerIndex) === key
                        )
                        if (power) {
                            const use = powerUseKey(power)
                            draft.declarePlan(use, !draft.isPlanDeclared(use))
                        }
                    }}
                    {busy}
                    height={90}
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
                            />
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}

        {#if draft.blockedBecause}
            <p class="mb-2 text-[11px] text-oath-danger">
                <TokenText text={gameSession.humanizeReason(draft.blockedBecause) ?? ''} />
            </p>
        {/if}

        <div class="flex gap-2">
            <button
                class="grow rounded bg-oath-primary text-oath-primary-text hover:bg-oath-primary-hover disabled:opacity-40
                       border-[1.5px] border-oath-primary-border px-2 py-1.5 text-sm font-semibold"
                disabled={busy || !draft.declarable}
                onclick={() => draft.declare()}
            >
                Declare the Campaign
            </button>
        </div>
    {/if}
</div>
