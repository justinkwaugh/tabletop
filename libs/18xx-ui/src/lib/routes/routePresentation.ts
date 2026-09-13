const RouteColors = ['#b24bce', '#15784e', '#d34b38', '#325aba']
export function routeColor(index: number): string {
    return RouteColors[index % RouteColors.length]
}
