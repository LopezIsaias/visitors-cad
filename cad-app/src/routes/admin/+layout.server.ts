import { requireSuperadmin } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { nombre } = await requireSuperadmin(locals);
	return { nombre };
};
