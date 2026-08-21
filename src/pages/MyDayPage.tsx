import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Clock, CheckCircle, AlertCircle, Paperclip, MessageSquare, Flag, Calendar, LayoutGrid, List, ChevronLeft, ChevronRight, ChevronDown, Home, Star, Pin, X, Bell, Repeat, Tag, Users, Stethoscope, Coffee, Plane, LogIn, LogOut, Pencil, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Badge, Modal, Input, Textarea, Select, Tabs, EmptyState, Spinner, Avatar } from '@/components/ui';
import { formatDate, formatRelativeTime, daysUntil, todayISO, formatDateTime, cn } from '@/lib/format';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  assigned_by: string | null;
  branch_id: string | null;
  due_date: string | null;
  due_time: string | null;
  completed_at: string | null;
  submission_note: string | null;
  attachment_urls: string[];
  tags: string[];
  category: string | null;
  category_color: string | null;
  assigned_to_ids: string[] | null;
  is_recurring: boolean | null;
  recurring_frequency: string | null;
  recurring_end_date: string | null;
  skip_holidays: boolean | null;
  reminders: string[] | null;
  is_pinned: boolean | null;
  is_starred: boolean | null;
  review_status: string | null;
  created_at: string;
  profiles: { display_name: string } | null;
};

type Profile = {
  id: string;
  display_name: string;
};

const STATUS_COLS = [
  { key: 'todo', label: 'รอดำเนินการ', color: 'bg-surface-400' },
  { key: 'doing', label: 'กำลังทำ', color: 'bg-primary-500' },
  { key: 'review', label: 'รอตรวจสอบ', color: 'bg-warning-500' },
  { key: 'done', label: 'เสร็จแล้ว', color: 'bg-success-500' },
];

const CATEGORIES = [
  { value: 'general', label: 'ทั่วไป', color: '#6366f1' },
  { value: 'sales', label: 'งานขาย', color: '#10b981' },
  { value: 'stock', label: 'สต๊อก', color: '#f59e0b' },
  { value: 'cs', label: 'บริการลูกค้า', color: '#ef4444' },
  { value: 'marketing', label: 'การตลาด', color: '#8b5cf6' },
  { value: 'admin', label: 'ธุรการ', color: '#06b6d4' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'ต่ำ', color: 'bg-surface-200 text-surface-600' },
  { value: 'medium', label: 'กลาง', color: 'bg-primary-100 text-primary-700' },
  { value: 'high', label: 'สูง', color: 'bg-error-100 text-error-700' },
];

const REMINDER_OPTIONS = [
  { value: '5min', label: '5 นาทีก่อน' },
  { value: '1hour', label: '1 ชั่วโมงก่อน' },
  { value: '1day', label: '1 วันก่อน' },
  { value: 'on_due', label: 'วันครบกำหนด' },
  { value: '1day_after', label: 'วันถัดจากกำหนด' },
  { value: 'custom', label: 'กำหนดเอง' },
];

const RECURRING_FREQ = [
  { value: 'daily', label: 'ทุกวัน' },
  { value: 'weekly', label: 'ทุกสัปดาห์' },
  { value: 'monthly', label: 'ทุกเดือน' },
  { value: 'yearly', label: 'ทุกปี' },
];

