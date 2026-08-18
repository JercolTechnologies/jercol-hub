import Link from 'next/link';
import { redirect } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import ClientDocLink from '@/components/ClientDocLink';
import { createClient } from '@/lib/supabase/server';
import {
  CLIENT_DOC_LABEL,
  CLIENT_STATUS_LABEL,
  type ClientContact,
  type ClientDocument,
  type ClientRow,
  type Profile,
  type Project,
} from '@/lib/types';
import {
  createProject,
  assignUser,
  setClientArchived,
  addContact,
  deleteContact,
  setProjectStatus,
  linkContactProfile,
  verificarCliente,
  reabrirVerificacion,
} from './actions';

type ProjectWithClient = Project & { clients: { name: string } | null };

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Un solo nivel para las seis. Si quien entra no es admin, RLS le devuelve
  // conjuntos vacíos o filtrados y el redirect de abajo lo saca igual.
  const [
    { data: profile },
    { data: clients },
    { data: pending },
    { data: projects },
    { data: contacts },
    { data: assignedUsers },
    { data: docs },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single<Profile>(),
    supabase.from('clients').select('*').order('name').returns<ClientRow[]>(),
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .is('client_id', null)
      .returns<Profile[]>(),
    supabase
      .from('projects')
      .select('*, clients(name)')
      .order('created_at', { ascending: true })
      .returns<ProjectWithClient[]>(),
    supabase
      .from('client_contacts')
      .select('*')
      .order('created_at', { ascending: true })
      .returns<ClientContact[]>(),
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .not('client_id', 'is', null)
      .returns<Profile[]>(),
    supabase
      .from('client_documents')
      .select('*')
      .order('created_at', { ascending: true })
      .returns<ClientDocument[]>(),
  ]);

  if (!profile || profile.role !== 'admin') redirect('/');

  const allClients = clients || [];
  const porVerificar = allClients.filter((c) => c.status === 'pendiente' && !c.archived);
  const rechazados = allClients.filter((c) => c.status === 'rechazado' && !c.archived);
  const activeClients = allClients.filter((c) => !c.archived && c.status === 'verificado');
  const archivedClients = allClients.filter((c) => c.archived);

  const docsByClient = new Map<string, ClientDocument[]>();
  (docs || []).forEach((d) => {
    const list = docsByClient.get(d.client_id) || [];
    list.push(d);
    docsByClient.set(d.client_id, list);
  });
  const projectsByClient = new Map<string, ProjectWithClient[]>();
  (projects || []).forEach((p) => {
    const list = projectsByClient.get(p.client_id) || [];
    list.push(p);
    projectsByClient.set(p.client_id, list);
  });
  const contactsByClient = new Map<string, ClientContact[]>();
  (contacts || []).forEach((c) => {
    const list = contactsByClient.get(c.client_id) || [];
    list.push(c);
    contactsByClient.set(c.client_id, list);
  });

  // Cuentas ya asignadas a un cliente, para poder vincularlas a un contacto.
  const usersByClient = new Map<string, Profile[]>();
  (assignedUsers || []).forEach((u) => {
    if (!u.client_id) return;
    const list = usersByClient.get(u.client_id) || [];
    list.push(u);
    usersByClient.set(u.client_id, list);
  });

  function ClientCard({ c }: { c: ClientRow }) {
    const rechazado = c.status === 'rechazado';

    return (
      <div
        className={`bg-tarjeta border rounded-lg p-4 ${
          rechazado ? 'border-alerta/30' : 'border-borde'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="font-medium flex items-center gap-2">
              {c.name}
              {/* El estado siempre visible: un cliente rechazado se veía igual
                  que uno verificado y eso llevaba a operar con él sin querer. */}
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${
                  rechazado ? 'bg-alerta-fondo text-alerta' : 'bg-exito-fondo text-exito'
                }`}
              >
                {CLIENT_STATUS_LABEL[c.status]}
              </span>
            </h3>
            {c.tax_id && <div className="text-xs text-tinta-suave">{c.tax_id}</div>}
          </div>
          <form action={setClientArchived.bind(null, c.id, !c.archived)}>
            <button type="submit" className="text-xs text-tinta-suave hover:underline cursor-pointer">
              {c.archived ? 'Desarchivar' : 'Archivar'}
            </button>
          </form>
        </div>

        {rechazado && (
          <div className="text-xs bg-alerta-fondo text-alerta rounded px-3 py-2 mb-3">
            <div className="font-medium mb-1">Motivo: {c.rejection_reason || 'sin motivo'}</div>
            El cliente puede corregir y reenviar. También puedes devolverlo tú a la cola.
            <form action={reabrirVerificacion.bind(null, c.id)} className="mt-2">
              <button className="text-xs px-2.5 py-1 rounded bg-tarjeta border border-alerta/30 hover:bg-alerta-fondo cursor-pointer">
                Devolver a pendiente
              </button>
            </form>
          </div>
        )}
        <ul className="space-y-1 mb-3">
          {(projectsByClient.get(c.id) || []).map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <Link href={`/board/${p.id}`} className="text-sm text-azul hover:underline">
                {p.name}
              </Link>
              {p.status === 'terminado' && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-lienzo text-tinta-suave">
                  Terminado
                </span>
              )}
              <form
                action={setProjectStatus.bind(
                  null,
                  p.id,
                  p.status === 'terminado' ? 'activo' : 'terminado'
                )}
                className="ml-auto"
              >
                <button type="submit" className="text-[11px] text-tinta-suave/80 hover:underline">
                  {p.status === 'terminado' ? 'Reabrir' : 'Marcar terminado'}
                </button>
              </form>
            </li>
          ))}
          {(projectsByClient.get(c.id) || []).length === 0 && (
            <li className="text-sm text-tinta-suave/80">Sin proyectos todavía.</li>
          )}
        </ul>
        {/* Solo se crean proyectos para clientes verificados. La base de datos
            también lo impide (trigger de la migración 013), pero mostrar el
            formulario invitaba a intentarlo. */}
        {!c.archived && c.status === 'verificado' && (
          <form action={createProject.bind(null, c.id)} className="flex gap-2 mb-4">
            <input
              type="text"
              name="name"
              required
              placeholder="Nuevo proyecto"
              className="flex-1 rounded border border-borde px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded bg-lienzo text-tinta text-sm px-3 py-1.5 hover:bg-lienzo"
            >
              + Proyecto
            </button>
          </form>
        )}

        <details className="border-t border-borde pt-3">
          <summary className="text-xs font-semibold text-tinta-suave cursor-pointer">
            Contactos ({(contactsByClient.get(c.id) || []).length})
            {!(contactsByClient.get(c.id) || []).some((ct) => ct.is_legal_rep) && (
              <span className="ml-2 text-aviso font-normal">· falta el representante legal</span>
            )}
          </summary>

          <ul className="space-y-3 mt-2 mb-3">
            {(contactsByClient.get(c.id) || []).map((ct) => (
              <li key={ct.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <span>{ct.full_name}</span>
                  {ct.is_legal_rep && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-azul/10 text-azul font-semibold">
                      Rep. legal
                    </span>
                  )}
                  {ct.role_label && <span className="text-xs text-tinta-suave/80">{ct.role_label}</span>}
                  {ct.phone && (
                    <a
                      href={`https://wa.me/${ct.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-exito hover:underline"
                    >
                      WhatsApp
                    </a>
                  )}
                  <form action={deleteContact.bind(null, ct.id)} className="ml-auto">
                    <button
                      type="submit"
                      className="text-[11px] text-alerta hover:underline cursor-pointer"
                    >
                      eliminar
                    </button>
                  </form>
                </div>

                <form
                  action={linkContactProfile.bind(null, ct.id)}
                  className="flex items-center gap-2 mt-1"
                >
                  <span className="text-[11px] text-tinta-suave/80">Cuenta:</span>
                  <select
                    name="profile_id"
                    defaultValue={ct.profile_id || ''}
                    className="text-xs rounded border border-borde px-1.5 py-1"
                  >
                    <option value="">Sin vincular</option>
                    {(usersByClient.get(c.id) || []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="text-[11px] text-azul hover:underline cursor-pointer"
                  >
                    vincular
                  </button>
                  {!ct.profile_id && ct.is_legal_rep && (
                    <span className="text-[11px] text-aviso">
                      sin cuenta vinculada no puede firmar
                    </span>
                  )}
                </form>
              </li>
            ))}
            {(contactsByClient.get(c.id) || []).length === 0 && (
              <li className="text-sm text-tinta-suave/80">Sin contactos todavía.</li>
            )}
          </ul>

          <form action={addContact.bind(null, c.id)} className="space-y-2 border-t border-borde pt-3">
            <div className="text-xs font-semibold text-tinta-suave">Agregar contacto nuevo</div>
            <div className="flex gap-2">
              <input
                type="text"
                name="full_name"
                required
                placeholder="Nombre completo"
                className="flex-1 rounded border border-borde px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                name="phone"
                placeholder="Teléfono (con indicativo, ej. 57300...)"
                className="flex-1 rounded border border-borde px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="email"
                name="email"
                placeholder="Correo (opcional)"
                className="flex-1 rounded border border-borde px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                name="role_label"
                placeholder="Cargo (opcional)"
                className="flex-1 rounded border border-borde px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-tinta">
                <input type="checkbox" name="is_legal_rep" />
                Representante legal
              </label>
              <button
                type="submit"
                className="ml-auto rounded bg-negro-suave text-white text-sm px-3 py-1.5 hover:bg-negro cursor-pointer"
              >
                Guardar contacto
              </button>
            </div>
          </form>
        </details>
      </div>
    );
  }

  return (
    <>
      <AppHeader isAdmin />
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <h1 className="text-xl font-semibold mb-8">Panel de administración</h1>

        {porVerificar.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-tinta-suave uppercase tracking-wide mb-3">
              Registros por verificar ({porVerificar.length})
            </h2>
            <p className="text-sm text-tinta-suave mb-3">
              Coteja el documento declarado contra el RUT y la cédula. Hasta que no verifiques,
              este cliente no puede firmar contratos.
            </p>

            <div className="space-y-4">
              {porVerificar.map((c) => (
                <div key={c.id} className="bg-tarjeta border border-aviso/30 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-medium">{c.name}</h3>
                      <div className="text-xs text-tinta-suave">
                        {c.kind === 'juridica' ? 'Empresa' : 'Persona natural'} · {c.tax_id}
                      </div>
                    </div>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-aviso-fondo text-aviso font-semibold shrink-0">
                      {CLIENT_STATUS_LABEL[c.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-tinta mb-3">
                    {c.city && (
                      <div>
                        <span className="text-tinta-suave/80">Ciudad:</span> {c.city}
                      </div>
                    )}
                    {c.phone && (
                      <div>
                        <span className="text-tinta-suave/80">Teléfono:</span> {c.phone}
                      </div>
                    )}
                    {c.address && (
                      <div className="col-span-2">
                        <span className="text-tinta-suave/80">Dirección:</span> {c.address}
                      </div>
                    )}
                    {(contactsByClient.get(c.id) || [])
                      .filter((ct) => ct.is_legal_rep)
                      .map((ct) => (
                        <div key={ct.id} className="col-span-2">
                          <span className="text-tinta-suave/80">Representante legal:</span>{' '}
                          {ct.full_name} {ct.role_label ? `(${ct.role_label})` : ''}
                          {ct.profile_id ? ' · cuenta vinculada' : ' · sin cuenta vinculada'}
                        </div>
                      ))}
                    {c.data_consent_at && (
                      <div className="col-span-2 text-tinta-suave/80">
                        Autorizó el tratamiento de datos el{' '}
                        {new Date(c.data_consent_at).toLocaleDateString('es')}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-borde pt-3 mb-3">
                    <div className="text-xs font-semibold text-tinta-suave mb-1">Documentos</div>
                    <ul className="space-y-1">
                      {(docsByClient.get(c.id) || []).map((d) => (
                        <li key={d.id}>
                          <ClientDocLink
                            path={d.storage_path}
                            label={`${CLIENT_DOC_LABEL[d.kind]} — ${d.file_name}`}
                          />
                        </li>
                      ))}
                      {(docsByClient.get(c.id) || []).length === 0 && (
                        <li className="text-xs text-tinta-suave/80">Sin documentos adjuntos.</li>
                      )}
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-borde pt-3">
                    <form action={verificarCliente.bind(null, c.id)}>
                      <input type="hidden" name="decision" value="aprobar" />
                      <button className="text-sm px-3 py-1.5 rounded bg-verde-oscuro text-white hover:bg-exito cursor-pointer">
                        Verificar
                      </button>
                    </form>

                    <form
                      action={verificarCliente.bind(null, c.id)}
                      className="flex gap-2 items-center flex-1"
                    >
                      <input type="hidden" name="decision" value="rechazar" />
                      <input
                        type="text"
                        name="rejection_reason"
                        placeholder="Motivo del rechazo (se le muestra al cliente)"
                        className="flex-1 rounded border border-borde px-2 py-1.5 text-sm"
                      />
                      <button className="text-sm px-3 py-1.5 rounded border border-borde hover:bg-lienzo cursor-pointer">
                        Rechazar
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/*
          Ya no se crean clientes a mano: los registra el propio cliente con su
          expediente y aquí solo se verifican. El formulario de "asignar
          usuario" también desapareció — quien se registra queda ligado a su
          organización, y a los demás los aprueba el responsable de esa cuenta.

          Se conserva la asignación manual como salida de emergencia para
          cuentas que quedaron sueltas antes de este cambio.
        */}
        {pending && pending.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-tinta-suave uppercase tracking-wide mb-3">
              Cuentas sin organización ({pending.length})
            </h2>
            <p className="text-sm text-tinta-suave mb-3">
              Se registraron pero no completaron el alta. Normalmente se resuelve solo cuando
              entran; asígnalas a mano únicamente si quedaron atascadas.
            </p>
            <div className="space-y-2">
              {pending.map((p) => (
                <form
                  key={p.id}
                  action={assignUser}
                  className="flex items-center gap-2 bg-tarjeta border border-borde rounded-lg px-4 py-2"
                >
                  <input type="hidden" name="user_id" value={p.id} />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{p.full_name || 'Sin nombre'}</div>
                    <div className="text-tinta-suave">{p.email}</div>
                  </div>
                  <select
                    name="client_id"
                    required
                    className="rounded border border-borde text-sm px-2 py-1"
                  >
                    <option value="">Asignar a...</option>
                    {activeClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded bg-negro-suave text-white text-sm px-3 py-1 hover:bg-negro cursor-pointer"
                  >
                    Asignar
                  </button>
                </form>
              ))}
            </div>
          </section>
        )}

      <section className="mb-10">
        <h2 className="text-sm font-semibold text-tinta-suave uppercase tracking-wide mb-3">
          Clientes y proyectos
        </h2>
        {activeClients.length === 0 && (
          <p className="text-sm text-tinta-suave">Crea tu primer cliente arriba.</p>
        )}
        <div className="space-y-6">
          {activeClients.map((c) => (
            <ClientCard key={c.id} c={c} />
          ))}
        </div>
      </section>

        {rechazados.length > 0 && (
          <details className="mb-10">
            <summary className="text-sm font-semibold text-tinta-suave uppercase tracking-wide mb-3 cursor-pointer">
              Rechazados ({rechazados.length})
            </summary>
            <div className="space-y-6 mt-3">
              {rechazados.map((c) => (
                <ClientCard key={c.id} c={c} />
              ))}
            </div>
          </details>
        )}

        {archivedClients.length > 0 && (
          <details className="mb-10">
            <summary className="text-sm font-semibold text-tinta-suave uppercase tracking-wide mb-3 cursor-pointer">
              Archivados ({archivedClients.length})
            </summary>
            <div className="space-y-6 mt-3">
              {archivedClients.map((c) => (
                <ClientCard key={c.id} c={c} />
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  );
}
