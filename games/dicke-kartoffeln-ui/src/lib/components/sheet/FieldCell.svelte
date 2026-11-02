<script lang="ts">
    import { PlanKind, VARIETIES, isOrganic, type Variety } from '@tabletop/dicke-kartoffeln'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { SheetField } from '$lib/utils/ledger.js'
    import { VARIETY_LETTERS } from '$lib/utils/tokens.js'
    import Stepper from './Stepper.svelte'

    let {
        fieldId,
        entry,
        own,
        editing,
        row = false
    }: {
        fieldId: number
        entry: SheetField | undefined
        own: boolean
        editing: boolean
        row?: boolean
    } = $props()

    const gameSession = getGameSession()

    const kind = $derived(editing ? gameSession.planKind : undefined)
    const targets = $derived(editing ? gameSession.fieldTargets : [])
    const field = $derived(
        editing
            ? gameSession.myPlayerState?.fields.find((candidate) => candidate.id === fieldId)
            : undefined
    )
    const pencilSeed = $derived(kind === PlanKind.Sow ? gameSession.sowing(fieldId) : undefined)
    const sealedSeed = $derived.by(() => {
        const plan = own ? gameSession.sealedPlan : undefined
        return plan?.kind === PlanKind.Sow
            ? plan.seeds.find((seed) => seed.fieldId === fieldId)?.variety
            : undefined
    })
    const seed = $derived(entry?.variety ?? sealedSeed)
    const sowable = $derived(kind === PlanKind.Sow && targets.includes(fieldId))

    const pencilFertilizer = $derived(kind === PlanKind.Fertilize && gameSession.marked(fieldId))
    const sealedFertilizer = $derived(
        own &&
            gameSession.sealedPlan?.kind === PlanKind.Fertilize &&
            gameSession.sealedPlan.fieldIds.includes(fieldId)
    )
    const fertilizable = $derived(kind === PlanKind.Fertilize && targets.includes(fieldId))

    const offering = $derived(kind === PlanKind.RegisterSales && targets.includes(fieldId))
    const offer = $derived(offering ? gameSession.offered(fieldId) : undefined)
    const sealedSale = $derived.by(() => {
        const plan = own ? gameSession.sealedPlan : undefined
        return plan?.kind === PlanKind.RegisterSales
            ? plan.sales.find((sale) => sale.fieldId === fieldId)
            : undefined
    })
    const sale = $derived(entry?.sale ?? sealedSale)
    const harvest = $derived(entry?.harvest)
    const sacks = $derived(field?.harvest ?? 0)
    const organic = $derived(field ? isOrganic(field) : false)

    function circle(variety: Variety) {
        if (!sowable) return
        gameSession.chooseSeed(fieldId, pencilSeed === variety ? undefined : variety)
    }
</script>

