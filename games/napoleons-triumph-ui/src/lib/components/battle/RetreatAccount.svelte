<script lang="ts">
    import AccountSheet from './AccountSheet.svelte'

    let {
        lines,
        gunsLost,
        onclose
    }: {
        lines: { text: string; steps: number }[]
        /** How many artillery units the retreat loses outright. */
        gunsLost: number
        onclose: () => void
    } = $props()

    const total = $derived(lines.reduce((sum, line) => sum + line.steps, 0))
</script>

<AccountSheet label="What the retreat costs" {onclose}>
    {#snippet title()}Retreat losses{/snippet}
    {#snippet description()}
        A retreat costs steps of its own, apart from any lost in the fight, and as much morale. One
        step is owed across a narrow approach and two across a wide one, by each group below
        together.
    {/snippet}
    <table>
        <tbody>
            {#each lines as line, index (index)}
                <tr>
                    <th scope="row">{line.text}</th>
                    <td>{line.steps}</td>
                </tr>
            {/each}
        </tbody>
        <tfoot>
            <tr>
                <th scope="row">Steps to lose</th>
                <td>{total}</td>
            </tr>
        </tfoot>
    </table>
    <p>
        Cavalry in reserve and the units that defended lose nothing.{gunsLost > 0
            ? ` Artillery cannot retreat: ${gunsLost === 1 ? 'the unit is' : `${gunsLost} units are`} lost.`
            : ''}
    </p>
</AccountSheet>

<style>
    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }

    th {
        padding: 5px 12px 5px 0;
        font-weight: 400;
        line-height: 1.3;
        text-align: left;
    }

    td {
        padding: 5px 0;
        font-size: 16px;
        font-weight: 700;
        text-align: right;
        vertical-align: top;
        white-space: nowrap;
    }

    tfoot th,
    tfoot td {
        border-top: 1px solid color-mix(in srgb, var(--nt-ink) 45%, transparent);
        font-style: italic;
    }

    tfoot td {
        font-size: 18px;
        font-style: normal;
    }

    p {
        font-size: 14px;
        line-height: 1.35;
    }
</style>
