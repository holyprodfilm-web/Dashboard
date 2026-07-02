import type { TaskStatus } from './types';

export function getAutoStatus(status: string, deadline?: string): TaskStatus {
  if (status === 'completed') return 'completed';
  
  if (deadline) {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (deadlineDate < today && status !== 'completed') {
      return 'overdue';
    }
  }
  
  if (status === 'in_progress') return 'in_progress';
  return 'new';
}