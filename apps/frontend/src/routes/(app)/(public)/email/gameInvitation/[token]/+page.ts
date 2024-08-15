import { goto } from '$app/navigation'

export async function load({ params }) {
    const token = params.token
    await goto(`/invitation/${token}`)
}
