<script lang="ts">
    import type { ActionCard } from '@tabletop/magna-grecia'
    import { actionAllowances } from '$lib/utils/actionAllowances.js'
    import AllowanceIcon from './icons/AllowanceIcon.svelte'

    let { card, label, size }: { card: ActionCard; label: string; size: number } = $props()

    const allowances = $derived(actionAllowances(card))
</script>

<ul class="allowances" style:--size="{size}px" aria-label={label}>
    {#each allowances as allowance (allowance.kind)}
        <li title="{allowance.label}: {allowance.basic}, or {allowance.enhanced} enhanced">
            <AllowanceIcon kind={allowance.kind} {size} />
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
        gap: calc(var(--size) * 0.55);
        margin: 0;
        padding: 0;
        list-style: none;
        font-family: 'Libre Baskerville', Georgia, serif;
    }

    .allowances li {
        display: flex;
        align-items: center;
        gap: calc(var(--size) * 0.15);
    }

    .basic {
        font-size: var(--size);
        font-weight: 700;
        line-height: 1;
    }

    .bonus {
        margin-left: 2px;
        font-size: calc(var(--size) / 2);
        vertical-align: 0.7em;
    }
</style>
