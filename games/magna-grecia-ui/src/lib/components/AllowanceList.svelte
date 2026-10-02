<script lang="ts">
    import type { ActionCard } from '@tabletop/magna-grecia'
    import { actionAllowances } from '$lib/utils/actionAllowances.js'
    import AllowanceIcon from './icons/AllowanceIcon.svelte'

    let {
        card,
        label,
        compact = false
    }: { card: ActionCard; label: string; compact?: boolean } = $props()

    const allowances = $derived(actionAllowances(card))
</script>

<ul class="allowances" class:compact aria-label={label}>
    {#each allowances as allowance (allowance.kind)}
        <li title="{allowance.label}: {allowance.basic}, or {allowance.enhanced} enhanced">
            <AllowanceIcon kind={allowance.kind} size={compact ? 30 : 40} />
            <span class="basic"
                >{allowance.basic}<sup class="bonus">+{allowance.enhanced - allowance.basic}</sup
                ></span
            >
        </li>
    {/each}
</ul>

<style>
    .allowances {
        display: flex;
        align-items: center;
        gap: 22px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .allowances li {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .basic {
        font-size: 40px;
        font-weight: 700;
        line-height: 1;
    }

    .bonus {
        margin-left: 2px;
        font-size: 20px;
        vertical-align: 0.7em;
    }

    .compact {
        gap: 18px;
    }

    .compact li {
        gap: 5px;
    }

    .compact .basic {
        font-size: 30px;
    }

    .compact .bonus {
        font-size: 15px;
    }
</style>
