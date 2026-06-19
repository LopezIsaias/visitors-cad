<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let editId = $state<number | null>(null);
	let msg = $state<string | null>(null);
	let err = $state<string | null>(null);

	function submit(okMsg: string) {
		return () =>
			async ({ result, update }: { result: any; update: () => Promise<void> }) => {
				if (result.type === 'success' && result.data?.ok) {
					await invalidateAll();
					msg = okMsg;
					err = null;
					editId = null;
				} else if (result.type === 'failure') {
					err = result.data?.error ?? 'Error.';
				} else await update();
			};
	}
</script>

<svelte:head><title>CADs — Admin</title></svelte:head>

<header class="head">
	<div><p class="eyebrow">GESTIÓN</p><h1>CADs <span class="count">{data.cads.length}</span></h1></div>
</header>

{#if msg}<p class="ok" role="status">{msg}</p>{/if}
{#if err}<p class="err" role="alert">{err}</p>{/if}

<form class="nuevo" method="POST" action="?/crear" use:enhance={submit('CAD creado.')}>
	<input name="nombre" class="up" placeholder="Nombre del nuevo CAD" required />
	<button type="submit">+ Crear CAD</button>
</form>

<div class="tablewrap">
	<table>
		<thead><tr><th>Nombre</th><th class="acc">Acción</th></tr></thead>
		<tbody>
			{#each data.cads as cad (cad.id)}
				<tr>
					<td>
						{#if editId === cad.id}
							<form id="ed{cad.id}" method="POST" action="?/editar" use:enhance={submit('CAD actualizado.')}>
								<input type="hidden" name="id" value={cad.id} />
								<input name="nombre" class="up" value={cad.nombre} required />
							</form>
						{:else}
							{cad.nombre}
						{/if}
					</td>
					<td class="acc">
						{#if editId === cad.id}
							<button type="submit" form="ed{cad.id}" class="mini primary">Guardar</button>
							<button type="button" class="mini" onclick={() => (editId = null)}>Cancelar</button>
						{:else}
							<button type="button" class="mini" onclick={() => { editId = cad.id; err = null; }}>Editar</button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.head { margin-bottom: 1.4rem; }
	.eyebrow { margin: 0; font-size: 0.66rem; letter-spacing: 0.18em; color: var(--river); font-weight: 700; }
	h1 { font-family: var(--display); margin: 0.15rem 0 0; font-size: 1.7rem; display: flex; align-items: center; gap: 0.5rem; }
	.count { background: var(--canopy); color: var(--paper); font-size: 0.8rem; border-radius: 999px; padding: 0.1rem 0.6rem; }
	.ok { background: rgba(31,184,166,0.14); border-left: 3px solid var(--river); border-radius: 8px; padding: 0.65rem 0.85rem; margin: 0 0 1rem; }
	.err { background: rgba(192,57,43,0.08); border-left: 3px solid var(--danger); color: var(--danger); border-radius: 8px; padding: 0.65rem 0.85rem; margin: 0 0 1rem; }
	.nuevo { display: flex; gap: 0.6rem; margin-bottom: 1.4rem; max-width: 40rem; }
	.nuevo input { flex: 1; padding: 0.7rem 0.85rem; border: 1.5px solid var(--mist); border-radius: 10px; }
	.nuevo button { background: var(--canopy); color: var(--paper); border: none; border-radius: 10px; padding: 0 1.1rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
	.tablewrap { border: 1px solid var(--mist); border-radius: 12px; overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
	th, td { padding: 0.6rem 0.9rem; text-align: left; border-bottom: 1px solid var(--mist); }
	thead th { background: var(--paper); font-size: 0.74rem; text-transform: uppercase; color: var(--muted); }
	tbody tr:last-child td { border-bottom: none; }
	td input { width: 100%; padding: 0.45rem 0.6rem; border: 1.5px solid var(--river); border-radius: 8px; }
	.acc { white-space: nowrap; text-align: right; }
	.mini { border: 1.5px solid var(--mist); background: #fff; border-radius: 8px; padding: 0.4rem 0.7rem; cursor: pointer; margin-left: 0.3rem; font-size: 0.82rem; }
	.mini.primary { background: var(--canopy); color: var(--paper); border-color: var(--canopy); }
	.up { text-transform: uppercase; }
</style>
