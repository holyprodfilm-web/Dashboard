import type { Task, TaskLink, Meeting } from '../types';
import { STATUS_CONFIG } from '../types';
import { getAutoStatus } from '../utils';

const NODE_W = 230;
const NODE_H = 98;
const H_GAP = 70;
const V_GAP = 50;
const PAD = 30;
const COLS = 3;

const STATUS_STROKE: Record<string, string> = {
  new: '#94a3b8',
  in_progress: '#f59e0b',
  completed: '#10b981',
  overdue: '#ef4444',
};

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
      if (lines.length >= 2) break;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current && lines.length < 3) lines.push(current.trim());
  if (lines.length === 2 && text.split(' ').length > lines.join(' ').split(' ').length) {
    lines[1] = truncate(lines[1], maxChars - 1);
  }
  return lines.slice(0, 2);
}

interface Props {
  tasks: Task[];
  links: TaskLink[];
  meetings: Meeting[];
}

export default function TaskGraph({ tasks, links, meetings }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        Поручений по этому объекту пока нет
      </div>
    );
  }

  const cols = Math.min(COLS, tasks.length);
  const rows = Math.ceil(tasks.length / cols);
  const svgW = PAD * 2 + cols * NODE_W + (cols - 1) * H_GAP;
  const svgH = PAD * 2 + rows * NODE_H + (rows - 1) * V_GAP;

  const positions = tasks.map((task, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      task,
      x: PAD + col * (NODE_W + H_GAP),
      y: PAD + row * (NODE_H + V_GAP),
      cx: PAD + col * (NODE_W + H_GAP) + NODE_W / 2,
      cy: PAD + row * (NODE_H + V_GAP) + NODE_H / 2,
    };
  });

  const posMap = new Map(positions.map(p => [p.task.id, p]));

  // Keep each link as-is — direction matters (from=parent → to=child)
  const uniqueLinks = links;

  const meetingMap = new Map(meetings.map(m => [m.id, m]));

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
      <svg width={Math.max(svgW, 400)} height={svgH} style={{ display: 'block' }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Edges */}
        {uniqueLinks.map(link => {
          const src = posMap.get(link.from_task_id);
          const tgt = posMap.get(link.to_task_id);
          if (!src || !tgt) return null;

          // Control points for curved edge
          const dx = tgt.cx - src.cx;
          const dy = tgt.cy - src.cy;
          const mx = (src.cx + tgt.cx) / 2;
          const my = (src.cy + tgt.cy) / 2;
          // Perpendicular offset for curve
          const len = Math.sqrt(dx * dx + dy * dy);
          const ox = len > 0 ? (-dy / len) * 30 : 30;
          const oy = len > 0 ? (dx / len) * 30 : 0;

          // Shorten line to not overlap node border
          const shrink = 14;
          const angle = Math.atan2(tgt.cy - src.cy, tgt.cx - src.cx);
          const x1 = src.cx + Math.cos(angle) * shrink;
          const y1 = src.cy + Math.sin(angle) * shrink;
          const x2 = tgt.cx - Math.cos(angle) * shrink;
          const y2 = tgt.cy - Math.sin(angle) * shrink;

          return (
            <g key={link.id}>
              <path
                d={`M ${x1} ${y1} Q ${mx + ox} ${my + oy} ${x2} ${y2}`}
                stroke="#94a3b8"
                strokeWidth="1.5"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {positions.map(({ task, x, y }) => {
          const status = getAutoStatus(task.status, task.deadline);
          const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['new'];
          const strokeColor = STATUS_STROKE[status] || '#94a3b8';
          const meeting = meetingMap.get(task.meeting_id);
          const descLines = wrapText(task.description, 30);

          return (
            <g key={task.id} transform={`translate(${x}, ${y})`}>
              {/* Card background */}
              <rect
                width={NODE_W}
                height={NODE_H}
                rx="10"
                fill="white"
                stroke={strokeColor}
                strokeWidth="2"
                filter="drop-shadow(0 1px 4px rgba(0,0,0,0.08))"
              />
              {/* Status stripe */}
              <rect width="5" height={NODE_H} rx="2.5" fill={strokeColor} />

              {/* Task ID badge */}
              <rect x="12" y="10" width="36" height="16" rx="8" fill="#f1f5f9" />
              <text x="30" y="22" textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="monospace">
                #{task.id}
              </text>

              {/* Status label */}
              <rect x={NODE_W - 72} y="10" width="64" height="16" rx="8" fill={cfg.bg.replace('bg-', '').includes('100') ? '#f1f5f9' : '#f1f5f9'} />
              <text x={NODE_W - 40} y="22" textAnchor="middle" fontSize="10" fill={strokeColor} fontFamily="sans-serif">
                {cfg.label}
              </text>

              {/* Description */}
              {descLines.map((line, i) => (
                <text key={i} x="14" y={42 + i * 16} fontSize="12" fill="#1e293b" fontWeight="500">
                  {line}
                </text>
              ))}

              {/* Meeting title */}
              {meeting && (
                <text x="14" y="78" fontSize="10" fill="#94a3b8">
                  {truncate(meeting.title, 34)}
                </text>
              )}

              {/* Deadline */}
              {task.deadline && (
                <text x={NODE_W - 14} y="78" textAnchor="end" fontSize="10" fill="#94a3b8">
                  до {task.deadline}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {links.length === 0 && tasks.length > 0 && (
        <div className="text-center text-xs text-slate-400 mt-2 pb-2">
          Связи между поручениями не созданы. Добавьте их через карточку протокола.
        </div>
      )}
    </div>
  );
}
