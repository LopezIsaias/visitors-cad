import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// "Hoy" en America/Lima como YYYY-MM-DD (coincide con el default de registros.fecha en BD).
function hoyLima(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
}

const UP = (v: unknown) =>
	String(v ?? '')
		.trim()
		.toUpperCase();

type Perfil = { rol: string; nombre: string | null; cad_id: number | null };

async function requireLider(locals: App.Locals): Promise<{ userId: string; perfil: Perfil }> {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) throw redirect(303, '/login');

	const { data: perfil } = await locals.supabase
		.from('perfiles')
		.select('rol, nombre, cad_id')
		.eq('id', user.id)
		.single();

	if (perfil?.rol !== 'lider') throw redirect(303, '/admin');
	return { userId: user.id, perfil: perfil as Perfil };
}

export const load: PageServerLoad = async ({ locals }) => {
	const { perfil } = await requireLider(locals);
	const supabase = locals.supabase;
	const hoy = hoyLima();

	const [{ data: registros }, { data: ocupaciones }, { data: cad }] = await Promise.all([
		supabase
			.from('registros')
			.select('id, estado, hora_entrada, minutos, visitantes(dni, nombre, apellido)')
			.eq('fecha', hoy)
			.order('hora_entrada', { ascending: false }),
		supabase.from('ocupaciones').select('nombre').order('nombre'),
		perfil.cad_id
			? supabase.from('cads').select('nombre').eq('id', perfil.cad_id).single()
			: Promise.resolve({ data: null })
	]);

	// El embed de PostgREST llega como objeto (o array según inferencia); lo aplanamos.
	const lista = (registros ?? []).map((r) => {
		const v = Array.isArray(r.visitantes) ? r.visitantes[0] : r.visitantes;
		return {
			id: r.id as number,
			estado: r.estado as string,
			minutos: r.minutos as number | null,
			dni: v?.dni ?? '',
			nombre: v?.nombre ?? '',
			apellido: v?.apellido ?? ''
		};
	});

	return {
		nombre: perfil.nombre,
		cadNombre: cad?.nombre ?? null,
		hoy,
		registros: lista,
		ocupaciones: (ocupaciones ?? []).map((o) => o.nombre)
	};
};

// Valida y normaliza los campos comunes del visitante. Devuelve {data} o {error,campo}.
function parseVisitante(form: FormData) {
	const dni = String(form.get('dni') ?? '').trim();
	if (!/^[0-9]{8}$/.test(dni)) return { error: 'El DNI debe tener 8 dígitos.', campo: 'dni' };

	const nombre = UP(form.get('nombre'));
	if (!nombre) return { error: 'Falta el nombre.', campo: 'nombre' };

	const apellido = UP(form.get('apellido'));
	if (!apellido) return { error: 'Falta el apellido.', campo: 'apellido' };

	const edad = Number(form.get('edad'));
	if (!Number.isInteger(edad) || edad < 0 || edad > 120)
		return { error: 'La edad debe ser un número entre 0 y 120.', campo: 'edad' };

	const genero = String(form.get('genero') ?? '');
	if (genero !== 'Masculino' && genero !== 'Femenino')
		return { error: 'Elige el género.', campo: 'genero' };

	const discapacidad = String(form.get('discapacidad') ?? '');
	if (discapacidad !== 'si' && discapacidad !== 'no')
		return { error: 'Indica si cuenta con alguna discapacidad.', campo: 'discapacidad' };

	let telefono: string;
	if (form.get('sin_telefono')) {
		telefono = 'NO TIENE';
	} else {
		const t = String(form.get('telefono') ?? '').trim();
		if (!t) return { error: 'Ingresa el teléfono o marca "No cuenta con teléfono".', campo: 'telefono' };
		if (!/^[0-9]{9}$/.test(t)) return { error: 'El teléfono debe tener 9 dígitos.', campo: 'telefono' };
		telefono = t;
	}

	const ocupacion = UP(form.get('ocupacion'));
	if (!ocupacion) return { error: 'Elige el cargo o profesión.', campo: 'ocupacion' };

	return { data: { dni, nombre, apellido, edad, genero, discapacidad, telefono, ocupacion } };
}

