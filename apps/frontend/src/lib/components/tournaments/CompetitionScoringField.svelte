<script lang="ts">
    import { ButtonGroup, Helper, Label, RadioButton } from 'flowbite-svelte'
    import type { CompetitionGameChoice } from './competitionGameChoice.svelte'
    import { tournamentScoringText } from '$lib/utils/tournamentPresentation'

    let { game }: { game: CompetitionGameChoice } = $props()
    const checked =
        'dark:hover:bg-transparent dark:bg-transparent dark:text-primary-500 dark:hover:text-primary-500 dark:focus-within:text-primary-500'
</script>

<div>
    <Label class="mb-2">Ranking</Label>
    <ButtonGroup aria-label="Ranking">
        <RadioButton value="splitWinsV1" bind:group={game.chosenScoring} checkedClass={checked}
            >Wins</RadioButton
        >
        <RadioButton value="placementV1" bind:group={game.chosenScoring} checkedClass={checked}
            >Average place</RadioButton
        >
    </ButtonGroup>
    <Helper class="mt-1 text-xs">{tournamentScoringText(game)}</Helper>
</div>
