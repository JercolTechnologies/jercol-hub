export type Role = 'admin' | 'client';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  client_id: string | null;
  created_at: string;
}

export interface ClientRow {
  id: string;
  name: string;
  archived: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  created_at: string;
}

export type TicketStatus =
  | 'solicitudes'
  | 'backlog'
  | 'en_desarrollo'
  | 'en_revision'
  | 'hecho';

export type TicketType = 'feature' | 'bug' | 'mejora';
export type TicketPriority = 'baja' | 'media' | 'alta';
export type DatePreset = 'esta_semana' | 'proximas_2_semanas' | 'este_mes' | 'sin_prisa';

export interface Ticket {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  date_preset: DatePreset | null;
  desired_date: string | null;
  created_by: string | null;
  created_at: string;
  last_activity_at: string;
  // Embebido via join a profiles (created_by -> profiles.id)
  author?: { full_name: string | null } | null;
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author?: { full_name: string | null } | null;
}

export interface Attachment {
  id: string;
  ticket_id: string;
  uploaded_by: string | null;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  content_type: string | null;
  created_at: string;
}

export interface IdeaAttachment {
  id: string;
  idea_id: string;
  uploaded_by: string | null;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  content_type: string | null;
  created_at: string;
}

export type IdeaStatus = 'nueva' | 'en_conversacion' | 'convertida' | 'descartada';

export interface ProjectIdea {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: IdeaStatus;
  created_by: string | null;
  created_at: string;
  clients?: { name: string } | null;
}

export interface ProjectIdeaComment {
  id: string;
  idea_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author?: { full_name: string | null } | null;
}

export const COLUMNS: { key: TicketStatus; label: string }[] = [
  { key: 'solicitudes', label: 'Solicitudes' },
  { key: 'backlog', label: 'Backlog' },
  { key: 'en_desarrollo', label: 'En Desarrollo' },
  { key: 'en_revision', label: 'En Revisión' },
  { key: 'hecho', label: 'Hecho' },
];

export const COLUMN_HELP: Record<TicketStatus, string> = {
  solicitudes: 'El cliente pide algo aquí, sin filtro. Todavía no ha sido aceptado.',
  backlog: 'Ya se aceptó y está en cola de prioridad. Todavía no se está trabajando.',
  en_desarrollo: 'Se está construyendo activamente en este momento.',
  en_revision: 'Terminado del lado del desarrollador, esperando revisión del cliente.',
  hecho: 'Aprobado por el cliente. Cerrado.',
};

export const DATE_PRESET_LABEL: Record<DatePreset, string> = {
  esta_semana: 'Esta semana',
  proximas_2_semanas: 'Próximas 2 semanas',
  este_mes: 'Este mes',
  sin_prisa: 'Sin prisa',
};
