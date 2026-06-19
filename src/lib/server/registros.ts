import type { SupabaseClient } from '@supabase/supabase-js';

export type Filtro = {
	cad: string; // id o "all"
	modo: 'dia' | 'mes' | 'anio';
	valor: string; // YYYY-MM-DD | YYYY-MM | YYYY
};

export type FilaReporte = {
	visitanteId: number;
	fechaIso: string; // YYYY-MM-DD (para borrar el grupo visitante-día)
	cad: string;
	fecha: string; // DD/MM/AAAA
	nombreCompleto: string;
	edad: number | null;
	genero: string;
	discapacidad: string;
	minutos: number | null;
	telefono: string;
	dni: string;
	ocupacion: string;
	estado: string;
};

function hoyLima(): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
}

// Filtro desde los query params, con valores por defecto según el modo.
export function leerFiltro(url: URL): Filtro {
	const hoy = hoyLima();
	const modo = (url.searchParams.get('modo') ?? 'dia') as Filtro['modo'];
	const cad = url.searchParams.get('cad') ?? 'all';
	let valor = url.searchParams.get('valor') ?? '';
	if (!valor) {
		if (modo === 'dia') valor = hoy;
		else if (modo === 'mes') valor = hoy.slice(0, 7);
		else valor = hoy.slice(0, 4);
	}
	return { cad, modo, valor };
}

const flat = <T>(v: T | T[]): T | undefined => (Array.isArray(v) ? v[0] : v);

function ddmmaaaa(fechaIso: string): string {
	return fechaIso.split('-').reverse().join('/');
}

function rango(modo: Filtro['modo'], valor: string): [string, string] | null {
	if (!valor) return null;
	if (modo === 'dia') return [valor, valor];
	if (modo === 'mes') {
		const [y, m] = valor.split('-').map(Number);
		const last = new Date(y, m, 0).getDate(); // último día del mes
		return [`${valor}-01`, `${valor}-${String(last).padStart(2, '0')}`];
	}
	// anio
	return [`${valor}-01-01`, `${valor}-12-31`];
}

// Borra los registros que coinciden con el filtro (mismo criterio que el reporte).
// Conserva los visitantes (quedan como recurrentes). Devuelve cuántos borró.
// Requiere un cliente que pueda saltarse RLS (service_role).
export async function borrarRegistros(
	supabase: SupabaseClient,
	filtro: Filtro
): Promise<{ count: number; error: string | null }> {
	const r = rango(filtro.modo, filtro.valor);
	if (!r) return { count: 0, error: 'Filtro de fecha inválido.' };

	let q = supabase.from('registros').delete({ count: 'exact' }).gte('fecha', r[0]).lte('fecha', r[1]);
	if (filtro.cad && filtro.cad !== 'all') q = q.eq('cad_id', Number(filtro.cad));

	const { count, error } = await q;
	return { count: count ?? 0, error: error ? error.message : null };
}

// Lee registros aplicando filtros y los mapea a las columnas del reporte (§4).
export async function fetchReporte(
	supabase: SupabaseClient,
	filtro: Filtro
): Promise<FilaReporte[]> {
	let q = supabase
		.from('registros')
		.select(
			'visitante_id, fecha, minutos, estado, hora_entrada, cads(nombre), visitantes(nombre, apellido, edad, genero, discapacidad, telefono, dni, ocupacion)'
		)
		.order('fecha', { ascending: false })
		.order('hora_entrada', { ascending: false });

	if (filtro.cad && filtro.cad !== 'all') q = q.eq('cad_id', Number(filtro.cad));

	const r = rango(filtro.modo, filtro.valor);
	if (r) q = q.gte('fecha', r[0]).lte('fecha', r[1]);

	const { data } = await q;

	// Colapsa a una fila por (visitante, fecha): suma minutos de las visitas
	// finalizadas; si alguna sigue abierta, el estado del día es "en_curso".
	const grupos = new Map<string, FilaReporte & { _min: number; _hayMin: boolean }>();
	for (const row of data ?? []) {
		const v = flat(row.visitantes) as
			| {
					nombre: string;
					apellido: string;
					edad: number;
					genero: string;
					discapacidad: string;
					telefono: string;
					dni: string;
					ocupacion: string;
			  }
			| undefined;
		const cad = flat(row.cads) as { nombre: string } | undefined;
		const visitanteId = row.visitante_id as number;
		const fechaIso = row.fecha as string;
		const key = `${visitanteId}|${fechaIso}`;
		const min = row.minutos as number | null;

		let g = grupos.get(key);
		if (!g) {
			g = {
				visitanteId,
				fechaIso,
				cad: cad?.nombre ?? '',
				fecha: ddmmaaaa(fechaIso),
				nombreCompleto: `${v?.nombre ?? ''} ${v?.apellido ?? ''}`.trim(),
				edad: v?.edad ?? null,
				genero: v?.genero ?? '',
				discapacidad: v?.discapacidad ?? '',
				minutos: null,
				telefono: v?.telefono ?? '',
				dni: v?.dni ?? '',
				ocupacion: v?.ocupacion ?? '',
				estado: 'finalizado',
				_min: 0,
				_hayMin: false
			};
			grupos.set(key, g);
		}
		if (min != null) {
			g._min += min;
			g._hayMin = true;
		}
		if (row.estado === 'en_curso') g.estado = 'en_curso';
	}

	return [...grupos.values()].map(({ _min, _hayMin, ...fila }) => ({
		...fila,
		minutos: _hayMin ? _min : null
	}));
}
