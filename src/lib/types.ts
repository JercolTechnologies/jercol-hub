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
  | 'en_progreso'
  | 'en_revision'
  | 'hecho';

export type TicketType = 'feature' | 'bug' | 'mejora';
export type TicketPriority = 'baja' | 'media' | 'alta';

export interface Ticket {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  created_by: string | null;
  created_at: string;
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

export const COLUMNS: { key: TicketStatus; label: string }[] = [
  { key: 'solicitudes', label: 'Solicitudes' },
  { key: 'backlog', label: 'Backlog' },
  { key: 'en_progreso', label: 'En progreso' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'hecho', label: 'Hecho' },
];