export const actions: Actions = {
	// Alta de visitante nuevo (o reuso si el DNI ya existe en el CAD) + registro de entrada.
	nuevo: async ({ request, locals }) => {
		const { userId, perfil } = await requireLider(locals);
		if (!perfil.cad_id) return fail(400, { form: 'nuevo', error: 'Tu cuenta no tiene un CAD asignado.' });

		const form = await request.formData();
		const parsed = parseVisitante(form);
		if ('error' in parsed) return fail(400, { form: 'nuevo', ...parsed });
		const v = parsed.data;
		const supabase = locals.supabase;

		// Reusar si ya existe ese DNI en el CAD; si no, crearlo.
		let visitanteId: number;
		const { data: existente } = await supabase
			.from('visitantes')
			.select('id')
			.eq('cad_id', perfil.cad_id)
			.eq('dni', v.dni)
			.maybeSingle();

		if (existente) {
			visitanteId = existente.id;
		} else {
			const { data: creado, error: eIns } = await supabase
				.from('visitantes')
				.insert({ ...v, cad_id: perfil.cad_id })
				.select('id')
				.single();
			if (eIns || !creado)
				return fail(400, { form: 'nuevo', error: 'No se pudo guardar el visitante. Revisa los datos.' });
			visitanteId = creado.id;
		}

		const { error: eReg } = await supabase
			.from('registros')
			.insert({ visitante_id: visitanteId, cad_id: perfil.cad_id, lider_id: userId });
		if (eReg) return fail(400, { form: 'nuevo', error: 'No se pudo crear el registro de entrada.' });

		return { form: 'nuevo', ok: true };
	},

	// Registrar visita de un recurrente (edad precargada y editable).
	visita: async ({ request, locals }) => {
		const { userId, perfil } = await requireLider(locals);
		if (!perfil.cad_id) return fail(400, { form: 'visita', error: 'Tu cuenta no tiene un CAD asignado.' });

		const form = await request.formData();
		const visitanteId = Number(form.get('visitante_id'));
		if (!Number.isInteger(visitanteId) || visitanteId <= 0)
			return fail(400, { form: 'visita', error: 'Selecciona un visitante.' });

		const edad = Number(form.get('edad'));
		if (!Number.isInteger(edad) || edad < 0 || edad > 120)
			return fail(400, { form: 'visita', error: 'La edad debe estar entre 0 y 120.', campo: 'edad' });

		const supabase = locals.supabase;

		// Solo actualiza la edad si cambió (RLS limita al CAD del líder).
		await supabase
			.from('visitantes')
			.update({ edad })
			.eq('id', visitanteId)
			.eq('cad_id', perfil.cad_id);

		const { error: eReg } = await supabase
			.from('registros')
			.insert({ visitante_id: visitanteId, cad_id: perfil.cad_id, lider_id: userId });
		if (eReg) return fail(400, { form: 'visita', error: 'No se pudo registrar la visita.' });

		return { form: 'visita', ok: true };
	},

	// Cerrar una visita en curso → calcula minutos vía RPC en BD.
	finalizar: async ({ request, locals }) => {
		await requireLider(locals);
		const form = await request.formData();
		const regId = Number(form.get('reg_id'));
		if (!Number.isInteger(regId) || regId <= 0)
			return fail(400, { form: 'finalizar', error: 'Registro inválido.' });

		const { error } = await locals.supabase.rpc('finalizar_registro', { reg_id: regId });
		if (error) return fail(400, { form: 'finalizar', error: 'No se pudo finalizar.' });

		return { form: 'finalizar', ok: true };
	},

	logout: async ({ locals }) => {
		await locals.supabase.auth.signOut();
		throw redirect(303, '/login');
	}
};
