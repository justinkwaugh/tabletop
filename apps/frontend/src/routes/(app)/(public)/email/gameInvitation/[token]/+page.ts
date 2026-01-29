import { goto } from '$app/navigation'
import { resolve } from '$app/paths'

export async function load({ params }) {
    const token = params.token
    await goto(resolve(`/invitation/${token}`))
}
