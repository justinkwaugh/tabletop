<script lang="ts">
    import { Input } from 'flowbite-svelte'
    import { EyeSolid, EyeSlashSolid } from 'flowbite-svelte-icons'
    import { trim } from '@tabletop/frontend-components'

    let {
        id,
        value = $bindable(''),
        autocomplete,
        minlength,
        describedby,
        invalid
    }: {
        id: string
        value?: string
        autocomplete: 'current-password' | 'new-password'
        minlength?: number
        describedby?: string
        invalid?: boolean
    } = $props()
    let visible = $state(false)
</script>

<Input
    class="auth-input"
    {id}
    bind:value
    oninput={trim}
    type={visible ? 'text' : 'password'}
    name="password"
    {autocomplete}
    {minlength}
    aria-describedby={describedby}
    aria-invalid={invalid}
    required
>
    {#snippet right()}
        <button
            type="button"
            onclick={() => (visible = !visible)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            class="pointer-events-auto p-2"
        >
            {#if visible}
                <EyeSlashSolid class="h-5 w-5" />
            {:else}
                <EyeSolid class="h-5 w-5" />
            {/if}
        </button>
    {/snippet}
</Input>
