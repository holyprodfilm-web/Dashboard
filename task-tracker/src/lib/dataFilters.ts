import type { Meeting, Profile, Task } from '../types';

export function filterMeetingsForRole(meetings: Meeting[], profile: Profile | null): Meeting[] {
  if (!profile) return [];
  if (profile.role === 'admin' || profile.role === 'guest') return meetings;
  if (profile.role === 'manager') {
    return meetings.filter(m => m.manager === profile.full_name);
  }
  return meetings;
}

export function filterTasksForRole(
  tasks: Task[],
  meetings: Meeting[],
  profile: Profile | null
): Task[] {
  if (!profile) return [];
  if (profile.role === 'admin' || profile.role === 'guest') return tasks;
  if (profile.role === 'manager') {
    const managerMeetingIds = new Set(
      meetings.filter(m => m.manager === profile.full_name).map(m => m.id)
    );
    return tasks.filter(t => managerMeetingIds.has(t.meeting_id));
  }
  if (profile.role === 'contractor') {
    return tasks.filter(t => t.responsible === profile.full_name);
  }
  return tasks;
}

export function canEditTask(task: Task, profile: Profile | null): boolean {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'manager') return true;
  if (profile.role === 'contractor') return task.responsible === profile.full_name;
  return false;
}
