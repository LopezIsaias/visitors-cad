import { fail } from '@sveltejs/kit';
import { requireSuperadmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { borrarRegistros, fetchReporte, leerFiltro } from '$lib/server/registros';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requireSuperadmin(locals);
	const filtro = leerFiltro(url);

	const [{ data: cads }, filas] = await Promise.all([
		locals.supabase.from('cads').select('id, nombre').order('nombre'),
		fetchReporte(locals.supabase, filtro)
	]);

	return { cads: cads ?? [], filtro, filas };
};

export const actions: Actions = {
	// Borra un registro (la visita). El visitante se conserva como recurrente.
	eliminar: async ({ request, locals }) => {
		await requireSuperadmin(locals);
		const id = Number((await request.formData()).get('id'));
		if (!id) return fail(400, { form: 'eliminar', error: 'Registro inválido.' });

		// service_role: registros no tiene policy DELETE en RLS.
		const { error } = await supabaseAdmin.from('registros').delete().eq('id', id);
		if (error) return fail(400, { form: 'eliminar', error: 'No se pudo eliminar el registro.' });
		return { form: 'eliminar', ok: true };
	},

	// Borra todos los registros del filtro actual (CAD + periodo). Conserva visitantes.
	eliminarFiltro: async ({ request, locals }) => {
		await requireSuperadmin(locals);
		const form = await request.formData();
		const filtro = {
			cad: String(form.get('cad') ?? 'all'),
			modo: String(form.get('modo') ?? 'dia') as 'dia' | 'mes' | 'anio',
			valor: String(form.get('valor') ?? '')
		};

		const { count, error } = await borrarRegistros(supabaseAdmin, filtro);
		if (error) return fail(400, { form: 'eliminar', error: 'No se pudieron eliminar los registros.' });
		return { form: 'eliminar', ok: true, count };
	}
};
