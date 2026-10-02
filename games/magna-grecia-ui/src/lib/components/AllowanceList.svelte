<script lang="ts">
    import { MediaQuery } from 'svelte/reactivity'
    import type { ActionCard } from '@tabletop/magna-grecia'
    import { actionAllowances } from '$lib/utils/actionAllowances.js'
    import AllowanceIcon from './icons/AllowanceIcon.svelte'

    type BonusStyle = 'superscript' | 'parens' | 'parensOnPhone'

    let {
        card,
        label,
        size,
        bonusStyle = 'superscript'
    }: { card: ActionCard; label: string; size: number; bonusStyle?: BonusStyle } = $props()

    const phone = new MediaQuery('(max-width: 639px)')
    const allowances = $derived(actionAllowances(card))
    const parens = $derived(
        bonusStyle === 'parens' || (bonusStyle === 'parensOnPhone' && phone.current)
    )
</script>

<ul class="allowances" class:parens style:--size="{size}px" aria-label={label}>
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
        display: inline-flex;
        align-items: flex-start;
        font-size: var(--size);
        font-weight: 700;
        line-height: 1;
    }

    .bonus {
        top: 0;
        margin-left: 2px;
        font-size: calc(var(--size) / 2);
        line-height: 1;
        vertical-align: baseline;
    }

    .parens .basic {
        align-items: center;
    }

    .parens .bonus {
        margin: 0 0 0 2px;
        font-size: calc(var(--size) * 0.65);
    }

    .parens .bonus::before {
        content: '(';
    }

    .parens .bonus::after {
        content: ')';
    }
</style>
