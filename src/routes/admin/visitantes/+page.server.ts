import { fail } from '@sveltejs/kit';
import * as XLSX from 'xlsx';
import { requireSuperadmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	await requireSuperadmin(locals);
	const cadId = Number(url.searchParams.get('cad')) || null;

	const { data: cads } = await locals.supabase.from('cads').select('id, nombre').order('nombre');
	const { data: ocupaciones } = await locals.supabase
		.from('ocupaciones')
		.select('nombre')
		.order('nombre');

	let visitantes: any[] = [];
	if (cadId) {
		const { data } = await locals.supabase
			.from('visitantes')
			.select('id, dni, nombre, apellido, edad, genero, discapacidad, telefono, ocupacion')
			.eq('cad_id', cadId)
			.order('apellido');
		visitantes = data ?? [];
	}

	return {
		cads: cads ?? [],
		cadId,
		visitantes,
		ocupaciones: (ocupaciones ?? []).map((o) => o.nombre as string)
	};
};

// Normaliza encabezados: MAYÚSCULAS, sin acentos, sin espacios extra.
const norm = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.trim()
		.toUpperCase();

const UP = (v: unknown) => String(v ?? '').trim().toUpperCase();

type Visitante = {
	dni: string;
	nombre: string;
	apellido: string;
	edad: number;
	genero: string;
	discapacidad: string;
	telefono: string;
	ocupacion: string;
};

// Valida y normaliza una fila del archivo. Devuelve {data} o {error}.
function parseRow(
	row: Record<string, unknown>,
	allowNoDni = false
): { data: Visitante } | { error: string } {
	const g = (k: string) => {
		const found = Object.keys(row).find((key) => norm(key) === k);
		return found ? String(row[found] ?? '').trim() : '';
	};

	let dni: string;
	if (allowNoDni && norm(g('DNI')) === 'NO PROPORCIONO') {
		dni = 'NO PROPORCIONÓ';
	} else {
		dni = g('DNI').replace(/\D/g, '');
		if (!/^[0-9]{8}$/.test(dni)) return { error: `DNI inválido ("${g('DNI')}"): deben ser 8 dígitos.` };
	}

	const nombre = UP(g('NOMBRE'));
	if (!nombre) return { error: 'Falta NOMBRE.' };
	const apellido = UP(g('APELLIDO'));
	if (!apellido) return { error: 'Falta APELLIDO.' };

	const edad = Number(g('EDAD'));
	if (!Number.isInteger(edad) || edad < 0 || edad > 120)
		return { error: `EDAD inválida ("${g('EDAD')}"): entero 0–120.` };

	const gen = norm(g('GENERO'));
	const genero = gen.startsWith('M') ? 'MASCULINO' : gen.startsWith('F') ? 'FEMENINO' : '';
	if (!genero) return { error: `GENERO inválido ("${g('GENERO')}"): MASCULINO o FEMENINO.` };

	const dis = norm(g('DISCAPACIDAD'));
	const discapacidad = dis.startsWith('S') ? 'SI' : dis.startsWith('N') ? 'NO' : '';
	if (!discapacidad) return { error: `DISCAPACIDAD inválida ("${g('DISCAPACIDAD')}"): SI o NO.` };

	let telefono: string;
	const telRaw = g('TELEFONO');
	const telDigits = telRaw.replace(/\D/g, '');
	if (!telRaw || norm(telRaw) === 'NO TIENE' || norm(telRaw) === 'NOTIENE') {
		telefono = 'NO TIENE';
	} else if (/^[0-9]{9}$/.test(telDigits)) {
		telefono = telDigits;
	} else {
		return { error: `TELEFONO inválido ("${telRaw}"): 9 dígitos o "NO TIENE".` };
	}

	const ocupacion = UP(g('OCUPACION')) || 'OTRO';

	return { data: { dni, nombre, apellido, edad, genero, discapacidad, telefono, ocupacion } };
}

export const actions: Actions = {
	editar: async ({ request, locals }) => {
		await requireSuperadmin(locals);
		const f = await request.formData();
		const id = Number(f.get('id'));
		if (!id) return fail(400, { editError: 'Falta el visitante a editar.' });

		// Reusa parseRow: valida y normaliza igual que la carga masiva.
		const res = parseRow({
			DNI: f.get('dni'),
			NOMBRE: f.get('nombre'),
			APELLIDO: f.get('apellido'),
			EDAD: f.get('edad'),
			GENERO: f.get('genero'),
			DISCAPACIDAD: f.get('discapacidad'),
			TELEFONO: f.get('telefono'),
			OCUPACION: f.get('ocupacion')
		}, true);
		if ('error' in res) return fail(400, { editError: res.error });

		const { error } = await supabaseAdmin.from('visitantes').update(res.data).eq('id', id);
		if (error) {
			const msg =
				error.code === '23505'
					? `Ya existe otro visitante con el DNI ${res.data.dni} en este CAD.`
					: `No se pudo guardar: ${error.message}`;
			return fail(400, { editError: msg });
		}
		return { editOk: true };
	},
	subir: async ({ request, locals }) => {
		await requireSuperadmin(locals);
		const form = await request.formData();
		const cadId = Number(form.get('cad'));
		const archivo = form.get('archivo');

		if (!cadId) return fail(400, { error: 'Elige un CAD primero.' });
		if (!(archivo instanceof File) || archivo.size === 0)
			return fail(400, { error: 'Adjunta un archivo .xlsx o .csv.' });

		// Parseo del archivo (xlsx o csv) con SheetJS. raw:false → valores como texto visible.
		let rows: Record<string, unknown>[];
		try {
			const buf = new Uint8Array(await archivo.arrayBuffer());
			const wb = XLSX.read(buf, { type: 'array' });
			const ws = wb.Sheets[wb.SheetNames[0]];
			rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
		} catch {
			return fail(400, { error: 'No se pudo leer el archivo. ¿Es un .xlsx o .csv válido?' });
		}
		if (rows.length === 0) return fail(400, { error: 'El archivo no tiene filas de datos.' });

		// Valida cada fila; junta válidas y errores (con número de fila del Excel: +2 por encabezado).
		const validos: Visitante[] = [];
		const errores: string[] = [];
		const vistosEnArchivo = new Set<string>();
		rows.forEach((r, i) => {
			const res = parseRow(r);
			if ('error' in res) {
				errores.push(`Fila ${i + 2}: ${res.error}`);
			} else if (vistosEnArchivo.has(res.data.dni)) {
				errores.push(`Fila ${i + 2}: DNI ${res.data.dni} repetido dentro del archivo.`);
			} else {
				vistosEnArchivo.add(res.data.dni);
				validos.push(res.data);
			}
		});

		// Quita los que ya existen en el CAD (unicidad por (cad_id, dni)).
		const { data: yaExisten } = await supabaseAdmin
			.from('visitantes')
			.select('dni')
			.eq('cad_id', cadId);
		const existentes = new Set((yaExisten ?? []).map((v) => v.dni));
		const aInsertar = validos.filter((v) => !existentes.has(v.dni));
		const duplicadosBD = validos.length - aInsertar.length;

		let insertados = 0;
		if (aInsertar.length > 0) {
			const { error, count } = await supabaseAdmin
				.from('visitantes')
				.insert(aInsertar.map((v) => ({ ...v, cad_id: cadId })), { count: 'exact' });
			if (error) return fail(400, { error: `Error al guardar: ${error.message}`, errores });
			insertados = count ?? aInsertar.length;
		}

		return {
			ok: true,
			insertados,
			duplicadosBD,
			conError: errores.length,
			errores: errores.slice(0, 50)
		};
	}
};
