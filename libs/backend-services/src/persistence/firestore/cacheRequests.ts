import { assertExists } from '@tabletop/common'

export function requestForKey<T>(requests: Map<string, T>, key: string): T {
    const request = requests.get(key)
    assertExists(request, `No request for cache key ${key}`)
    return request
}
