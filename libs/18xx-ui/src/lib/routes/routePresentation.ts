const RouteColors = ['#b24bce', '#ed9226', '#d34b38', '#325aba']
export function routeColor(index: number): string {
    return RouteColors[index % RouteColors.length]
}