<div class="cell" class:row>
    <div class="letters">
        {#each VARIETIES as variety (variety)}
            <button
                type="button"
                class="letter"
                class:inked={seed === variety}
                class:pencil={pencilSeed === variety}
                class:choosable={sowable}
                disabled={!sowable}
                aria-label="{variety} on field {fieldId}"
                title={sowable ? `${variety}: ${gameSession.seedPrice(variety)} marks` : variety}
                onclick={() => circle(variety)}>{VARIETY_LETTERS[variety]}</button
            >
        {/each}
    </div>
    <div class="label">YIELD</div>
    <button
        type="button"
        class="yield"
        class:choosable={fertilizable}
        disabled={!fertilizable}
        aria-label="Fertilize field {fieldId}"
        title={fertilizable
            ? `Fertilize: ${gameSession.fertilizerFor(fieldId) * 100} marks`
            : undefined}
        onclick={() => gameSession.clickField(fieldId)}
    >
        {#if entry?.fertilized || sealedFertilizer}
            <span class="mark ink" class:struck={entry?.washedOut}>F</span>
        {:else if pencilFertilizer}
            <span class="mark pencil">F</span>
        {:else if fertilizable}
            <span class="mark hint">F?</span>
        {/if}
        {#if entry?.sprayed}
            <span class="mark ink small">P</span>
        {/if}
        {#if harvest}
            <span class="ink amount">
                {#if harvest.adjustment !== 0}
                    {harvest.chart}{harvest.adjustment > 0 ? '+' : '−'}{Math.abs(
                        harvest.adjustment
                    )}={harvest.sacks}
                {:else}
                    {harvest.sacks}
                {/if}
            </span>
        {/if}
    </button>
    <div class="sale">
        <span class="label">SALE</span>
        <div class="boxes">
            <div
                class="box"
                class:choosable={offer !== undefined}
                class:selling={(offer?.norm ?? 0) > 0}
            >
                <span class="tiny">NORM</span>
                {#if offer}
                    <Stepper
                        large={row}
                        value={offer.norm}
                        max={sacks - offer.bio}
                        onChange={(norm) => gameSession.offer(fieldId, norm, offer.bio)}
                    />
                {:else if sale}
                    <span class="ink amount">{sale.norm || ''}</span>
                {/if}
            </div>
            <div
                class="box bio"
                class:choosable={offer !== undefined && organic}
                class:selling={(offer?.bio ?? 0) > 0}
            >
                <span class="tiny">BIO</span>
                {#if offer && organic}
                    <Stepper
                        large={row}
                        value={offer.bio}
                        max={sacks - offer.norm}
                        onChange={(bio) => gameSession.offer(fieldId, offer.norm, bio)}
                    />
                {:else if sale}
                    <span class="ink amount">{sale.bio || ''}</span>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .cell {
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        height: 100%;
        border-right: 1.5px solid #1d1d1d;
    }

    .letters {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-bottom: 1.5px solid #1d1d1d;
    }

    .letter {
        position: relative;
        border-right: 1px solid #1d1d1d;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        font-size: 19px;
        line-height: 1.25;
        color: #1d1d1d;
    }

    .letter:last-child {
        border-right: none;
    }

    .letter.inked::after,
    .letter.pencil::after {
        content: '';
        position: absolute;
        inset: 1px 18%;
        border: 2.5px solid #1b3c8c;
        border-radius: 50%;
        transform: rotate(-8deg);
    }

    .letter.pencil::after {
        border-color: #8b8b8b;
        border-style: dashed;
    }

    .choosable {
        cursor: pointer;
        background: rgba(255, 228, 120, 0.35);
    }

    .choosable:hover {
        background: rgba(255, 210, 80, 0.55);
    }

    .label {
        padding: 1px 0 0 4px;
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        font-size: 10px;
        letter-spacing: 0.05em;
    }

    .yield {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 0;
    }

    .mark {
        font-family: 'Kartoffeln Pen', 'Comic Sans MS', cursive;
        font-size: 20px;
        font-weight: 700;
    }

    .mark.small {
        font-size: 14px;
    }

    .mark.struck {
        text-decoration: line-through;
        text-decoration-thickness: 2px;
    }

    .mark.hint {
        color: #9a8448;
        font-size: 15px;
    }

    .mark.pencil {
        color: #1f4fbf;
        text-shadow: 0 0 1px rgba(31, 79, 191, 0.5);
    }

    .ink {
        color: #1b3c8c;
    }

    .pencil {
        color: #7d7d7d;
    }

    .amount {
        font-family: 'Kartoffeln Pen', 'Comic Sans MS', cursive;
        font-size: 26px;
        font-weight: 700;
        line-height: 1;
    }

    .sale {
        border-top: 1.5px solid #1d1d1d;
        background: #1d1d1d;
    }

    .sale .label {
        color: #fffdf6;
        text-align: center;
    }

    .boxes {
        display: grid;
        grid-template-columns: 1fr 1fr;
        background: #fffdf6;
    }

    .box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        height: 34px;
        overflow: hidden;
    }

    .box.choosable {
        cursor: default;
    }

    .box.selling {
        background: rgba(120, 170, 255, 0.35);
        box-shadow: inset 0 0 0 2px #1f4fbf;
    }

    .box.bio {
        border-left: 1.5px solid #1d1d1d;
    }

    .tiny {
        font-family: 'Kartoffeln Letters', 'Comic Sans MS', cursive;
        font-size: 8.5px;
        line-height: 1.2;
    }

    /* On a phone a field is one row of the sheet's grid; the sheet heads its columns. */
    .cell.row,
    .row .sale,
    .row .boxes {
        display: contents;
    }

    .row > .label,
    .row .sale .label,
    .row .tiny {
        display: none;
    }

    .row .letters,
    .row .yield,
    .row .box {
        border-right: 1.5px solid #1d1d1d;
        border-bottom: 1.5px solid #1d1d1d;
    }

    .row .letter {
        font-size: 26px;
    }

    .row .mark {
        font-size: 24px;
    }

    .row .amount {
        font-size: 28px;
    }

    .row .box {
        height: auto;
        justify-content: center;
        background: #fffdf6;
    }

    .row .box.bio {
        border-left: none;
    }

    .row .box.selling {
        background: rgba(120, 170, 255, 0.35);
    }
</style>
