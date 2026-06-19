import { redirect } from '@sveltejs/kit';

// Garantiza sesión + rol superadmin. Redirige si no corresponde.
export async function requireSuperadmin(locals: App.Locals): Promise<{
	userId: string;
	nombre: string | null;
}> {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) throw redirect(303, '/login');

	const { data: perfil } = await locals.supabase
		.from('perfiles')
		.select('rol, nombre')
		.eq('id', user.id)
		.single();

	if (perfil?.rol !== 'superadmin') throw redirect(303, '/app');
	return { userId: user.id, nombre: perfil?.nombre ?? null };
}
