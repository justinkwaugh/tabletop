import { authorizeAdminRoute } from '$lib/utils/adminRoute.js'
import type { LayoutLoad } from './$types.js'

export const load: LayoutLoad = async ({ url }) => {
    await authorizeAdminRoute(url)
}
