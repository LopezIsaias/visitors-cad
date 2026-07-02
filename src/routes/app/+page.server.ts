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
	let dni: string;
	if (form.get('sin_dni')) {
		dni = 'NO PROPORCIONÓ';
	} else {
		dni = String(form.get('dni') ?? '').trim();
		if (!/^[0-9]{8}$/.test(dni)) return { error: 'El DNI debe tener 8 dígitos.', campo: 'dni' };
	}

	const nombre = UP(form.get('nombre'));
	if (!nombre) return { error: 'Falta el nombre.', campo: 'nombre' };

	const apellido = UP(form.get('apellido'));
	if (!apellido) return { error: 'Falta el apellido.', campo: 'apellido' };

	const edad = Number(form.get('edad'));
	if (!Number.isInteger(edad) || edad < 0 || edad > 120)
		return { error: 'La edad debe ser un número entre 0 y 120.', campo: 'edad' };

	const genero = UP(form.get('genero'));
	if (genero !== 'MASCULINO' && genero !== 'FEMENINO')
		return { error: 'Elige el género.', campo: 'genero' };

	const discapacidad = UP(form.get('discapacidad'));
	if (discapacidad !== 'SI' && discapacidad !== 'NO')
		return { error: 'Indica si cuenta con alguna discapacidad.', campo: 'discapacidad' };

	let telefono: string;
	if (form.get('sin_telefono')) {
		telefono = 'NO PROPORCIONÓ';
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

// Reglas de re-registro en el día (Lima): máx. 1 sesión activa y máx. 2 visitas/día.
// Devuelve el mensaje a mostrar, o null si se permite registrar.
async function avisoReRegistro(
	supabase: App.Locals['supabase'],
	visitanteId: number,
	cadId: number,
	hoy: string
): Promise<string | null> {
	const { data } = await supabase
		.from('registros')
		.select('estado')
		.eq('visitante_id', visitanteId)
		.eq('cad_id', cadId)
		.eq('fecha', hoy);
	const regs = data ?? [];
	if (regs.some((r) => r.estado === 'en_curso')) return 'El visitante tiene sesión activa hoy.';
	if (regs.length >= 2) return 'El visitante ya alcanzó el máximo de 2 registros hoy.';
	return null;
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
		// Los sin-DNI (NO PROPORCIONÓ) no son únicos: nunca se reusan, siempre nuevo.
		let visitanteId: number;
		const { data: existente } =
			v.dni === 'NO PROPORCIONÓ'
				? { data: null }
				: await supabase
						.from('visitantes')
						.select('id')
						.eq('cad_id', perfil.cad_id)
						.eq('dni', v.dni)
						.maybeSingle();

		if (existente) {
			visitanteId = existente.id;
			const aviso = await avisoReRegistro(supabase, visitanteId, perfil.cad_id, hoyLima());
			if (aviso) return fail(400, { form: 'nuevo', error: aviso });
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
		if (eReg)
			return fail(400, {
				form: 'nuevo',
				error: eReg.code === '23505' ? 'El visitante tiene sesión activa hoy.' : 'No se pudo crear el registro de entrada.'
			});

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

		const aviso = await avisoReRegistro(supabase, visitanteId, perfil.cad_id, hoyLima());
		if (aviso) return fail(400, { form: 'visita', error: aviso });

		// Solo actualiza la edad si cambió (RLS limita al CAD del líder).
		await supabase
			.from('visitantes')
			.update({ edad })
			.eq('id', visitanteId)
			.eq('cad_id', perfil.cad_id);

		const { error: eReg } = await supabase
			.from('registros')
			.insert({ visitante_id: visitanteId, cad_id: perfil.cad_id, lider_id: userId });
		if (eReg)
			return fail(400, {
				form: 'visita',
				error: eReg.code === '23505' ? 'El visitante tiene sesión activa hoy.' : 'No se pudo registrar la visita.'
			});

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
