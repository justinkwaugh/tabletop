<script lang="ts">
    import {
        DoubleHeadingId,
        PullmanScrapValue,
        PullmanStopBonus,
        UnionSwitchId,
        type TrainPower
    } from '@tabletop/18usa'
    import { CompanyToken, Tile, TrainBadge } from '@tabletop/18xx-ui'
    import { EighteenUSAModes, type EighteenUSASession } from './session.svelte.js'
    import TitlePanel from './TitlePanel.svelte'
    import { denverTile } from './denverTile.js'
    import { RichOreValue } from './mapTokens.js'
    let { session, id }: { session: EighteenUSASession; id: string } = $props()
    const money = $derived(session.presentation.money)
    const companyId = $derived(session.operatingCompanyId)
    const disabled = $derived(!session.canChooseAction)
    const PowerPrivates: Readonly<Record<TrainPower, string>> = {
        'double-heading': DoubleHeadingId,
        switcher: UnionSwitchId
    }
    const powers = $derived(
        (['double-heading', 'switcher'] as const).flatMap((power) => {
            const choices = session.trainPowerChoices.filter((choice) => choice.power === power)
            return choices.length ? [{ power, choices }] : []
        })
    )
    const trainColor = (definitionId: string) =>
        session.presentation.trainColors[definitionId] ?? '#a3a3a3'
</script>

{#if companyId}
    {#if id === EighteenUSAModes.pullman.id}
        <TitlePanel label="Pullman">
            <p>
                A Pullman rides with one of the company’s trains each run, adding {money(
                    PullmanStopBonus
                )} at every city and red area that train visits. A company keeps one; the bank pays
                {money(PullmanScrapValue)} to scrap it.
            </p>
            <div class="choices">
                {#if session.canBuyPullman}<button
                        {disabled}
                        onclick={() => void session.buyPullman()}
                        >Buy a Pullman for {money(session.pullmanPrice)}</button
                    >{:else if session.pullmanUnavailable && !session.ownedPullman}<span
                        class="reason">{session.pullmanUnavailable}</span
                    >{/if}
                {#if session.canScrapPullman}<button
                        {disabled}
                        onclick={() => void session.scrapPullman()}
                        >Scrap the Pullman for {money(PullmanScrapValue)}</button
                    >{/if}
            </div>
        </TitlePanel>
    {:else if id === EighteenUSAModes.ore.id}
        <TitlePanel label="Upgrade ore">
            <p>
                Raise an ore token to {money(RichOreValue)} as a tile action; the tile stays as it is.
                Choose a highlighted hex on the map, or here.
            </p>
            <div class="choices">
                {#each session.oreUpgrades as upgrade (upgrade.locationId)}
                    <button
                        {disabled}
                        data-location-id={upgrade.locationId}
                        onclick={() => void session.upgradeOre(upgrade.locationId)}
                        >{session.placeName(upgrade.locationId)}{upgrade.cost
                            ? ` · ${money(upgrade.cost)}`
                            : ''}</button
                    >
                {/each}
            </div>
        </TitlePanel>
    {:else if id === EighteenUSAModes.denver.id}
        <TitlePanel label="Turn Denver">
            <p>
                The first company to reach Denver turns its metropolis tile; it stays that way for
                the rest of the game. Choose how its track should run.
            </p>
            <div class="choices">
                {#each session.denverRotations as rotation (rotation)}
                    <button
                        class="tile-choice"
                        {disabled}
                        aria-label={`Turn Denver to rotation ${rotation}`}
                        data-rotation={rotation}
                        onclick={() => void session.turnDenver(rotation)}
                        ><Tile
                            face={denverTile.face}
                            layout={denverTile.layout}
                            {rotation}
                            orientation={session.mapView.map.definition.orientation}
                            appearance={session.tileAppearance}
                            size={72}
                        /></button
                    >
                {/each}
            </div>
        </TitlePanel>
    {:else if id === EighteenUSAModes.powers.id}
        <TitlePanel label="Train powers">
            {#each powers as { power, choices } (power)}
                <p>
                    <strong>{session.companyName(PowerPrivates[power])}</strong>: {session.privates.description(
                        PowerPrivates[power]
                    )} Choose the train for this run.
                </p>
                <div class="choices">
                    {#each choices as choice (choice.train.id)}
                        <button
                            {disabled}
                            data-train-id={choice.train.id}
                            data-power={power}
                            onclick={() => void session.assignTrainPower(choice)}
                            ><TrainBadge
                                name={session.trainLabel(choice.train)}
                                color={trainColor(choice.train.definitionId)}
                            /></button
                        >
                    {/each}
                </div>
            {/each}
        </TitlePanel>
    {/if}
    <span class="company"
        ><CompanyToken appearance={session.mapView.stations[companyId]} size={16} />
        {session.companyName(companyId)}</span
    >
{/if}

<style>
    button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font: inherit;
        padding: 6px 10px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface, #fffdf8);
        color: inherit;
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .tile-choice {
        padding: 4px;
    }
    .reason,
    .company {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--rail-text, #786550);
    }
    .company {
        justify-content: center;
        width: 100%;
        margin-top: 6px;
    }
</style>
