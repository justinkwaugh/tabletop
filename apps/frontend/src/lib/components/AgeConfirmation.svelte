<script lang="ts">
    import { Checkbox, Helper } from 'flowbite-svelte'
    import RichMessage from '$lib/components/RichMessage.svelte'
    import { m } from '$lib/paraglide/messages'

    let { checked = $bindable(false), errors }: { checked?: boolean; errors?: string[] } = $props()
    const id = $props.id()
</script>

{#snippet terms(text: string)}<a href="/terms" target="_blank" rel="noreferrer">{text}</a>{/snippet}
{#snippet privacy(text: string)}<a href="/privacy" target="_blank" rel="noreferrer">{text}</a
    >{/snippet}

<div>
    <Checkbox
        id={`${id}-age`}
        bind:checked
        name="ageConfirmed"
        required
        aria-invalid={Boolean(errors)}
        aria-describedby={errors ? `${id}-age-error` : undefined}
    >
        <span>
            <RichMessage parts={m.auth_age_confirmation.parts()} markup={{ terms, privacy }} />
        </span>
    </Checkbox>
    {#if errors}
        <Helper id={`${id}-age-error`} color="red" class="mt-2" role="alert">
            {errors.join('. ')}
        </Helper>
    {/if}
</div>

<style>
    a {
        color: var(--color-blue-300);
        text-decoration: underline;
        text-underline-offset: 3px;
    }
</style>
