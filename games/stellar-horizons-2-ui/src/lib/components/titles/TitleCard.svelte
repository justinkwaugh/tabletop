<script lang="ts">
    import { TITLE_POINTS, titleDefinition, type TitleId } from '@tabletop/stellar-horizons-2'

    // A title as printed: its name, what it does, its prerequisite, its 10 points and its cost
    // in IP (rulebook 5.2). A title the viewer can buy offers Buy; one they own, Renounce.
    let {
        titleId,
        cost,
        note,
        renounceLabel = 'Renounce',
        onbuy,
        onrenounce
    }: {
        titleId: TitleId
        cost?: number
        note?: string
        renounceLabel?: string
        onbuy?: () => void
        onrenounce?: () => void
    } = $props()

    const title = $derived(titleDefinition(titleId))
</script>

<div class="title" role="group" aria-label={title.name}>
    <span class="name">{title.name}</span>
    <span class="effect">{title.text}</span>
    <span class="label">Prerequisite</span>
    <span class="prerequisite">{title.prerequisiteText}</span>
    <span class="foot">
        <span class="points" title="{TITLE_POINTS} VP">{TITLE_POINTS}</span>
        <span class="cost">{cost ?? title.cost} IP</span>
    </span>
    {#if note}<span class="note">{note}</span>{/if}
    {#if onbuy}
        <button type="button" class="act" onclick={onbuy}>Buy · {cost ?? title.cost} IP</button>
    {:else if onrenounce}
        <button type="button" class="act renounce" onclick={onrenounce}>{renounceLabel}</button>
    {/if}
</div>

<style>
    .title {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        width: 136px;
        box-sizing: border-box;
        padding: 7px 7px 8px;
        border: 1px solid #8a6a22;
        border-radius: 6px;
        background: #d8b964;
        color: #14244a;
        text-align: center;
    }

    .name {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .effect,
    .prerequisite {
        font-size: 11px;
        line-height: 1.25;
    }

    .label {
        margin-top: 2px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #7a1f1f;
    }

    .foot {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
    }

    .points {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #b8892a;
        color: #1b1405;
        font-size: 12px;
        font-weight: 800;
    }

    .cost {
        padding: 1px 6px;
        border-radius: 3px;
        background: #111;
        color: #e05fc4;
        font-size: 11px;
        font-weight: 800;
    }

    .note {
        font-size: 11px;
        color: #3a3020;
    }

    .act {
        margin-top: 3px;
        padding: 3px 10px;
        border: 1px solid #14244a;
        border-radius: 999px;
        background: #14244a;
        color: #f3e6c0;
        font-size: 12px;
        font-weight: 700;
    }

    .act.renounce {
        background: transparent;
        color: #14244a;
    }
</style>
