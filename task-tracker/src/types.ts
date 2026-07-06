export type View = 'home' | 'dashboard' | 'managerTasks' | 'objects' | 'detail' | 'users' | 'closure' | 'nts';

export type PaymentStatus = 'paid' | 'partial' | 'not_paid' | 'terminated';
export type MogaeStatus = 'Заходили' | 'В МОГЭ' | 'Не заходили ни разу';

export interface ClosureObject {
  id: number;
  uin: string | null;
  omsu: string;
  object_name: string;
  contractor: string;
  object_type: string | null;
  mogae_approved: string | null;
  mogae_status: MogaeStatus | null;
  typical_block: string | null;
  smr_completed: string | null;
  smr_pct: string | null;
  id_ks_submitted: string | null;
  payment_status: PaymentStatus;
  contract_sum: number;
  paid_sum: number;
  remaining_sum: number;
  typical_cause: string | null;
  typical_cause_smr: string | null;
  typical_cause_idks: string | null;
  payment_reason: string | null;
  payment_date: string | null;
  actions: string;
  comment: string;
  snapshot_date: string;
  created_at?: string;
}

export type TaskStatus = 'new' | 'in_progress' | 'completed' | 'overdue';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'analyst' | 'guest' | 'module_responsible';
  districts?: string[] | null;
  created_at?: string;
}

export type NtsStatus = 'rp_review' | 'vks_scheduled' | 'remarks_fix' | 'positive_mogae' | 'below_30';
export type NtsProtocolStatus = 'preparing' | 'msed' | 'sent_omsu';
export type NtsChecklistItemStatus = 'ok' | 'fail' | 'clarify' | 'na';
export type NtsRespondentRole = 'rp' | 'rp2' | 'responsible';

export interface NtsEntry {
  id: number;
  object_uin: string;
  object_name: string;
  contractor: string;
  contract_cost: number;
  pre_nts_cost: number;
  post_nts_cost: number | null;
  mogae_cost: number | null;
  rp_main_id: string | null;
  rp2_id: string | null;
  status: NtsStatus;
  protocol_number: string | null;
  protocol_date: string | null;
  protocol_status: NtsProtocolStatus | null;
  protocol_file_path: string | null;
  presentation_dates: string[];
  vks_dates: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface NtsSession {
  id: number;
  nts_entry_id: number;
  session_date: string;
  remarks: string | null;
  created_at: string;
  created_by: string | null;
}

export interface NtsDocRound {
  id: number;
  nts_entry_id: number;
  received_date: string;
  presentation_date: string | null;
  remarks_issued_at: string | null;
  remarks_resolved_contractor_at: string | null;
  remarks_resolved_district_at: string | null;
  checklist_approved: boolean;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export interface NtsChecklistItem {
  id: number;
  item_num: number;
  section_title: string | null;
  description: string;
  sort_order: number;
}

export interface NtsChecklistResponse {
  id: number;
  round_id: number;
  item_id: number;
  respondent_role: NtsRespondentRole;
  status: NtsChecklistItemStatus | null;
  comment: string | null;
  updated_at: string;
  updated_by: string | null;
}

export const NTS_STATUS_CONFIG: Record<NtsStatus, { label: string; color: string; bg: string }> = {
  rp_review:      { label: 'На проверке РП',          color: 'text-blue-700',    bg: 'bg-blue-50'    },
  vks_scheduled:  { label: 'Назначен ВКС',             color: 'text-violet-700',  bg: 'bg-violet-50'  },
  remarks_fix:    { label: 'Устранение замечаний',     color: 'text-amber-700',   bg: 'bg-amber-50'   },
  positive_mogae: { label: 'Положит. заключение МОГЭ', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  below_30:       { label: 'Превышение < 30%',         color: 'text-teal-700',    bg: 'bg-teal-50'    },
};

export const NTS_PROTOCOL_STATUS_CONFIG: Record<NtsProtocolStatus, { label: string; color: string; bg: string }> = {
  preparing:  { label: 'Подготавливается',             color: 'text-amber-700',   bg: 'bg-amber-50'   },
  msed:       { label: 'На согласовании в МСЭД',       color: 'text-blue-700',    bg: 'bg-blue-50'    },
  sent_omsu:  { label: 'Направлен в ОМСУ/РСО',         color: 'text-emerald-700', bg: 'bg-emerald-50' },
};

export const NTS_CHECKLIST_STATUS: Record<NtsChecklistItemStatus, { label: string; color: string }> = {
  ok:      { label: 'Соответствует',       color: 'text-emerald-600' },
  fail:    { label: 'Не соответствует',    color: 'text-red-600'     },
  clarify: { label: 'Требует уточнения',   color: 'text-amber-600'   },
  na:      { label: 'Не применимо',        color: 'text-slate-400'   },
};

export interface RolePermission {
  role: string;
  module: string;
  can_access: boolean;
  features: Record<string, boolean>;
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

export interface ClosureChange {
  id: number;
  object_id: number;
  user_id: string;
  user_name: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  closure_objects?: { object_name: string; omsu: string } | null;
}

export const ROLE_LABELS: Record<string, string> = {
  admin:              'Администратор',
  manager:            'Руководитель проекта',
  analyst:            'Главный аналитик',
  guest:              'Гость',
  module_responsible: 'Ответственный за модуль',
};

export const ROLE_COLORS: Record<string, string> = {
  admin:              'bg-purple-100 text-purple-700',
  manager:            'bg-blue-100 text-blue-700',
  analyst:            'bg-emerald-100 text-emerald-700',
  guest:              'bg-slate-100 text-slate-700',
  module_responsible: 'bg-orange-100 text-orange-700',
};

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: 'Новое',     color: 'text-slate-700',   bg: 'bg-slate-100'   },
  in_progress: { label: 'В работе',  color: 'text-amber-700',   bg: 'bg-amber-100'   },
  completed:   { label: 'Исполнено', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  overdue:     { label: 'Просрочено',color: 'text-[#E93A58]',   bg: 'bg-[#FFF0F3]'  },
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
