import { error } from '@sveltejs/kit';
import { getRole } from '$lib/marketing/careers';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
  const role = getRole(params.slug);
  if (!role) throw error(404, 'Role not found');
  return { role };
};
