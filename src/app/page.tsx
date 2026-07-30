import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Project } from '@/lib/types';

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (!profile) {
    redirect('/login');
  }

  if (profile.role === 'admin') {
    redirect('/admin');
  }

  if (!profile.client_id) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold mb-2">Cuenta creada</h1>
          <p className="text-sm text-slate-500 mb-4">
            Tu cuenta está pendiente de que un administrador te asigne a tu proyecto. Te
            avisaremos apenas quede lista.
          </p>
          <form action="/logout" method="post">
            <button className="text-sm text-blue-600 hover:underline" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('client_id', profile.client_id)
    .order('created_at', { ascending: true })
    .returns<Project[]>();

  if (projects && projects.length === 1) {
    redirect(`/board/${projects[0].id}`);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Tus proyectos</h1>
          <form action="/logout" method="post">
            <button className="text-sm text-slate-500 hover:underline" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
        {(!projects || projects.length === 0) && (
          <p className="text-sm text-slate-500">
            Todavía no tienes proyectos asignados.
          </p>
        )}
        <ul className="space-y-2">
          {projects?.map((p) => (
            <li key={p.id}>
              <Link
                href={`/board/${p.id}`}
                className="block bg-white border border-slate-200 rounded-lg px-4 py-3 hover:border-blue-400"
              >
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
