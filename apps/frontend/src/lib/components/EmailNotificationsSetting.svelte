<script lang="ts">
    import { Toggle } from 'flowbite-svelte'
    import { wantsGameAndCompetitionEmails } from '@tabletop/common'
    import { getAppContext } from '$lib/stores/appContext.svelte'

    const { userPreferencesEditor: editor } = getAppContext()
</script>

<Toggle
    checked={wantsGameAndCompetitionEmails(editor.values)}
    onchange={(event) => editor.update({ gameAndCompetitionEmails: event.currentTarget.checked })}
    >Email me about games and competitions</Toggle
>
<p class="text-sm text-gray-700 dark:text-gray-300">
    Invitations, games starting and finishing, and league and tournament news, including sign-up
    reminders. Account emails are always sent.
</p>
<p class="text-sm font-medium text-gray-900 dark:text-white">
    Email never tells you it's your turn. For that, turn on web or Discord notifications above.
</p>
