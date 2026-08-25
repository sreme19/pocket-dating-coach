/**
 * Route matcher for the /get landing page's audience segment.
 *
 * `/get` renders the men's page (the original, unchanged); `/get/w` renders the
 * women's. Restricting the segment to a known value here means `/get/anything`
 * 404s instead of silently rendering the men's page under a URL an ad might be
 * pointing at — which is the exact failure the ad-management-agent's destination
 * gate exists to prevent, and it should not be reintroduced by a loose route.
 */
export function match(param: string): boolean {
	return param === 'w';
}
