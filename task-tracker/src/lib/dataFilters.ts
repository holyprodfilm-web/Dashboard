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
  // analyst sees all tasks (read-only, handled at component level)
  return tasks;
}

export function canEditTask(_task: Task, profile: Profile | null): boolean {
  if (!profile) return false;
  return profile.role === 'admin' || profile.role === 'manager';
}
