import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function RegistroPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  // Quien ya tiene organización no vuelve por aquí.
  if (profile?.client_id) redirect('/');
  if (profile?.role === 'admin') redirect('/admin');

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <h1 className="text-xl font-semibold mb-2">Falta un paso</h1>
        <p className="text-sm text-slate-500 mb-6">
          Para poder trabajar contigo necesitamos saber a nombre de quién va el proyecto.
        </p>

        <div className="space-y-3">
          <Link
            href="/registro/empresa"
            className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-400"
          >
            <div className="font-medium text-sm mb-1">Registrar mi organización</div>
            <p className="text-sm text-slate-500">
              Eres el primero de tu empresa (o trabajas como persona natural). Vas a necesitar el
              RUT y la cédula a la mano.
            </p>
          </Link>

          <Link
            href="/registro/unirme"
            className="block bg-white border border-slate-200 rounded-lg p-5 hover:border-blue-400"
          >
            <div className="font-medium text-sm mb-1">Unirme a una organización ya registrada</div>
            <p className="text-sm text-slate-500">
              Alguien de tu empresa ya la registró. Solo necesitas su NIT; quien la registró
              aprobará tu ingreso.
            </p>
          </Link>
        </div>

        <form action="/logout" method="post" className="mt-6 text-center">
          <button className="text-sm text-slate-500 hover:underline cursor-pointer" type="submit">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
