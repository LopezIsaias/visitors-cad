import type { SupabaseClient } from '@supabase/supabase-js';

export type Filtro = {
	cad: string; // id o "all"
	modo: 'dia' | 'mes' | 'anio';
	valor: string; // YYYY-MM-DD | YYYY-MM | YYYY
};

export type FilaReporte = {
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

// Lee registros aplicando filtros y los mapea a las columnas del reporte (§4).
export async function fetchReporte(
	supabase: SupabaseClient,
	filtro: Filtro
): Promise<FilaReporte[]> {
	let q = supabase
		.from('registros')
		.select(
			'fecha, minutos, estado, hora_entrada, cads(nombre), visitantes(nombre, apellido, edad, genero, discapacidad, telefono, dni, ocupacion)'
		)
		.order('fecha', { ascending: false })
		.order('hora_entrada', { ascending: false });

	if (filtro.cad && filtro.cad !== 'all') q = q.eq('cad_id', Number(filtro.cad));

	const r = rango(filtro.modo, filtro.valor);
	if (r) q = q.gte('fecha', r[0]).lte('fecha', r[1]);

	const { data } = await q;

	return (data ?? []).map((row) => {
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
		return {
			cad: cad?.nombre ?? '',
			fecha: ddmmaaaa(row.fecha as string),
			nombreCompleto: `${v?.nombre ?? ''} ${v?.apellido ?? ''}`.trim(),
			edad: v?.edad ?? null,
			genero: v?.genero ?? '',
			discapacidad: v?.discapacidad ?? '',
			minutos: (row.minutos as number | null) ?? null,
			telefono: v?.telefono ?? '',
			dni: v?.dni ?? '',
			ocupacion: v?.ocupacion ?? '',
			estado: row.estado as string
		};
	});
}
