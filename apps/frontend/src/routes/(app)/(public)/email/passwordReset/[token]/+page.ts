import type { PageLoad } from './$types.js'

// The link's challenge is only checked when the new password is submitted: checking it earlier
// would need a separate, unauthenticated validity oracle.
export const load: PageLoad = async ({ params }) => {
    return { challenge: params.token }
}
