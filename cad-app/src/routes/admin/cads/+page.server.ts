import { fail } from '@sveltejs/kit';
import { requireSuperadmin } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireSuperadmin(locals);
	const { data: cads } = await locals.supabase
		.from('cads')
		.select('id, nombre')
		.order('nombre');
	return { cads: cads ?? [] };
};

const UP = (v: unknown) => String(v ?? '').trim().toUpperCase();

export const actions: Actions = {
	crear: async ({ request, locals }) => {
		await requireSuperadmin(locals);
		const nombre = UP((await request.formData()).get('nombre'));
		if (!nombre) return fail(400, { form: 'crear', error: 'Escribe el nombre del CAD.' });

		const { error } = await locals.supabase.from('cads').insert({ nombre });
		if (error)
			return fail(400, {
				form: 'crear',
				error: error.code === '23505' ? 'Ya existe un CAD con ese nombre.' : 'No se pudo crear.'
			});
		return { form: 'crear', ok: true };
	},

	editar: async ({ request, locals }) => {
		await requireSuperadmin(locals);
		const form = await request.formData();
		const id = Number(form.get('id'));
		const nombre = UP(form.get('nombre'));
		if (!id || !nombre) return fail(400, { form: 'editar', error: 'Datos incompletos.' });

		const { error } = await locals.supabase.from('cads').update({ nombre }).eq('id', id);
		if (error)
			return fail(400, {
				form: 'editar',
				error: error.code === '23505' ? 'Ya existe un CAD con ese nombre.' : 'No se pudo actualizar.'
			});
		return { form: 'editar', ok: true };
	}
};
