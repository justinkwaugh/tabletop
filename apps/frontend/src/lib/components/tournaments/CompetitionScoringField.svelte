<script lang="ts">
    import { ButtonGroup, Helper, Label, RadioButton } from 'flowbite-svelte'
    import type { CompetitionGameChoice } from './competitionGameChoice.svelte'
    import { tournamentScoringText } from '$lib/utils/tournamentPresentation'
    import { m } from '$lib/paraglide/messages'

    let { game }: { game: CompetitionGameChoice } = $props()
    const checked =
        'dark:hover:bg-transparent dark:bg-transparent dark:text-primary-500 dark:hover:text-primary-500 dark:focus-within:text-primary-500'
</script>

<div>
    <Label class="mb-2">{m.tournaments_ranking()}</Label>
    <ButtonGroup aria-label={m.tournaments_ranking()}>
        <RadioButton value="splitWinsV1" bind:group={game.chosenScoring} checkedClass={checked}
            >{m.tournaments_wins()}</RadioButton
        >
        <RadioButton value="placementV1" bind:group={game.chosenScoring} checkedClass={checked}
            >{m.tournaments_average_place()}</RadioButton
        >
    </ButtonGroup>
    <Helper class="mt-1 text-xs">{tournamentScoringText(game)}</Helper>
</div>
