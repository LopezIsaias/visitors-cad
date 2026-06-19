import { redirect } from '@sveltejs/kit';
import { requireSuperadmin } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

function hoyLima(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
}

export const load: PageServerLoad = async ({ locals }) => {
	await requireSuperadmin(locals);
	const supabase = locals.supabase;
	const hoy = hoyLima();

	const [
		{ count: totalRegistros },
		{ count: registrosHoy },
		{ count: totalVisitantes },
		{ count: totalLideres },
		{ data: cads },
		{ data: regs }
	] = await Promise.all([
		supabase.from('registros').select('*', { count: 'exact', head: true }),
		supabase.from('registros').select('*', { count: 'exact', head: true }).eq('fecha', hoy),
		supabase.from('visitantes').select('*', { count: 'exact', head: true }),
		supabase.from('perfiles').select('*', { count: 'exact', head: true }).eq('rol', 'lider'),
		supabase.from('cads').select('id, nombre').order('nombre'),
		supabase.from('registros').select('cad_id, estado')
	]);

	// Resumen por CAD (agregado en memoria).
	const porCad = new Map<number, { en_curso: number; finalizado: number; total: number }>();
	for (const r of regs ?? []) {
		const c = porCad.get(r.cad_id) ?? { en_curso: 0, finalizado: 0, total: 0 };
		c.total++;
		if (r.estado === 'en_curso') c.en_curso++;
		else c.finalizado++;
		porCad.set(r.cad_id, c);
	}

	const resumen = (cads ?? [])
		.map((c) => ({ nombre: c.nombre, ...(porCad.get(c.id) ?? { en_curso: 0, finalizado: 0, total: 0 }) }))
		.sort((a, b) => b.total - a.total);

	return {
		hoy: hoy.split('-').reverse().join('/'),
		metricas: {
			totalRegistros: totalRegistros ?? 0,
			registrosHoy: registrosHoy ?? 0,
			totalVisitantes: totalVisitantes ?? 0,
			totalCads: cads?.length ?? 0,
			totalLideres: totalLideres ?? 0
		},
		resumen
	};
};

export const actions: Actions = {
	logout: async ({ locals }) => {
		await locals.supabase.auth.signOut();
		throw redirect(303, '/login');
	}
};
