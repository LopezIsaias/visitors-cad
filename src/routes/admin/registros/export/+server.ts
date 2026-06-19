import * as XLSX from 'xlsx';
import { requireSuperadmin } from '$lib/server/auth';
import { fetchReporte, leerFiltro } from '$lib/server/registros';
import type { RequestHandler } from './$types';

// Encabezados exactos del reporte (§4), en orden.
const HEADERS = [
	'Nombre del CAD',
	'Fecha',
	'Nombre Completo',
	'Edad',
	'Género',
	'Discapacidad',
	'Tiempo de Uso (min)',
	'Teléfono',
	'DNI',
	'Cargo/Profesión'
];

const up = (s: string) => s.toUpperCase();

export const GET: RequestHandler = async ({ locals, url }) => {
	await requireSuperadmin(locals);
	const filtro = leerFiltro(url);
	const filas = await fetchReporte(locals.supabase, filtro);

	const aoa = [
		HEADERS,
		...filas.map((f) => [
			up(f.cad),
			f.fecha,
			up(f.nombreCompleto),
			f.edad ?? '',
			up(f.genero),
			up(f.discapacidad),
			f.minutos ?? '',
			up(f.telefono),
			f.dni,
			up(f.ocupacion)
		])
	];

	const ws = XLSX.utils.aoa_to_sheet(aoa);
	ws['!cols'] = [
		{ wch: 32 }, { wch: 12 }, { wch: 28 }, { wch: 6 }, { wch: 11 },
		{ wch: 13 }, { wch: 18 }, { wch: 12 }, { wch: 11 }, { wch: 24 }
	];
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Registros');

	const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
	const nombre = `registros_${filtro.modo}_${filtro.valor}.xlsx`;

	return new Response(buf, {
		headers: {
			'Content-Type':
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${nombre}"`
		}
	});
};
