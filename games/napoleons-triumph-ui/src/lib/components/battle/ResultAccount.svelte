<script lang="ts">
    import { Side, type ResultTerm } from '@tabletop/napoleons-triumph'
    import UnitTile from '$lib/components/UnitTile.svelte'
    import {
        AccountSide,
        fightOf,
        finalLines,
        initialLines,
        verdictOf,
        type AccountLine
    } from '$lib/model/resultAccount.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { signed } from '$lib/utils/signed.js'
    import AccountSheet from './AccountSheet.svelte'

    /** One of the two: the terms of the initial result, or what the counter-attack took from it for the final one. */
    let {
        initial,
        counter,
        onclose
    }: {
        initial?: ResultTerm[]
        counter?: ResultTerm[]
        onclose: () => void
    } = $props()

    const gameSession = getGameSession()
    const attack = $derived(gameSession.attack)
    const settled = $derived(attack?.initialResult ?? 0)

    const lines: AccountLine[] = $derived(
        initial ? initialLines(initial) : finalLines(settled, counter ?? [])
    )
    const total = $derived(lines.reduce((sum, line) => sum + line.value, 0))
    const name = $derived(initial ? 'Initial result' : 'Final result')
    const verdict = $derived(
        attack && !initial
            ? verdictOf(
                  total,
                  fightOf(attack, gameSession.gameState.sideOf(attack.attackerId) === Side.French)
              )
            : undefined
    )

    function ownerOf(line: AccountLine): string | undefined {
        return line.side === AccountSide.Attack ? attack?.attackerId : attack?.defenderId
    }
</script>

<AccountSheet label="How the {name.toLowerCase()} is reached" {onclose}>
    {#snippet title()}{name} <b>{signed(total)}</b>{/snippet}
    {#snippet description()}
        {#if initial}
            The strength of the units leading the attack, less what the ground and the units leading
            the defence take from it.
        {:else}
            The initial result, less the strength of any counter-attack. It settles whether the
            attack succeeds and how many steps each side loses.
        {/if}
    {/snippet}
    <table>
        <tbody>
            {#each lines as line, index (index)}
                {@const owner = ownerOf(line)}
                <tr>
                    <th scope="row">
                        <span>{line.text}</span>
                        {#if owner && line.faces.length > 0}
                            <span class="nt-account-units">
                                {#each line.faces as face, at (at)}
                                    <UnitTile
                                        playerId={owner}
                                        {face}
                                        label={line.text}
                                        scale={0.8}
                                    />
                                {/each}
                            </span>
                        {/if}
                    </th>
                    <td>{signed(line.value)}</td>
                </tr>
            {/each}
        </tbody>
        <tfoot>
            <tr>
                <th scope="row">{name}</th>
                <td>{signed(total)}</td>
            </tr>
        </tfoot>
    </table>
    {#if verdict}
        <p class="nt-account-verdict">{verdict}</p>
    {/if}
</AccountSheet>

<style>
    .nt-account-verdict {
        font-size: 14px;
        line-height: 1.35;
    }

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

    th span {
        display: block;
    }

    .nt-account-units {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding-top: 3px;
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
</style>
