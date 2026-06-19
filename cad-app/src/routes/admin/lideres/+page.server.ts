import { fail } from '@sveltejs/kit';
import { requireSuperadmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { Actions, PageServerLoad } from './$types';

const PASSWORD_LIDER = 'clave*2025'; // fijo para todos los líderes (§3)

const flat = <T>(v: T | T[]): T | undefined => (Array.isArray(v) ? v[0] : v);

// Mapa uid → email vía Admin API (perfiles no guarda el correo).
async function emailsPorId(): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	let pagina = 1;
	for (;;) {
		const { data } = await supabaseAdmin.auth.admin.listUsers({ page: pagina, perPage: 1000 });
		for (const u of data?.users ?? []) if (u.email) map.set(u.id, u.email);
		if (!data || data.users.length < 1000) break;
		pagina++;
	}
	return map;
}

export const load: PageServerLoad = async ({ locals }) => {
	await requireSuperadmin(locals);

	const [{ data: perfiles }, { data: cads }, emails] = await Promise.all([
		locals.supabase
			.from('perfiles')
			.select('id, nombre, cad_id, cads(nombre)')
			.eq('rol', 'lider')
			.order('nombre'),
		locals.supabase.from('cads').select('id, nombre').order('nombre'),
		emailsPorId()
	]);

	const lideres = (perfiles ?? []).map((p) => ({
		id: p.id,
		nombre: p.nombre,
		cad: (flat(p.cads) as { nombre: string } | undefined)?.nombre ?? '—',
		cad_id: p.cad_id,
		email: emails.get(p.id) ?? '—'
	}));

	const ocupados = new Set((perfiles ?? []).map((p) => p.cad_id));
	const cadsLibres = (cads ?? []).filter((c) => !ocupados.has(c.id));

	return { lideres, cadsLibres };
};

export const actions: Actions = {
	crear: async ({ request, locals }) => {
		await requireSuperadmin(locals);
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const nombre = String(form.get('nombre') ?? '').trim().toUpperCase();
		const cadId = Number(form.get('cad_id'));

		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
			return fail(400, { error: 'Correo inválido.' });
		if (!nombre) return fail(400, { error: 'Escribe el nombre del líder.' });
		if (!cadId) return fail(400, { error: 'Elige un CAD.' });

		// Verifica que el CAD no tenga ya un líder.
		const { data: ya } = await locals.supabase
			.from('perfiles')
			.select('id')
			.eq('rol', 'lider')
			.eq('cad_id', cadId)
			.maybeSingle();
		if (ya) return fail(400, { error: 'Ese CAD ya tiene un líder asignado.' });

		// Crear cuenta de auth (clave fija) con la clave secreta.
		const { data: creado, error: eAuth } = await supabaseAdmin.auth.admin.createUser({
			email,
			password: PASSWORD_LIDER,
			email_confirm: true
		});
		if (eAuth || !creado?.user)
			return fail(400, {
				error: eAuth?.message?.includes('already')
					? 'Ya existe una cuenta con ese correo.'
					: 'No se pudo crear la cuenta.'
			});

		const { error: ePerfil } = await supabaseAdmin
			.from('perfiles')
			.insert({ id: creado.user.id, rol: 'lider', cad_id: cadId, nombre });
		if (ePerfil) {
			// rollback: borra la cuenta huérfana
			await supabaseAdmin.auth.admin.deleteUser(creado.user.id);
			return fail(400, { error: 'No se pudo guardar el perfil. Intenta de nuevo.' });
		}

		return { ok: true, email };
	}
};
