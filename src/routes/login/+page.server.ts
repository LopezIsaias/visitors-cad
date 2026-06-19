import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Destination per role. Superadmin → escritorio; líder → móvil.
async function destForUser(
	supabase: App.Locals['supabase'],
	userId: string
): Promise<string> {
	const { data: perfil } = await supabase
		.from('perfiles')
		.select('rol')
		.eq('id', userId)
		.single();
	return perfil?.rol === 'superadmin' ? '/admin' : '/app';
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (session && user) {
		throw redirect(303, await destForUser(supabase, user.id));
	}
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { email, error: 'Ingresa tu correo y contraseña.' });
		}

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(400, { email, error: 'Correo o contraseña incorrectos.' });
		}

		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (!user) {
			return fail(400, { email, error: 'No se pudo iniciar sesión. Intenta de nuevo.' });
		}

		throw redirect(303, await destForUser(supabase, user.id));
	}
};
