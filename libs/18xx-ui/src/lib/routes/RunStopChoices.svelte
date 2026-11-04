<script lang="ts">
    import { ignorableRunInstructionStops } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import StopList from '../table/StopList.svelte'
    import SwitchTrack from '../table/SwitchTrack.svelte'
    import { alwaysRunStops, ignorableRunStops } from './runInstructionText.js'
    let { session, disabled }: { session: EighteenXXSessionView; disabled: boolean } = $props()
    const runs = $derived(session.runInstructions)
</script>

<p>
    Autorun runs a company’s best routes and pays out on each of its turns, building and buying
    nothing.
</p>
<p>It stops on its own when:</p>
<dl>
    {#each ignorableRunInstructionStops as stop (stop)}
        <dt>{ignorableRunStops[stop].label}</dt>
        <dd>{ignorableRunStops[stop].condition}</dd>
    {/each}
</dl>
<table>
    <thead>
        <tr>
            <td class="group">You choose</td>
            {#each ignorableRunInstructionStops as stop (stop)}
                <th scope="col">{ignorableRunStops[stop].label}</th>
            {/each}
        </tr>
    </thead>
    <tbody>
        {#each runs.presided as companyId (companyId)}
            {@const name = session.companyName(companyId)}
            {@const ignored = runs.ignoredStops(companyId)}
            <tr>
                <th scope="row"
                    ><span class="company"
                        ><CompanyToken
                            appearance={session.mapView.stations[companyId]}
                            size={16}
                        />{name}</span
                    ></th
                >
                {#each ignorableRunInstructionStops as stop (stop)}
                    <td>
                        <button
                            class="switch"
                            role="switch"
                            aria-checked={!ignored.includes(stop)}
                            aria-label={`${name} stops on ${ignorableRunStops[stop].label.toLowerCase()}`}
                            {disabled}
                            onclick={() => runs.toggleIgnoredStop(companyId, stop)}
                            ><SwitchTrack on={!ignored.includes(stop)} /></button
                        >
                    </td>
                {/each}
            </tr>
        {/each}
    </tbody>
</table>
<div class="group">Always</div>
<StopList always={alwaysRunStops} />

<style>
    p {
        margin: 0 0 6px;
    }
    dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 2px 8px;
        margin: 0 0 6px;
    }
    dt {
        color: var(--rail-text, #e3e9ef);
        font-weight: 600;
    }
    dd {
        margin: 0;
        color: var(--rail-muted, #7f8e9e);
    }
    table {
        margin-top: 8px;
        border-collapse: collapse;
    }
    td.group {
        margin: 0;
        padding: 0 0 4px;
        vertical-align: bottom;
    }
    thead th {
        padding: 0 0 4px 12px;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        color: var(--rail-muted, #7f8e9e);
    }
    tbody th {
        padding: 3px 0;
        font-weight: 400;
        text-align: left;
    }
    tbody td {
        padding: 3px 0 3px 12px;
        text-align: center;
    }
    .switch {
        display: inline-flex;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
    }
    .switch:disabled {
        cursor: default;
    }
    .switch:focus-visible {
        outline: 2px solid var(--rail-focus, #b8cddd);
        outline-offset: 1px;
    }
    .group {
        margin: 8px 0 2px;
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--rail-muted, #7f8e9e);
    }
    .company {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        color: var(--rail-text, #e3e9ef);
    }
</style>
