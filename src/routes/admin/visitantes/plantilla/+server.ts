import * as XLSX from 'xlsx';
import { requireSuperadmin } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const HEADERS = ['DNI', 'NOMBRE', 'APELLIDO', 'EDAD', 'GENERO', 'DISCAPACIDAD', 'TELEFONO', 'OCUPACION'];

// Filas de ejemplo (se borran antes de subir las reales).
const EJEMPLOS = [
	['12345678', 'JUAN', 'PEREZ QUISPE', 34, 'MASCULINO', 'NO', '987654321', 'AGRICULTOR(A)'],
	['25012006', 'MARIA', 'FLORES RAMOS', 19, 'FEMENINO', 'NO', 'NO TIENE', 'ESTUDIANTE']
];

export const GET: RequestHandler = async ({ locals }) => {
	await requireSuperadmin(locals);

	const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...EJEMPLOS]);
	// DNI y TELEFONO como texto para preservar ceros iniciales.
	for (let r = 1; r <= EJEMPLOS.length; r++) {
		for (const col of [0, 6]) {
			const ref = XLSX.utils.encode_cell({ r, c: col });
			if (ws[ref]) { ws[ref].t = 's'; ws[ref].z = '@'; }
		}
	}
	ws['!cols'] = [
		{ wch: 11 }, { wch: 16 }, { wch: 20 }, { wch: 6 }, { wch: 11 }, { wch: 13 }, { wch: 12 }, { wch: 22 }
	];
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Visitantes');

	const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
	return new Response(buf, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': 'attachment; filename="plantilla_visitantes.xlsx"'
		}
	});
};
