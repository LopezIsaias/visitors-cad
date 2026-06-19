import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Root is a pure router: send everyone to login or to their role home.
export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		throw redirect(303, '/login');
	}

	const { data: perfil } = await supabase
		.from('perfiles')
		.select('rol')
		.eq('id', user.id)
		.single();

	throw redirect(303, perfil?.rol === 'superadmin' ? '/admin' : '/app');
};
