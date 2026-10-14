<script lang="ts">
    import SwelledRule from '$lib/components/SwelledRule.svelte'
    import {
        RetreatFate,
        type AssignedLossGroup,
        type RetreatPlan
    } from '$lib/model/retreatPlan.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import RetreatAccount from './RetreatAccount.svelte'

    let { plan }: { plan: RetreatPlan } = $props()

    const gameSession = getGameSession()

    const fought = $derived((gameSession.attack?.defendingUnitIds.length ?? 0) > 0)
    const total = $derived(plan.groups.reduce((sum, group) => sum + group.steps, 0))
    const account = $derived(
        plan.groups.map((group) => ({ text: reasonFor(group), steps: group.steps }))
    )
    const gunsLost = $derived(
        plan.units.filter((retreating) => retreating.fate === RetreatFate.GunsLost).length
    )

    let explaining = $state(false)

    // Rule 12: why each group of a retreat owes its steps, for the sheet that accounts for them.
    function reasonFor(group: AssignedLossGroup): string {
        const { map } = gameSession.gameState
        const [first] = group.unitIds.map((id) => gameSession.gameState.unit(id))
        const blocked = first?.position?.approach
        const width = (approachId: number) => (map.approach(approachId).wide ? 'wide' : 'narrow')
        if (blocked !== undefined) {
            return `Blocking the ${width(blocked)} approach to ${map.label(map.approach(blocked).neighbour)}`
        }
        const defended = gameSession.attack?.defenseApproach
        return [
            `Infantry in reserve${fought ? ' that did not defend' : ''}`,
            ...(defended === undefined ? [] : [`the approach attacked being ${width(defended)}`])
        ].join(', ')
    }
</script>

<div class="nt-retreat-cost">
    <SwelledRule>
        <button
            type="button"
            class="nt-retreat-cost-words"
            aria-haspopup="dialog"
            onclick={() => (explaining = true)}
        >
            <span>The retreat costs <b>{total} step{total === 1 ? '' : 's'}</b></span>
        </button>
    </SwelledRule>
</div>
{#if explaining}
    <RetreatAccount lines={account} {gunsLost} onclose={() => (explaining = false)} />
{/if}

<style>
    .nt-retreat-cost {
        max-width: 60ch;
        padding: 2px 0;
    }

    .nt-retreat-cost-words {
        font-size: 15px;
        font-style: italic;
        line-height: 1.2;
        white-space: nowrap;
        cursor: pointer;
    }

    .nt-retreat-cost-words span {
        text-decoration: underline dotted;
        text-decoration-thickness: 1px;
        text-underline-offset: 4px;
    }

    .nt-retreat-cost-words:hover span {
        text-decoration-style: solid;
    }

    b {
        font-style: normal;
    }

    @media (max-width: 639px) {
        .nt-retreat-cost-words {
            font-size: 13px;
        }
    }
</style>
