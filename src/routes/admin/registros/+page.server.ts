import { requireSuperadmin } from '$lib/server/auth';
import { fetchReporte, leerFiltro } from '$lib/server/registros';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requireSuperadmin(locals);
	const filtro = leerFiltro(url);

	const [{ data: cads }, filas] = await Promise.all([
		locals.supabase.from('cads').select('id, nombre').order('nombre'),
		fetchReporte(locals.supabase, filtro)
	]);

	return { cads: cads ?? [], filtro, filas };
};
