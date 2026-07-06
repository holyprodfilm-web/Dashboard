export type View = 'home' | 'dashboard' | 'managerTasks' | 'objects' | 'detail' | 'users' | 'closure';

export type PaymentStatus = 'paid' | 'partial' | 'not_paid' | 'terminated';
export type MogaeStatus = 'Заходили' | 'В МОГЭ' | 'Не заходили ни разу';

export interface ClosureObject {
  id: number;
  omsu: string;
  object_name: string;
  contractor: string;
  payment_status: PaymentStatus;
  contract_sum: number;
  paid_sum: number;
  remaining_sum: number;
  mogae_status: MogaeStatus | null;
  typical_cause: string | null;
  typical_block: string | null;
  comment: string;
  actions: string;
  snapshot_date: string;
  created_at?: string;
}

export type TaskStatus = 'new' | 'in_progress' | 'completed' | 'overdue';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'contractor' | 'guest';
  districts?: string[] | null;
  created_at?: string;
}

export interface Meeting {
  id: number;
  title: string;
  protocol_number?: string;
  meeting_date: string;
  manager: string;
  selected_objects?: string[];
  created_at?: string;
}

export interface Task {
  id: number;
  meeting_id: number;
  object_uin: string;
  description: string;
  responsible?: string;
  responsible_org?: string;
  deadline?: string;
  status: TaskStatus;
  created_at?: string;
}

export interface Address {
  "Код УИН": string;
  "Наименование объекта": string;
  "Городской округ": string;
  "Руководитель проекта"?: string;
  [key: string]: string | undefined;
}

export interface MeetingAttachment {
  id: number;
  meeting_id: number;
  file_name: string;
  file_path: string;
  file_size?: number;
  uploaded_by?: string;
  created_at?: string;
}

export interface TaskLink {
  id: number;
  from_task_id: number;
  to_task_id: number;
  object_uin: string;
  created_at?: string;
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Руководитель проекта',
  contractor: 'Подрядчик',
  guest: 'Гость',
};

export const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  contractor: 'bg-emerald-100 text-emerald-700',
  guest: 'bg-slate-100 text-slate-700',
};

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'Новое', color: 'text-slate-700', bg: 'bg-slate-100' },
  in_progress: { label: 'В работе', color: 'text-amber-700', bg: 'bg-amber-100' },
  completed: { label: 'Исполнено', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  overdue: { label: 'Просрочено', color: 'text-[#E93A58]', bg: 'bg-[#FFF0F3]' },
};

export const ORGANIZATIONS = [
  'Министерство энергетики Московской области',
  'ГБУ МО «Мособлтепло»',
  'АО «МОЭК»',
  'ГКУ МО «Центр энергоэффективности»',
  'Фонд капитального ремонта МО',
  'Генподрядная организация',
  'Субподрядная организация',
  'Проектная организация',
];