export function MyDayPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today');
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [showCreate, setShowCreate] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [submitMode, setSubmitMode] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState('all');
  const [calendarData, setCalendarData] = useState<{ shifts: any[]; leaves: any[]; dayOffs: any[]; attendance: any[] }>({ shifts: [], leaves: [], dayOffs: [], attendance: [] });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const isSuperAdmin = (profile?.roles ?? []).some((r) => r === 'owner' || r === 'super_admin');
  const viewingOwn = !isSuperAdmin || !selectedEmployeeId;
  const effectiveProfileId = viewingOwn ? profile?.id : selectedEmployeeId;

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const targetId = effectiveProfileId ?? profile.id;
    const [taskRes, profRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*, profiles:assigned_to(display_name)')
        .or(`assigned_to.eq.${targetId},assigned_by.eq.${targetId}`)
        .order('is_pinned', { ascending: false })
        .order('due_date', { ascending: true }),
      supabase.from('profiles').select('id, display_name').eq('is_active', true).order('display_name'),
    ]);
    if (!taskRes.error && taskRes.data) setTasks(taskRes.data as Task[]);
    if (!profRes.error && profRes.data) setProfiles(profRes.data as Profile[]);
    setLoading(false);
  }, [profile, effectiveProfileId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile) return;
    const targetId = effectiveProfileId ?? profile.id;
    (async () => {
      const [shiftRes, leaveRes, dayOffRes, attRes] = await Promise.all([
        supabase.from('shift_assignments').select('*, shifts(name, start_time, end_time, color), branches(name)').eq('profile_id', targetId).order('assignment_date', { ascending: true }).limit(90),
        supabase.from('leave_requests').select('*').eq('profile_id', targetId).order('created_at', { ascending: false }).limit(20),
        supabase.from('personal_day_offs').select('*').eq('profile_id', targetId).order('effective_from', { ascending: false }),
        supabase.from('attendance').select('id, check_in_time, check_out_time, work_hours, status, late_minutes').eq('profile_id', targetId).order('check_in_time', { ascending: false }).limit(90),
      ]);
      setCalendarData({
        shifts: (shiftRes.data as any[]) ?? [],
        leaves: (leaveRes.data as any[]) ?? [],
        dayOffs: (dayOffRes.data as any[]) ?? [],
        attendance: (attRes.data as any[]) ?? [],
      });
    })();
  }, [profile, effectiveProfileId]);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const filtered = tasks.filter((t) => {
    if (filterCategory !== 'all' && (t.category ?? 'general') !== filterCategory) return false;
    if (tab === 'today') return t.due_date?.startsWith(todayStr) && t.status !== 'done';
    if (tab === 'week') {
      if (!t.due_date || t.status === 'done') return false;
      const due = new Date(t.due_date);
      return due >= new Date(todayStr) && due <= weekEnd;
    }
    if (tab === 'month') {
      if (!t.due_date || t.status === 'done') return false;
      const due = new Date(t.due_date);
      return due.getMonth() === now.getMonth() && due.getFullYear() === now.getFullYear();
    }
    if (tab === 'overdue') return t.due_date && new Date(t.due_date) < now && t.status !== 'done';
    if (tab === 'done') return t.status === 'done';
    if (tab === 'all') return true;
    return true;
  });

  const counts = {
    today: tasks.filter((t) => t.due_date?.startsWith(todayStr) && t.status !== 'done').length,
    week: tasks.filter((t) => t.due_date && new Date(t.due_date) >= new Date(todayStr) && new Date(t.due_date) <= weekEnd && t.status !== 'done').length,
    month: tasks.filter((t) => t.due_date && new Date(t.due_date).getMonth() === now.getMonth() && new Date(t.due_date).getFullYear() === now.getFullYear() && t.status !== 'done').length,
    overdue: tasks.filter((t) => t.due_date && new Date(t.due_date) < now && t.status !== 'done').length,
    done: tasks.filter((t) => t.status === 'done').length,
    all: tasks.length,
  };

  async function submitTask(task: Task) {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString(), submission_note: submissionNote })
      .eq('id', task.id);
    if (!error) {
      setShowCreate(false);
      setSelectedTask(null);
      setSubmitMode(false);
      setSubmissionNote('');
      load();
    } else {
      alert('ส่งงานไม่สำเร็จ: ' + error.message);
    }
  }

  async function updateStatus(taskId: string, status: string) {
    const updates: any = { status };
    if (status === 'done') updates.completed_at = new Date().toISOString();
    if (status === 'review') updates.review_status = 'pending';
    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId);
    if (error) alert('อัปเดตสถานะไม่สำเร็จ: ' + error.message);
    load();
  }

  async function handleDrop(status: string) {
    if (!dragId) return;
    await updateStatus(dragId, status);
    setDragId(null);
  }

  async function togglePin(task: Task) {
    const { error } = await supabase.from('tasks').update({ is_pinned: !task.is_pinned }).eq('id', task.id);
    if (error) alert('ปักหมุดไม่สำเร็จ: ' + error.message);
    load();
  }

  async function toggleStar(task: Task) {
    const { error } = await supabase.from('tasks').update({ is_starred: !task.is_starred }).eq('id', task.id);
    if (error) alert('ติดดาวไม่สำเร็จ: ' + error.message);
    load();
  }

  function toggleCol(key: string) {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const priorityColors: Record<string, 'default' | 'warning' | 'error' | 'info'> = {
    low: 'default', medium: 'info', high: 'warning', urgent: 'error',
  };
  const priorityLabels: Record<string, string> = { low: 'ต่ำ', medium: 'ปานกลาง', high: 'สูง', urgent: 'ด่วน' };
  const statusLabels: Record<string, string> = { todo: 'รอทำ', doing: 'กำลังทำ', review: 'รอตรวจสอบ', done: 'เสร็จ', overdue: 'เกินกำหนด' };

  function getAssigneeNames(task: Task): string[] {
    if (task.assigned_to_ids && task.assigned_to_ids.length > 0) {
      return task.assigned_to_ids.map((id) => profiles.find((p) => p.id === id)?.display_name ?? '?').filter(Boolean);
    }
    if (task.profiles?.display_name) return [task.profiles.display_name];
    return [];
  }

  function TaskCard({ task, i }: { task: Task; i?: number }) {
    const dUntil = task.due_date ? daysUntil(task.due_date) : null;
    const isOverdue = dUntil != null && dUntil < 0 && task.status !== 'done';
    const assigneeNames = getAssigneeNames(task);
    const cat = CATEGORIES.find((c) => c.value === (task.category ?? 'general'));

    return (
      <Card
        hover
        draggable
        onDragStart={() => setDragId(task.id)}
        className={cn(
          'p-3.5 animate-slide-up cursor-grab active:cursor-grabbing relative',
          isOverdue && 'border-error-300',
          task.is_pinned && 'ring-1 ring-primary-300',
        )}
        style={i != null ? { animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' } : undefined}
        onClick={() => setSelectedTask(task)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {cat && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />}
            <Badge variant={priorityColors[task.priority]}>
              <Flag className="w-3 h-3" /> {priorityLabels[task.priority]}
            </Badge>
            {task.is_recurring && <Repeat className="w-3.5 h-3.5 text-primary-500" />}
          </div>
          <div className="flex items-center gap-1">
            {task.is_pinned && <Pin className="w-3.5 h-3.5 text-primary-500 fill-primary-500" />}
            {task.is_starred && <Star className="w-3.5 h-3.5 text-warning-500 fill-warning-500" />}
          </div>
        </div>
        <h3 className={cn('font-semibold text-surface-900 mb-1 text-sm', task.status === 'done' && 'line-through text-surface-400')}>
          {task.title}
        </h3>
        {task.description && <p className="text-xs text-surface-500 line-clamp-2 mb-2">{task.description}</p>}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-100 text-surface-500">#{tag}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 text-xs text-surface-400">
          <div className="flex items-center gap-2">
            {task.due_date && (
              <span className={cn('flex items-center gap-1', isOverdue ? 'text-error-600 font-medium' : '')}>
                <Clock className="w-3.5 h-3.5" />
                {dUntil === 0 ? 'วันนี้' : dUntil! < 0 ? `เกิน ${Math.abs(dUntil!)} วัน` : `${dUntil} วัน`}
                {task.due_time && ` ${task.due_time}`}
              </span>
            )}
            {task.reminders && task.reminders.length > 0 && (
              <span className="flex items-center gap-0.5"><Bell className="w-3.5 h-3.5" /></span>
            )}
          </div>
          {assigneeNames.length > 0 && (
            <div className="flex -space-x-1.5">
              {assigneeNames.slice(0, 3).map((name, idx) => (
                <div key={idx} className="ring-2 ring-white rounded-full">
                  <Avatar name={name} size="sm" />
                </div>
              ))}
              {assigneeNames.length > 3 && (
                <div className="w-7 h-7 rounded-full bg-surface-200 flex items-center justify-center text-[10px] font-medium text-surface-500 ring-2 ring-white">
                  +{assigneeNames.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
        {task.status !== 'done' && (
          <div className="flex gap-1.5 mt-2 pt-2 border-t border-surface-100" onClick={(e) => e.stopPropagation()}>
            {task.status === 'todo' && (
              <Button size="sm" variant="secondary" onClick={() => updateStatus(task.id, 'doing')} className="text-xs px-2.5 py-1">เริ่มทำ</Button>
            )}
            {task.status === 'doing' && (
              <Button size="sm" variant="secondary" onClick={() => updateStatus(task.id, 'review')} className="text-xs px-2.5 py-1">ส่งตรวจ</Button>
            )}
            <Button size="sm" variant="primary" onClick={() => { setSelectedTask(task); setSubmitMode(true); }} className="text-xs px-2.5 py-1">เสร็จ</Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs
          tabs={[
            { key: 'today', label: 'วันนี้', count: counts.today },
            { key: 'week', label: 'สัปดาห์', count: counts.week },
            { key: 'month', label: 'เดือน', count: counts.month },
            { key: 'overdue', label: 'ค้าง', count: counts.overdue },
            { key: 'done', label: 'เสร็จแล้ว', count: counts.done },
            { key: 'all', label: 'ทั้งหมด', count: counts.all },
            { key: 'calendar', label: 'ปฏิทินงานของฉัน' },
          ]}
          active={tab}
          onChange={setTab}
        />
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-surface-100 rounded-lg">
            <button onClick={() => setView('list')} className={cn('p-1.5 rounded-md transition-colors', view === 'list' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setView('kanban')} className={cn('p-1.5 rounded-md transition-colors', view === 'kanban' ? 'bg-white text-primary-600 shadow-sm' : 'text-surface-400')}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <Button onClick={() => { setEditingTask(null); setShowCreate(true); }} size="sm">
            <Plus className="w-4 h-4" /> สร้างงาน
          </Button>
        </div>
      </div>

      {tab !== 'calendar' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-surface-400">กรองหมวดหมู่:</span>
          <button onClick={() => setFilterCategory('all')} className={cn('px-3 py-1 rounded-lg text-xs font-medium transition-all', filterCategory === 'all' ? 'bg-primary-500 text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200')}>
            ทั้งหมด
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(cat.value)}
              className={cn('flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all', filterCategory === cat.value ? 'bg-primary-500 text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200')}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-surface-400" />
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="input-base max-w-xs"
          >
            <option value="">ปฏิทินงานของฉัน</option>
            {profiles.filter((p) => p.id !== profile?.id).map((p) => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : view === 'kanban' && tab !== 'calendar' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {STATUS_COLS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.key);
            const isCollapsed = collapsedCols.has(col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.key)}
                className="space-y-2"
              >
                <button
                  onClick={() => toggleCol(col.key)}
                  className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-surface-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full', col.color)} />
                    <span className="text-sm font-semibold text-surface-700">{col.label}</span>
                    <span className="text-xs text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded-md">{colTasks.length}</span>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-surface-400 transition-transform', isCollapsed && 'rotate-180')} />
                </button>
                {!isCollapsed && (
                  <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto p-1.5 rounded-xl bg-surface-50 border border-dashed border-surface-200 min-h-[120px]">
                    {colTasks.length === 0 ? (
                      <p className="text-center text-xs text-surface-400 py-8">ลากการ์ดมาที่นี่</p>
                    ) : (
                      colTasks.map((task, i) => <TaskCard key={task.id} task={task} i={i} />)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : tab !== 'calendar' && filtered.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="w-8 h-8" />}
          title="ไม่มีงานในหมวดนี้"
          description="งานที่สร้างหรือได้รับมอบหมายจะปรากฏที่นี่"
        />
      ) : tab !== 'calendar' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((task, i) => {
            const dUntil = task.due_date ? daysUntil(task.due_date) : null;
            const isOverdue = dUntil != null && dUntil < 0 && task.status !== 'done';
            const assigneeNames = getAssigneeNames(task);
            const cat = CATEGORIES.find((c) => c.value === (task.category ?? 'general'));
            return (
              <Card key={task.id} hover className={cn('p-5 animate-slide-up cursor-pointer relative', isOverdue && 'border-error-300', task.is_pinned && 'ring-1 ring-primary-300')} >
                <div style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }} onClick={() => setSelectedTask(task)}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {cat && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />}
                      <Badge variant={priorityColors[task.priority]}>
                        <Flag className="w-3 h-3" /> {priorityLabels[task.priority]}
                      </Badge>
                      <Badge variant={task.status === 'done' ? 'success' : isOverdue ? 'error' : 'default'}>
                        {isOverdue ? 'เกินกำหนด' : statusLabels[task.status]}
                      </Badge>
                      {task.is_recurring && <Repeat className="w-3.5 h-3.5 text-primary-500" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); togglePin(task); }} className={cn('p-1 rounded hover:bg-surface-100 transition-colors', task.is_pinned && 'text-primary-500')}>
                        <Pin className={cn('w-4 h-4', task.is_pinned && 'fill-primary-500')} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleStar(task); }} className={cn('p-1 rounded hover:bg-surface-100 transition-colors', task.is_starred && 'text-warning-500')}>
                        <Star className={cn('w-4 h-4', task.is_starred && 'fill-warning-500')} />
                      </button>
                    </div>
                  </div>
                  <h3 className={cn('font-semibold text-surface-900 mb-1', task.status === 'done' && 'line-through text-surface-400')}>
                    {task.title}
                  </h3>
                  {task.description && <p className="text-sm text-surface-500 line-clamp-2 mb-3">{task.description}</p>}
                  {task.tags && task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {task.tags.map((tag, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] bg-surface-100 text-surface-500">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-xs text-surface-400">
                    {task.due_date && (
                      <span className={cn('flex items-center gap-1', isOverdue && 'text-error-600 font-medium')}>
                        <Calendar className="w-3.5 h-3.5" /> {formatDate(task.due_date)}
                        {task.due_time && ` ${task.due_time}`}
                      </span>
                    )}
                    {task.attachment_urls?.length > 0 && (
                      <span className="flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> {task.attachment_urls.length}</span>
                    )}
                    {assigneeNames.length > 0 && (
                      <div className="flex -space-x-1.5 ml-auto">
                        {assigneeNames.slice(0, 3).map((name, idx) => (
                          <div key={idx} className="ring-2 ring-white rounded-full">
                            <Avatar name={name} size="sm" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {task.status !== 'done' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100" onClick={(e) => e.stopPropagation()}>
                    {task.status === 'todo' && <Button size="sm" variant="secondary" onClick={() => updateStatus(task.id, 'doing')}>เริ่มทำ</Button>}
                    {task.status === 'doing' && <Button size="sm" variant="secondary" onClick={() => updateStatus(task.id, 'review')}>ส่งตรวจ</Button>}
                    <Button size="sm" variant="primary" onClick={() => { setSelectedTask(task); setSubmitMode(true); }}>เสร็จ</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingTask(task); setShowCreate(true); }}>แก้ไข</Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : null}

      <CreateTaskModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditingTask(null); }}
        profileId={profile?.id}
        profiles={profiles}
        editingTask={editingTask}
        onCreated={load}
      />

      {tab === 'calendar' && (
        <MyCalendarView
          shifts={calendarData.shifts}
          leaves={calendarData.leaves}
          dayOffs={calendarData.dayOffs}
          attendance={calendarData.attendance}
          profileId={effectiveProfileId ?? profile?.id}
          roles={profile?.roles ?? []}
          onSaved={load}
        />
      )}

      {selectedTask && (
        <Modal open={!!selectedTask} onClose={() => { setSelectedTask(null); setSubmitMode(false); setSubmissionNote(''); }} title={submitMode ? 'ส่งงาน' : 'รายละเอียดงาน'} size="md">
          {submitMode ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-surface-900 mb-1">{selectedTask.title}</h4>
                <p className="text-sm text-surface-500">{selectedTask.description}</p>
              </div>
              <Textarea
                label="หมายเหตุการส่งงาน"
                rows={4}
                value={submissionNote}
                onChange={(e) => setSubmissionNote(e.target.value)}
                placeholder="รายงานผลการทำงาน..."
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setSubmitMode(false)}>ยกเลิก</Button>
                <Button onClick={() => submitTask(selectedTask)}>ส่งงาน</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={priorityColors[selectedTask.priority]}>{priorityLabels[selectedTask.priority]}</Badge>
                <Badge variant={selectedTask.status === 'done' ? 'success' : 'default'}>{statusLabels[selectedTask.status]}</Badge>
                {selectedTask.is_pinned && <Badge variant="primary"><Pin className="w-3 h-3" /> ปักหมุด</Badge>}
                {selectedTask.is_starred && <Badge variant="warning"><Star className="w-3 h-3" /> ดาว</Badge>}
              </div>
              <div>
                <h4 className="font-semibold text-surface-900 mb-1">{selectedTask.title}</h4>
                <p className="text-sm text-surface-500">{selectedTask.description}</p>
              </div>
              {selectedTask.due_date && (
                <div className="flex items-center gap-2 text-sm text-surface-500">
                  <Calendar className="w-4 h-4" /> กำหนด: {formatDate(selectedTask.due_date)} {selectedTask.due_time}
                </div>
              )}
              {selectedTask.tags && selectedTask.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTask.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg text-xs bg-surface-100 text-surface-500">#{tag}</span>
                  ))}
                </div>
              )}
              {selectedTask.submission_note && (
                <div className="p-3 rounded-xl bg-success-50 border border-success-200">
                  <p className="text-xs font-medium text-success-700 mb-1">ผลการส่งงาน</p>
                  <p className="text-sm text-surface-700">{selectedTask.submission_note}</p>
                </div>
              )}
              {selectedTask.attachment_urls?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-surface-400 mb-2">ไฟล์แนบ</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedTask.attachment_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100 text-sm text-primary-600 hover:underline">
                        <Paperclip className="w-4 h-4" /> ไฟล์ {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                {selectedTask.status !== 'done' && (
                  <Button onClick={() => setSubmitMode(true)} className="flex-1">ส่งงาน</Button>
                )}
                <Button variant="secondary" onClick={() => { setEditingTask(selectedTask); setShowCreate(true); setSelectedTask(null); }}>แก้ไข</Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ============ CREATE / EDIT TASK MODAL ============
function CreateTaskModal({ open, onClose, profileId, profiles, editingTask, onCreated }: {
  open: boolean;
  onClose: () => void;
  profileId?: string;
  profiles: Profile[];
  editingTask: Task | null;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [category, setCategory] = useState('general');
  const [assignedToIds, setAssignedToIds] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState('daily');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [skipHolidays, setSkipHolidays] = useState(false);
  const [reminders, setReminders] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description ?? '');
      setPriority(editingTask.priority ?? 'medium');
      setDueDate(editingTask.due_date ? editingTask.due_date.split('T')[0] : '');
      setDueTime(editingTask.due_time ?? '');
      setCategory(editingTask.category ?? 'general');
      setAssignedToIds(editingTask.assigned_to_ids ?? []);
      setIsRecurring(editingTask.is_recurring ?? false);
      setRecurringFreq(editingTask.recurring_frequency ?? 'daily');
      setRecurringEndDate(editingTask.recurring_end_date ?? '');
      setSkipHolidays(editingTask.skip_holidays ?? false);
      setReminders(editingTask.reminders ?? []);
      setTags(editingTask.tags ?? []);
      setIsPinned(editingTask.is_pinned ?? false);
      setIsStarred(editingTask.is_starred ?? false);
    } else if (open) {
      setTitle(''); setDescription(''); setPriority('medium'); setDueDate(''); setDueTime('');
      setCategory('general'); setAssignedToIds([]); setIsRecurring(false); setRecurringFreq('daily');
      setRecurringEndDate(''); setSkipHolidays(false); setReminders([]); setTags([]);
      setIsPinned(false); setIsStarred(false);
    }
    setError(null);
  }, [editingTask, open]);

  function toggleAssignee(id: string) {
    setAssignedToIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleReminder(val: string) {
    setReminders((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);
  }

  function addTag() {
    const val = tagInput.trim();
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
      setTagInput('');
    }
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  }

  async function handleSave() {
    if (!title.trim() || !profileId) { setError('กรุณากรอกชื่องาน'); return; }
    setLoading(true);
    setError(null);

    const payload = {
      title,
      description,
      priority,
      due_date: dueDate ? new Date(dueDate + (dueTime ? `T${dueTime}` : 'T00:00')).toISOString() : null,
      due_time: dueTime || null,
      category,
      category_color: CATEGORIES.find((c) => c.value === category)?.color ?? '#6366f1',
      assigned_to_ids: assignedToIds,
      assigned_to: assignedToIds[0] ?? null,
      assigned_by: profileId,
      is_recurring: isRecurring,
      recurring_frequency: isRecurring ? recurringFreq : null,
      recurring_end_date: isRecurring && recurringEndDate ? recurringEndDate : null,
      skip_holidays: isRecurring ? skipHolidays : false,
      reminders,
      tags,
      is_pinned: isPinned,
      is_starred: isStarred,
    };

    try {
      if (editingTask) {
        const { error: updateError } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('tasks').insert({ ...payload, status: 'todo' });
        if (insertError) throw insertError;
      }
      onClose();
      onCreated();
    } catch (err: any) {
      setError(err.message ?? 'บันทึกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editingTask ? 'แก้ไขงาน' : 'สร้างงานใหม่'} size="lg">
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-error-50 border border-error-200 flex items-center gap-2 text-sm text-error-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <Input label="ชื่องาน" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ชื่องานที่ต้องการ" />

        <Textarea label="รายละเอียด" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="คำอธิบายงาน..." />

        <div className="grid grid-cols-2 gap-3">
          <Input label="วันครบกำหนด" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input label="เวลา" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">ความสำคัญ</label>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                  priority === opt.value
                    ? 'ring-2 ring-primary-500 ' + opt.color
                    : 'bg-surface-50 text-surface-400 hover:bg-surface-100',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">หมวดหมู่</label>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={cn('w-7 h-7 rounded-full transition-all', category === cat.value ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : 'hover:scale-110')}
                  style={{ backgroundColor: cat.color }}
                  title={cat.label}
                />
              ))}
            </div>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1">
              {CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">มอบหมายให้</label>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => {
              const selected = assignedToIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleAssignee(p.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
                    selected ? 'bg-primary-500 text-white' : 'bg-surface-100 text-surface-500 hover:bg-surface-200',
                  )}
                >
                  <Avatar name={p.display_name} size="sm" />
                  {p.display_name}
                  {selected && <CheckCircle className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
          {assignedToIds.length === 0 && <p className="text-xs text-surface-400 mt-1">ยังไม่ได้มอบหมาย (สามารถเลือกได้หลายคน)</p>}
        </div>

        <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-surface-700">ทำซ้ำ</span>
            </div>
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={cn('relative w-11 h-6 rounded-full transition-colors', isRecurring ? 'bg-primary-500' : 'bg-surface-300')}
            >
              <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform', isRecurring ? 'left-5.5 translate-x-0' : 'left-0.5')} style={{ transform: isRecurring ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>
          {isRecurring && (
            <div className="grid grid-cols-2 gap-3">
              <Select label="ความถี่" value={recurringFreq} onChange={(e) => setRecurringFreq(e.target.value)}>
                {RECURRING_FREQ.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
              <Input label="สิ้นสุดการทำซ้ำ" type="date" value={recurringEndDate} onChange={(e) => setRecurringEndDate(e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-surface-600 col-span-2 cursor-pointer">
                <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} className="w-4 h-4 rounded" />
                ข้ามวันหยุด
              </label>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">การแจ้งเตือนล่วงหน้า</label>
          <div className="flex flex-wrap gap-2">
            {REMINDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleReminder(opt.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                  reminders.includes(opt.value)
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-100 text-surface-500 hover:bg-surface-200',
                )}
              >
                <Bell className="w-3.5 h-3.5" /> {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">แท็ก</label>
          <div className="flex gap-2">
            <div className="flex-1 flex flex-wrap gap-1.5 items-center p-2 rounded-xl bg-surface-50 border border-surface-200 min-h-[42px]">
              {tags.map((tag, i) => (
                <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-primary-100 text-primary-700">
                  #{tag}
                  <button type="button" onClick={() => setTags(tags.filter((_, idx) => idx !== i))} className="hover:text-error-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={addTag}
                placeholder={tags.length === 0 ? 'พิมพ์แท็กแล้วกด Enter...' : ''}
                className="flex-1 bg-transparent outline-none text-sm min-w-[120px]"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsPinned(!isPinned)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all', isPinned ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'bg-surface-50 text-surface-500')}
          >
            <Pin className={cn('w-4 h-4', isPinned && 'fill-primary-500')} /> ปักหมุด
          </button>
          <button
            type="button"
            onClick={() => setIsStarred(!isStarred)}
            className={cn('flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all', isStarred ? 'bg-warning-100 text-warning-700 ring-1 ring-warning-300' : 'bg-surface-50 text-surface-500')}
          >
            <Star className={cn('w-4 h-4', isStarred && 'fill-warning-500')} /> ติดดาว
          </button>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={handleSave} loading={loading} className="flex-1">{editingTask ? 'บันทึก' : 'สร้างงาน'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============ MY CALENDAR VIEW ============
const DAY_NAMES_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTH_NAMES = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const LEAVE_TYPES_MY: Record<string, { label: string; color: string }> = {
  sick: { label: 'ลาป่วย', color: 'text-error-600 bg-error-100' },
  personal: { label: 'ลากิจ', color: 'text-warning-600 bg-warning-100' },
  vacation: { label: 'ลาพักร้อน', color: 'text-primary-600 bg-primary-100' },
};

function MyCalendarView({ shifts, leaves, dayOffs, attendance, profileId, roles, onSaved }: {
  shifts: any[]; leaves: any[]; dayOffs: any[]; attendance: any[]; profileId?: string; roles: string[]; onSaved: () => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editAttendance, setEditAttendance] = useState<any | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const isSuperAdmin = roles.some((r) => r === 'owner' || r === 'super_admin');

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = firstDay.getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const shiftMap = new Map<string, any>();
  shifts.forEach((s) => shiftMap.set(s.assignment_date, s));

  const attendanceMap = new Map<string, any>();
  attendance.forEach((a) => {
    if (!a.check_in_time) return;
    const d = new Date(a.check_in_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    attendanceMap.set(key, a);
  });

  const leaveMap = new Map<string, any[]>();
  leaves.forEach((lr) => {
    if (lr.status !== 'approved' && lr.status !== 'pending') return;
    const start = new Date(lr.start_date);
    const end = new Date(lr.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      if (!leaveMap.has(key)) leaveMap.set(key, []);
      leaveMap.get(key)!.push(lr);
    }
  });

  function isPersonalDayOff(date: Date): boolean {
    const dow = date.getDay();
    return dayOffs.some((doff: any) => {
      if (doff.day_of_week !== dow) return false;
      const from = new Date(doff.effective_from);
      if (date < from) return false;
      if (doff.effective_to && date > new Date(doff.effective_to)) return false;
      return true;
    });
  }

  function prevMonth() { setCurrentMonth(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentMonth(new Date(year, month + 1, 1)); }

  function fmtTime(iso: string | null): string {
    if (!iso) return '--:--';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-surface-900">
          {MONTH_NAMES[month]} {year + 543}
        </h2>
        <div className="flex items-center gap-1">
          {isSuperAdmin && (
            <button onClick={() => setShowAuditLog(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-surface-100 transition-colors flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> ประวัติแก้ไข
            </button>
          )}
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-surface-500" />
          </button>
          <button onClick={() => setCurrentMonth(new Date())} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-surface-100 transition-colors">วันนี้</button>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-surface-500" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-surface-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary-500" /> มีกะ</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-success-500" /> วันหยุดประจำตัว</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-error-500" /> ลาป่วย</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-warning-500" /> ลากิจ</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent-500" /> ลาพักร้อน</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-surface-600" /> เช็คอิน/เอาต์</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-dashed border-surface-300" /> รออนุมัติ</span>
      </div>

      <Card className="p-3 sm:p-4 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_NAMES_SHORT.map((d, i) => (
              <div key={i} className={cn('text-center text-xs font-medium py-2', i === 0 ? 'text-error-500' : 'text-surface-400')}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className="min-h-[90px] rounded-lg bg-surface-50/50" />;
              const date = new Date(year, month, day);
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const shift = shiftMap.get(dateStr);
              const attRec = attendanceMap.get(dateStr);
              const dayLeaves = leaveMap.get(dateStr) ?? [];
              const isDayOff = isPersonalDayOff(date);
              const isToday = dateStr === todayISO();
              const dow = date.getDay();
              const isWeekend = dow === 0;
              const approvedLeaves = dayLeaves.filter((l: any) => l.status === 'approved');
              const pendingLeaves = dayLeaves.filter((l: any) => l.status === 'pending');

              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[90px] p-1.5 rounded-lg',
                    isToday ? 'ring-2 ring-primary-500' : '',
                    isDayOff ? 'bg-success-50' : '',
                    isWeekend && !isDayOff ? 'bg-surface-50/50' : '',
                    'bg-white'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn('text-xs font-medium', isToday ? 'text-primary-600' : isWeekend ? 'text-error-500' : 'text-surface-600')}>{day}</span>
                    <div className="flex items-center gap-0.5">
                      {isDayOff && <Home className="w-3 h-3 text-success-500" />}
                      {attRec && isSuperAdmin && (
                        <button onClick={() => setEditAttendance(attRec)} className="p-0.5 rounded hover:bg-surface-200 transition-colors">
                          <Pencil className="w-2.5 h-2.5 text-surface-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {shift?.shifts && (
                      <div className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: shift.shifts.color }}>
                        {shift.shifts.name}
                      </div>
                    )}
                    {attRec && (
                      <div className={cn(
                        'px-1 py-0.5 rounded text-[10px] font-medium flex items-center gap-1',
                        attRec.status === 'late' ? 'bg-warning-100 text-warning-700' : 'bg-surface-200 text-surface-600'
                      )}>
                        <LogIn className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{fmtTime(attRec.check_in_time)}</span>
                        <LogOut className="w-2.5 h-2.5 shrink-0 ml-0.5" />
                        <span className="truncate">{fmtTime(attRec.check_out_time)}</span>
                      </div>
                    )}
                    {approvedLeaves.map((lr: any) => {
                      const cfg = LEAVE_TYPES_MY[lr.leave_type] ?? LEAVE_TYPES_MY.personal;
                      return <div key={lr.id} className={cn('px-1 py-0.5 rounded text-[10px] font-medium', cfg.color)}>{cfg.label}</div>;
                    })}
                    {pendingLeaves.map((lr: any) => (
                      <div key={lr.id} className="px-1 py-0.5 rounded text-[10px] font-medium border border-dashed border-surface-300 text-surface-400">รออนุมัติ</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <AttendanceEditModal
        record={editAttendance}
        profileId={profileId}
        onClose={() => setEditAttendance(null)}
        onSaved={() => { setEditAttendance(null); onSaved(); }}
      />

      <AttendanceAuditLogModal
        open={showAuditLog}
        onClose={() => setShowAuditLog(false)}
        profileId={profileId}
      />
    </div>
  );
}

// ============ ATTENDANCE EDIT MODAL (Super Admin only) ============
function AttendanceEditModal({ record, profileId, onClose, onSaved }: {
  record: any | null;
  profileId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!record) return;
    setCheckIn(record.check_in_time ? toLocalDateTimeInput(record.check_in_time) : '');
    setCheckOut(record.check_out_time ? toLocalDateTimeInput(record.check_out_time) : '');
    setNote('');
    setToast(null);
  }, [record]);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); } }, [toast]);

  if (!record) return null;

  const prevCheckIn = record.check_in_time;
  const prevCheckOut = record.check_out_time;
  const prevWorkHours = record.work_hours;

  async function save() {
    if (!record) return;
    setLoading(true);
    try {
      const newCheckIn = checkIn ? new Date(checkIn).toISOString() : null;
      const newCheckOut = checkOut ? new Date(checkOut).toISOString() : null;

      let newWorkHours: number | null = null;
      if (newCheckIn && newCheckOut) {
        const diff = (new Date(newCheckOut).getTime() - new Date(newCheckIn).getTime()) / (1000 * 60 * 60);
        newWorkHours = Math.round(diff * 100) / 100;
      }

      const action = newCheckIn !== prevCheckIn && newCheckOut !== prevCheckOut ? 'edit_both'
        : newCheckIn !== prevCheckIn ? 'edit_checkin'
        : 'edit_checkout';

      const { error } = await supabase.from('attendance').update({
        check_in_time: newCheckIn,
        check_out_time: newCheckOut,
        work_hours: newWorkHours,
        status: 'present',
      }).eq('id', record.id);

      if (error) throw new Error(error.message);

      await supabase.from('attendance_audit_logs').insert({
        attendance_id: record.id,
        profile_id: record.profile_id ?? profileId ?? null,
        actor_profile_id: profileId ?? null,
        actor_name: null,
        action,
        previous_check_in: prevCheckIn,
        previous_check_out: prevCheckOut,
        new_check_in: newCheckIn,
        new_check_out: newCheckOut,
        previous_work_hours: prevWorkHours,
        new_work_hours: newWorkHours,
        note: note || null,
      });

      setToast({ type: 'success', msg: 'แก้ไขเวลาสำเร็จ — ชั่วโมงทำงานคำนวณใหม่อัตโนมัติ' });
      setTimeout(() => onSaved(), 1200);
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message ?? 'แก้ไขไม่สำเร็จ' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={!!record} onClose={onClose} title="แก้ไขเวลาเช็คอิน/เช็คเอาต์" size="md">
      <div className="space-y-4">
        {toast && (
          <div className={cn('p-3 rounded-xl text-sm font-medium animate-slide-up flex items-center gap-2', toast.type === 'success' ? 'bg-success-100 text-success-700' : 'bg-error-100 text-error-700')}>
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />} {toast.msg}
          </div>
        )}
        <div className="p-3 rounded-xl bg-warning-50 border border-warning-200">
          <p className="text-xs text-warning-700">สิทธิ์นี้สำหรับผู้ดูแลระบบเท่านั้น — การแก้ไขจะถูกบันทึกในประวัติการแก้ไขเพื่อตรวจสอบย้อนหลัง</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">เวลาเช็คอิน</label>
            <input
              type="datetime-local"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="input-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">เวลาเช็คเอาต์</label>
            <input
              type="datetime-local"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="input-base"
            />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-surface-50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-surface-500">เวลาเดิม: {prevCheckIn ? fmtTimeDisplay(prevCheckIn) : '-'} → {prevCheckOut ? fmtTimeDisplay(prevCheckOut) : '-'}</span>
          </div>
          {checkIn && checkOut && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-surface-500">ชั่วโมงทำงานใหม่:</span>
              <span className="font-bold text-primary-600">
                {((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60)).toFixed(2)} ชม.
              </span>
            </div>
          )}
        </div>
        <Textarea label="เหตุผลในการแก้ไข" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น พนักงานลืมเช็คอิน, เช็คอินผิดเวลา..." />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">ยกเลิก</Button>
          <Button onClick={save} loading={loading} className="flex-1">บันทึก</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============ ATTENDANCE AUDIT LOG MODAL ============
function AttendanceAuditLogModal({ open, onClose, profileId }: { open: boolean; onClose: () => void; profileId?: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from('attendance_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLogs(data ?? []);
        setLoading(false);
      });
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="ประวัติการแก้ไขเวลาเช็คอิน/เช็คเอาต์" size="lg">
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : logs.length === 0 ? (
        <EmptyState icon={<History className="w-8 h-8" />} title="ไม่มีประวัติการแก้ไข" description="การแก้ไขเวลาเช็คอิน/เช็คเอาต์โดยผู้ดูแลระบบจะแสดงที่นี่" />
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="p-4 rounded-xl border border-surface-200">
              <div className="flex items-center justify-between mb-2">
                <Badge variant={log.action === 'edit_both' ? 'warning' : 'info'}>
                  {log.action === 'edit_both' ? 'แก้ทั้งสองจุด' : log.action === 'edit_checkin' ? 'แก้เช็คอิน' : 'แก้เช็คเอาต์'}
                </Badge>
                <span className="text-xs text-surface-400">{formatDateTime(log.created_at)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded-lg bg-error-50">
                  <p className="text-xs text-error-500 mb-0.5">เวลาเดิม</p>
                  <p className="text-surface-600">
                    {log.previous_check_in ? fmtTimeDisplay(log.previous_check_in) : '-'}
                    {' → '}
                    {log.previous_check_out ? fmtTimeDisplay(log.previous_check_out) : '-'}
                  </p>
                  {log.previous_work_hours != null && <p className="text-xs text-surface-400 mt-0.5">{log.previous_work_hours} ชม.</p>}
                </div>
                <div className="p-2 rounded-lg bg-success-50">
                  <p className="text-xs text-success-500 mb-0.5">เวลาใหม่</p>
                  <p className="text-surface-600">
                    {log.new_check_in ? fmtTimeDisplay(log.new_check_in) : '-'}
                    {' → '}
                    {log.new_check_out ? fmtTimeDisplay(log.new_check_out) : '-'}
                  </p>
                  {log.new_work_hours != null && <p className="text-xs text-surface-400 mt-0.5">{log.new_work_hours} ชม.</p>}
                </div>
              </div>
              {log.note && <p className="text-sm text-surface-500 mt-2">เหตุผล: {log.note}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function fmtTimeDisplay(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
