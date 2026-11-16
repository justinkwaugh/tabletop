<script lang="ts">
    import { Checkbox, Helper } from 'flowbite-svelte'

    let { checked = $bindable(false), errors }: { checked?: boolean; errors?: string[] } = $props()
    const id = $props.id()
</script>

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
            I'm 13 or older and agree to the
            <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>. See how we use
            your data in the
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
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
