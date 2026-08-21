import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import {
  Table2, Plus, Search, MoreVertical, Edit2, Copy, Trash2, ArrowLeft,
  ChevronDown, X, Check, GripVertical, Hash, Type, Calendar, Tag, CheckSquare,
  Calculator, User as UserIcon, Pin, PinOff, Highlighter, Download, Upload,
  AlertCircle, CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Button, Input, Modal, Spinner, EmptyState, Badge, ConfirmDialog } from '@/components/ui';
import { cn } from '@/lib/format';
import { hasModuleAccess, type Role } from '@/types/permissions';

// ===================== TYPES =====================
type ColumnType = 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'formula' | 'person';

type Column = {
  id: string;
  name: string;
  type: ColumnType;
  options: string[];
  formula: string | null;
  width: number;
  order: number;
  frozen: boolean;
};

type Row = {
  id: string;
  order: number;
  row_color: string | null;
  height: number;
};

type Cell = {
  value: string;
  cell_color: string | null;
};

type DataTable = {
  id: string;
  name: string;
  created_by: string | null;
  last_edited_by: string | null;
  freeze_first_column: boolean;
  freeze_first_row: boolean;
  updated_at: string;
  created_at: string;
  editor_name?: string | null;
};

type CellMap = Record<string, Record<string, Cell>>; // rowId -> columnId -> cell

type ProfileOption = { id: string; display_name: string | null; email: string };

// ===================== CONSTANTS =====================
const COLUMN_TYPES: { type: ColumnType; label: string; icon: typeof Type }[] = [
  { type: 'text', label: 'ข้อความ', icon: Type },
  { type: 'number', label: 'ตัวเลข', icon: Hash },
  { type: 'date', label: 'วันที่', icon: Calendar },
  { type: 'select', label: 'ตัวเลือก/แท็ก', icon: Tag },
  { type: 'checkbox', label: 'ติ๊ก (Checkbox)', icon: CheckSquare },
  { type: 'formula', label: 'สูตรคำนวณ', icon: Calculator },
  { type: 'person', label: 'ผู้รับผิดชอบ', icon: UserIcon },
];

const ROW_COLORS = [
  { label: 'ไม่มีสี', value: '' },
  { label: 'แดง', value: '#fee2e2' },
  { label: 'เหลือง', value: '#fef9c3' },
  { label: 'เขียว', value: '#dcfce7' },
  { label: 'ฟ้า', value: '#dbeafe' },
  { label: 'ม่วง', value: '#f3e8ff' },
  { label: 'ส้ม', value: '#ffedd5' },
];

const CELL_COLORS = ROW_COLORS;

// ===================== MAIN COMPONENT =====================
export function DataTablesPage() {
  const { profile } = useAuth();
  const roles = (profile?.roles ?? []) as Role[];
  const canEdit = hasModuleAccess(roles, 'datatables') !== 'none';

  const [tables, setTables] = useState<DataTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DataTable | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('data_tables')
      .select('*, last_editor:profiles!data_tables_last_edited_by_fkey(display_name,email)')
      .order('updated_at', { ascending: false });
    if (error) {
      setToast({ type: 'error', msg: 'โหลดรายการตารางไม่สำเร็จ' });
    } else {
      setTables((data ?? []).map((t: any) => ({
        ...t,
        editor_name: t.last_editor?.display_name ?? t.last_editor?.email ?? null,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tables;
    const q = search.toLowerCase();
    return tables.filter((t) => t.name.toLowerCase().includes(q));
  }, [tables, search]);

  async function createTable() {
    const { data, error } = await supabase
      .from('data_tables')
      .insert({ name: 'ตารางใหม่', created_by: profile?.id, last_edited_by: profile?.id })
      .select('id')
      .single();
    if (error) {
      setToast({ type: 'error', msg: 'สร้างตารางไม่สำเร็จ' });
      return;
    }
    // Create default columns
    await supabase.from('data_table_columns').insert([
      { table_id: data.id, name: 'ชื่อ', type: 'text', order: 0, width: 200 },
      { table_id: data.id, name: 'สถานะ', type: 'select', order: 1, width: 140, options: ['รอดำเนินการ', 'กำลังทำ', 'เสร็จแล้ว'] },
      { table_id: data.id, name: 'ผู้รับผิดชอบ', type: 'person', order: 2, width: 160 },
    ]);
    // Create 3 empty rows
    await supabase.from('data_table_rows').insert([
      { table_id: data.id, order: 0 },
      { table_id: data.id, order: 1 },
      { table_id: data.id, order: 2 },
    ]);
    setOpenTableId(data.id);
  }

  async function renameTable(id: string, name: string) {
    const { error } = await supabase.from('data_tables').update({ name, last_edited_by: profile?.id, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { setToast({ type: 'error', msg: 'เปลี่ยนชื่อไม่สำเร็จ' }); return; }
    setMenuOpenId(null);
    load();
  }

  async function duplicateTable(id: string) {
    // Fetch full table data
    const { data: tbl } = await supabase.from('data_tables').select('*').eq('id', id).single();
    if (!tbl) return;
    const { data: newTbl } = await supabase.from('data_tables').insert({
      name: `${tbl.name} (สำเนา)`, created_by: profile?.id, last_edited_by: profile?.id,
      freeze_first_column: tbl.freeze_first_column, freeze_first_row: tbl.freeze_first_row,
    }).select('id').single();
    if (!newTbl) return;

    const { data: cols } = await supabase.from('data_table_columns').select('*').eq('table_id', id).order('order');
    if (cols) {
      const newCols = cols.map((c: any) => ({
        table_id: newTbl.id, name: c.name, type: c.type, options: c.options,
        formula: c.formula, width: c.width, order: c.order, frozen: c.frozen,
      }));
      const { data: insertedCols } = await supabase.from('data_table_columns').insert(newCols).select('id, order');
      const colMap: Record<string, string> = {};
      (insertedCols ?? []).forEach((nc: any, i: number) => { colMap[cols[i].id] = nc.id; });

      const { data: rows } = await supabase.from('data_table_rows').select('*').eq('table_id', id).order('order');
      if (rows) {
        const newRows = rows.map((r: any) => ({ table_id: newTbl.id, order: r.order, row_color: r.row_color, height: r.height }));
        const { data: insertedRows } = await supabase.from('data_table_rows').insert(newRows).select('id, order');
        const rowMap: Record<string, string> = {};
        (insertedRows ?? []).forEach((nr: any, i: number) => { rowMap[rows[i].id] = nr.id; });

        const { data: cells } = await supabase.from('data_table_cells').select('row_id,column_id,value,cell_color').in('row_id', rows.map((r: any) => r.id));
        if (cells) {
          const newCells = cells.map((c: any) => ({
            row_id: rowMap[c.row_id], column_id: colMap[c.column_id], value: c.value, cell_color: c.cell_color,
          })).filter((c: any) => c.row_id && c.column_id);
          if (newCells.length > 0) await supabase.from('data_table_cells').insert(newCells);
        }
      }
    }
    setMenuOpenId(null);
    setToast({ type: 'success', msg: 'ทำสำเนาตารางเรียบร้อย' });
    load();
  }

  async function deleteTable() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('data_tables').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) { setToast({ type: 'error', msg: 'ลบไม่สำเร็จ' }); setDeleteTarget(null); return; }
    setMenuOpenId(null);
    setDeleteTarget(null);
    setToast({ type: 'success', msg: 'ลบตารางเรียบร้อย' });
    load();
  }

  // ===== Grid editor view =====
  if (openTableId) {
    return (
      <>
        <GridEditor tableId={openTableId} onBack={() => { setOpenTableId(null); load(); }} canEdit={canEdit} />
        {toast && <Toast toast={toast} />}
      </>
    );
  }

  // ===== List view =====
  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast toast={toast} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาตาราง..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-50 border border-surface-200 text-sm text-surface-900 placeholder:text-surface-400 outline-none focus:border-primary-400"
            />
          </div>
        </div>
        {canEdit && (
          <Button onClick={createTable} className="shrink-0">
            <Plus className="w-4 h-4" /> สร้างตารางใหม่
          </Button>
        )}
      </div>

      {/* Table cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Table2 className="w-10 h-10" />}
          title={search ? 'ไม่พบตารางที่ค้นหา' : 'ยังไม่มีตาราง'}
          description={search ? 'ลองค้นหาด้วยคำอื่น' : 'กด "สร้างตารางใหม่" เพื่อเริ่มต้น'}
          action={canEdit && !search ? <Button onClick={createTable}><Plus className="w-4 h-4" /> สร้างตารางใหม่</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((table) => (
            <Card key={table.id} hover className="p-5 group cursor-pointer" onClick={() => setOpenTableId(table.id)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary-100 text-primary-600 shrink-0">
                    <Table2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-surface-900 truncate">{table.name}</h3>
                </div>
                {canEdit && (
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === table.id ? null : table.id); }}
                      className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpenId === table.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }} />
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-surface-200 py-1.5 z-40" onClick={(e) => e.stopPropagation()}>
                          <RenameMenuItem tableId={table.id} currentName={table.name} onRename={renameTable} />
                          <button onClick={() => duplicateTable(table.id)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-100">
                            <Copy className="w-4 h-4" /> ทำสำเนา
                          </button>
                          <button onClick={() => setDeleteTarget(table)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error-600 hover:bg-error-50">
                            <Trash2 className="w-4 h-4" /> ลบ
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-surface-400">
                {table.editor_name && (
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-3 h-3" /> {table.editor_name}
                  </span>
                )}
                <span>·</span>
                <span>{new Date(table.updated_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTable}
        title="ยืนยันลบตาราง"
        confirmLabel="ลบถาวร"
        loading={deleting}
      >
        <p className="font-medium text-error-600">{deleteTarget?.name}</p>
        <p>การลบนี้เป็นการลบถาวร ข้อมูลและตารางทั้งหมดจะถูกลบออกจากระบบ ไม่สามารถกู้คืนได้</p>
      </ConfirmDialog>
    </div>
  );
}

// ===================== RENAME MENU ITEM =====================
function RenameMenuItem({ tableId, currentName, onRename }: { tableId: string; currentName: string; onRename: (id: string, name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);

  if (editing) {
    return (
      <div className="px-3 py-1.5 flex items-center gap-1">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { onRename(tableId, name); setEditing(false); } if (e.key === 'Escape') { setEditing(false); setName(currentName); } }}
          className="flex-1 px-2 py-1 rounded-lg bg-surface-50 border border-primary-400 text-sm text-surface-900 outline-none"
        />
        <button onClick={() => { onRename(tableId, name); setEditing(false); }} className="p-1 rounded text-success-600"><Check className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <button onClick={() => { setName(currentName); setEditing(true); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-surface-700 hover:bg-surface-100">
      <Edit2 className="w-4 h-4" /> เปลี่ยนชื่อ
    </button>
  );
}

// ===================== TOAST =====================
function Toast({ toast }: { toast: { type: 'success' | 'error'; msg: string } }) {
  return (
    <div className={cn('fixed bottom-6 right-6 z-50 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg animate-slide-up', toast.type === 'success' ? 'bg-success-600 text-white' : 'bg-error-600 text-white')}>
      {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {toast.msg}
    </div>
  );
}

// ===================== GRID EDITOR =====================
function GridEditor({ tableId, onBack, canEdit }: { tableId: string; onBack: () => void; canEdit: boolean }) {
  const { profile } = useAuth();
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [cells, setCells] = useState<CellMap>({});
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [freezeCol, setFreezeCol] = useState(false);
  const [freezeRow, setFreezeRow] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ rowIdx: number; colIdx: number }[]>([]);
  const [searchIdx, setSearchIdx] = useState(0);
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const [colorPicker, setColorPicker] = useState<{ type: 'row' | 'cell'; rowId: string; colId?: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const dragRef = useRef<{ type: 'col' | 'row'; id: string; startIndex: number } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rowMenuBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const colMenuBtnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    const [tblRes, colRes, rowRes] = await Promise.all([
      supabase.from('data_tables').select('*').eq('id', tableId).single(),
      supabase.from('data_table_columns').select('*').eq('table_id', tableId).order('order'),
      supabase.from('data_table_rows').select('*').eq('table_id', tableId).order('order'),
    ]);

    if (tblRes.data) {
      setTableName(tblRes.data.name);
      setFreezeCol(tblRes.data.freeze_first_column ?? false);
      setFreezeRow(tblRes.data.freeze_first_row ?? false);
    }

    const cols = (colRes.data ?? []).map((c: any) => ({
      id: c.id, name: c.name, type: c.type as ColumnType,
      options: c.options ?? [], formula: c.formula, width: c.width ?? 160,
      order: c.order, frozen: c.frozen ?? false,
    }));
    setColumns(cols);
    const wMap: Record<string, number> = {};
    cols.forEach((c) => { wMap[c.id] = c.width; });
    setColWidths(wMap);

    const rws = (rowRes.data ?? []).map((r: any) => ({
      id: r.id, order: r.order, row_color: r.row_color, height: r.height ?? 48,
    }));
    setRows(rws);
    const hMap: Record<string, number> = {};
    rws.forEach((r) => { hMap[r.id] = r.height; });
    setRowHeights(hMap);

    if (rws.length > 0) {
      const { data: cellData } = await supabase
        .from('data_table_cells')
        .select('row_id,column_id,value,cell_color')
        .in('row_id', rws.map((r) => r.id));
      const cMap: CellMap = {};
      (cellData ?? []).forEach((c: any) => {
        if (!cMap[c.row_id]) cMap[c.row_id] = {};
        cMap[c.row_id][c.column_id] = { value: c.value ?? '', cell_color: c.cell_color };
      });
      setCells(cMap);
    } else {
      setCells({});
    }

    // Load profiles for person columns
    const { data: profData } = await supabase.from('profiles').select('id,display_name,email').eq('is_active', true).order('display_name');
    setProfiles(profData ?? []);

    setLoading(false);
  }, [tableId]);

  useEffect(() => { load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`data_tables_${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'data_table_cells' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'data_table_columns' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'data_table_rows' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'data_tables', filter: `id=eq.${tableId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId, load]);

  // ===== Formula evaluation =====
  function evalFormula(formula: string, rowId: string): string {
    if (!formula) return '';
    try {
      // Replace column references like {ColumnName} with their numeric values
      let expr = formula;
      for (const col of columns) {
        if (col.type === 'formula') continue;
        const cellVal = cells[rowId]?.[col.id]?.value ?? '0';
        const numVal = parseFloat(cellVal) || 0;
        expr = expr.replace(new RegExp(`\\{${col.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), String(numVal));
      }
      // Replace SUM(col) and AVERAGE(col)
      expr = expr.replace(/SUM\{([^}]+)\}/g, (_, colName) => {
        const col = columns.find((c) => c.name === colName);
        if (!col) return '0';
        const sum = rows.reduce((s, r) => s + (parseFloat(cells[r.id]?.[col.id]?.value ?? '0') || 0), 0);
        return String(sum);
      });
      expr = expr.replace(/AVERAGE\{([^}]+)\}/g, (_, colName) => {
        const col = columns.find((c) => c.name === colName);
        if (!col) return '0';
        const vals = rows.map((r) => parseFloat(cells[r.id]?.[col.id]?.value ?? '0') || 0);
        return String(vals.reduce((s: number, v: number) => s + v, 0) / (vals.length || 1));
      });
      // Evaluate basic arithmetic
      // Only allow numbers and operators
      const safe = expr.replace(/[^0-9+\-*/().\s]/g, '');
      if (!safe.trim()) return '';
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${safe})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return result % 1 === 0 ? String(result) : result.toFixed(2);
      }
      return '';
    } catch {
      return '#ERROR';
    }
  }

  // ===== Cell operations =====
  async function updateCell(rowId: string, colId: string, value: string) {
    setCells((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [colId]: { ...prev[rowId]?.[colId], value } },
    }));
    const cellColor = cells[rowId]?.[colId]?.cell_color ?? null;
    await supabase.from('data_table_cells').upsert({
      row_id: rowId, column_id: colId, value, cell_color: cellColor,
    }, { onConflict: 'row_id,column_id' });
    touchTable();
  }

  async function updateCellColor(rowId: string, colId: string, color: string | null) {
    setCells((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [colId]: { ...prev[rowId]?.[colId], cell_color: color } },
    }));
    const value = cells[rowId]?.[colId]?.value ?? '';
    await supabase.from('data_table_cells').upsert({
      row_id: rowId, column_id: colId, value, cell_color: color,
    }, { onConflict: 'row_id,column_id' });
    touchTable();
  }

  async function updateRowColor(rowId: string, color: string | null) {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, row_color: color } : r));
    await supabase.from('data_table_rows').update({ row_color: color }).eq('id', rowId);
    touchTable();
  }

  async function toggleCheckbox(rowId: string, colId: string) {
    const current = cells[rowId]?.[colId]?.value === 'true';
    await updateCell(rowId, colId, !current ? 'true' : 'false');
  }

  async function touchTable() {
    await supabase.from('data_tables').update({ last_edited_by: profile?.id, updated_at: new Date().toISOString() }).eq('id', tableId);
  }

  // ===== Column operations =====
  async function addColumn() {
    const order = columns.length;
    const { data } = await supabase.from('data_table_columns').insert({
      table_id: tableId, name: `คอลัมน์ ${columns.length + 1}`, type: 'text', order, width: 160,
    }).select('*').single();
    if (data) {
      const newCol: Column = { id: data.id, name: data.name, type: data.type, options: data.options ?? [], formula: data.formula, width: data.width, order: data.order, frozen: data.frozen ?? false };
      setColumns((prev) => [...prev, newCol]);
      setColWidths((prev) => ({ ...prev, [data.id]: 160 }));
    }
    touchTable();
  }

  async function deleteColumn(colId: string) {
    await supabase.from('data_table_columns').delete().eq('id', colId);
    setColumns((prev) => prev.filter((c) => c.id !== colId));
    setColMenuOpen(null);
    touchTable();
    load();
  }

  async function updateColumn(colId: string, updates: Partial<Column>) {
    setColumns((prev) => prev.map((c) => c.id === colId ? { ...c, ...updates } : c));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.options !== undefined) dbUpdates.options = updates.options;
    if (updates.formula !== undefined) dbUpdates.formula = updates.formula;
    if (updates.width !== undefined) dbUpdates.width = updates.width;
    if (updates.frozen !== undefined) dbUpdates.frozen = updates.frozen;
    await supabase.from('data_table_columns').update(dbUpdates).eq('id', colId);
    touchTable();
  }

  // ===== Row operations =====
  async function addRow() {
    const order = rows.length;
    const { data } = await supabase.from('data_table_rows').insert({ table_id: tableId, order }).select('*').single();
    if (data) {
      setRows((prev) => [...prev, { id: data.id, order: data.order, row_color: data.row_color, height: data.height ?? 48 }]);
      setRowHeights((prev) => ({ ...prev, [data.id]: 48 }));
    }
    touchTable();
  }

  async function deleteRow(rowId: string) {
    await supabase.from('data_table_rows').delete().eq('id', rowId);
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setRowMenuOpen(null);
    touchTable();
    load();
  }

  async function reorderRows(draggedId: string, targetId: string) {
    const draggedIdx = rows.findIndex((r) => r.id === draggedId);
    const targetIdx = rows.findIndex((r) => r.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const newRows = [...rows];
    const [moved] = newRows.splice(draggedIdx, 1);
    newRows.splice(targetIdx, 0, moved);
    setRows(newRows);
    // Update orders in DB
    const updates = newRows.map((r, i) => ({ id: r.id, order: i }));
    for (const u of updates) {
      await supabase.from('data_table_rows').update({ order: u.order }).eq('id', u.id);
    }
    touchTable();
  }

  // ===== Freeze toggles =====
  async function toggleFreezeCol() {
    const newVal = !freezeCol;
    setFreezeCol(newVal);
    await supabase.from('data_tables').update({ freeze_first_column: newVal }).eq('id', tableId);
  }

  async function toggleFreezeRow() {
    const newVal = !freezeRow;
    setFreezeRow(newVal);
    await supabase.from('data_tables').update({ freeze_first_row: newVal }).eq('id', tableId);
  }

  // ===== Resize =====
  function startColResize(colId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[colId] ?? 160;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(80, Math.min(500, startW + ev.clientX - startX));
      setColWidths((prev) => ({ ...prev, [colId]: newW }));
    };
    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      await updateColumn(colId, { width: colWidths[colId] ?? 160 });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startRowResize(rowId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = rowHeights[rowId] ?? 40;
    const onMove = (ev: MouseEvent) => {
      const newH = Math.max(48, Math.min(200, startH + ev.clientY - startY));
      setRowHeights((prev) => ({ ...prev, [rowId]: newH }));
    };
    const onUp = async () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      await supabase.from('data_table_rows').update({ height: rowHeights[rowId] ?? 48 }).eq('id', rowId);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ===== Search =====
  function doSearch() {
    if (!search.trim()) { setSearchResults([]); return; }
    const q = search.toLowerCase();
    const results: { rowIdx: number; colIdx: number }[] = [];
    rows.forEach((row, ri) => {
      columns.forEach((col, ci) => {
        const val = col.type === 'formula' ? evalFormula(col.formula ?? '', row.id) : (cells[row.id]?.[col.id]?.value ?? '');
        if (val.toLowerCase().includes(q)) {
          results.push({ rowIdx: ri, colIdx: ci });
        }
      });
    });
    setSearchResults(results);
    setSearchIdx(0);
  }

  // ===== Paste from Excel =====
  async function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text/plain');
    if (!text || !text.includes('\t') || !text.includes('\n')) return;
    e.preventDefault();
    const pastedRows = text.split('\n').filter((r) => r.trim());
    const pastedCols = pastedRows[0]?.split('\t') ?? [];

    // Find which cell is focused — paste starting from there
    if (!editingCell) return;
    const startRowIdx = rows.findIndex((r) => r.id === editingCell.rowId);
    const startColIdx = columns.findIndex((c) => c.id === editingCell.colId);
    if (startRowIdx === -1 || startColIdx === -1) return;

    for (let ri = 0; ri < pastedRows.length; ri++) {
      const vals = pastedRows[ri].split('\t');
      for (let ci = 0; ci < vals.length; ci++) {
        const targetRow = rows[startRowIdx + ri];
        const targetCol = columns[startColIdx + ci];
        if (targetRow && targetCol && targetCol.type !== 'formula') {
          await updateCell(targetRow.id, targetCol.id, vals[ci]);
        }
      }
    }
    setToast({ type: 'success', msg: `วางข้อมูล ${pastedRows.length} แถว × ${pastedCols.length} คอลัมน์` });
  }

  // ===== Export to CSV =====
  function exportCSV() {
    const header = columns.map((c) => `"${c.name}"`).join(',');
    const csvRows = rows.map((row) => {
      return columns.map((col) => {
        const val = col.type === 'formula' ? evalFormula(col.formula ?? '', row.id) : (cells[row.id]?.[col.id]?.value ?? '');
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    });
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== Import from CSV =====
  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return;
    const importedHeader = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').replace(/""/g, '"'));
    const importedRows = lines.slice(1).map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"')));

    // Match columns by name or create new ones
    const colMap: { importedIdx: number; colId: string }[] = [];
    for (let i = 0; i < importedHeader.length; i++) {
      const existing = columns.find((c) => c.name === importedHeader[i]);
      if (existing) {
        colMap.push({ importedIdx: i, colId: existing.id });
      } else {
        const { data } = await supabase.from('data_table_columns').insert({
          table_id: tableId, name: importedHeader[i], type: 'text', order: columns.length + i, width: 160,
        }).select('*').single();
        if (data) {
          const newCol: Column = { id: data.id, name: data.name, type: data.type, options: [], formula: null, width: 160, order: data.order, frozen: false };
          setColumns((prev) => [...prev, newCol]);
          colMap.push({ importedIdx: i, colId: data.id });
        }
      }
    }

    // Create rows and fill cells
    for (const importedRow of importedRows) {
      const { data: newRow } = await supabase.from('data_table_rows').insert({ table_id: tableId, order: rows.length }).select('*').single();
      if (!newRow) continue;
      for (const { importedIdx, colId } of colMap) {
        if (importedRow[importedIdx] !== undefined) {
          await supabase.from('data_table_cells').upsert({
            row_id: newRow.id, column_id: colId, value: importedRow[importedIdx],
          }, { onConflict: 'row_id,column_id' });
        }
      }
    }
    setToast({ type: 'success', msg: `นำเข้า ${importedRows.length} แถวเรียบร้อย` });
    if (fileInputRef.current) fileInputRef.current.value = '';
    load();
  }

  function getPersonName(uuid: string): string {
    const p = profiles.find((p) => p.id === uuid);
    return p?.display_name ?? p?.email ?? '';
  }

  function getDisplayValue(col: Column, rowId: string): string {
    if (col.type === 'formula') return evalFormula(col.formula ?? '', rowId);
    const val = cells[rowId]?.[col.id]?.value ?? '';
    if (col.type === 'checkbox') return val === 'true' ? '✓' : '';
    if (col.type === 'person') return getPersonName(val);
    return val;
  }

  // ===== Render =====
  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  const rowNumberColWidth = 48;
  const sortedCols = [...columns].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4 animate-fade-in" onPaste={handlePaste}>
      {toast && <Toast toast={toast} />}

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Row 1: back + table name */}
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-100 shrink-0">
            <ArrowLeft className="w-5 h-5 text-surface-600" />
          </button>
          <input
            value={tableName}
            onChange={(e) => { setTableName(e.target.value); supabase.from('data_tables').update({ name: e.target.value }).eq('id', tableId); }}
            className="text-lg font-bold bg-transparent text-surface-900 outline-none border-b border-transparent focus:border-primary-400 px-1 min-w-0 flex-1"
          />
        </div>

        {/* Row 2: search full width on mobile, then action buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
              placeholder="ค้นหาในตาราง..."
              className="w-full pl-3 pr-3 py-2 rounded-lg bg-surface-50 border border-surface-200 text-sm text-surface-900 placeholder:text-surface-400 outline-none focus:border-primary-400"
            />
          </div>
          {searchResults.length > 0 && (
            <span className="text-xs text-surface-400 whitespace-nowrap self-center">
              {searchIdx + 1}/{searchResults.length}
            </span>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleFreezeCol} className={cn('p-2 rounded-lg border transition-colors', freezeCol ? 'bg-primary-50 border-primary-300 text-primary-600' : 'bg-surface-50 border-surface-200 text-surface-400')} title="ตรึงคอลัมน์แรก">
              {freezeCol ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
            </button>
            <button onClick={toggleFreezeRow} className={cn('p-2 rounded-lg border transition-colors', freezeRow ? 'bg-primary-50 border-primary-300 text-primary-600' : 'bg-surface-50 border-surface-200 text-surface-400')} title="ตรึงแถวแรก">
              <span className="text-xs font-bold">{freezeRow ? '⬆️' : '⬆'}<span className="hidden">Pin Row</span></span>
            </button>
            <button onClick={exportCSV} className="p-2 rounded-lg border bg-surface-50 border-surface-200 text-surface-500 hover:text-surface-700" title="ส่งออก CSV">
              <Download className="w-4 h-4" />
            </button>
            {canEdit && (
              <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg border bg-surface-50 border-surface-200 text-surface-500 hover:text-surface-700" title="นำเข้า CSV">
                <Upload className="w-4 h-4" />
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileImport} className="hidden" />
        </div>
      </div>

      {/* Grid — horizontal scroll with touch support */}
      <div
        className="table-scroll relative overflow-y-auto rounded-xl border border-surface-200 bg-white max-h-[calc(100vh-200px)]"
      >
        <table className="border-collapse" style={{ tableLayout: 'fixed', minWidth: rowNumberColWidth + sortedCols.reduce((sum, col) => sum + (colWidths[col.id] ?? 160), 0) + (canEdit ? 48 : 0) }}>
          {/* Header row */}
          <thead>
            <tr>
              {/* Row number header */}
              <th
                className={cn(
                  'sticky left-0 z-30 bg-surface-50 border-b border-r border-surface-200',
                  freezeRow && 'sticky top-0 z-40'
                )}
                style={{ width: rowNumberColWidth, minWidth: rowNumberColWidth }}
              >
                <div className="flex items-center justify-center h-9">
                  <Hash className="w-3.5 h-3.5 text-surface-300" />
                </div>
              </th>
              {sortedCols.map((col, ci) => (
                <th
                  key={col.id}
                  className={cn(
                    'border-b border-r border-surface-200 relative group',
                    freezeCol && ci === 0 && 'sticky z-20',
                    freezeRow && 'sticky top-0 z-30',
                    (freezeCol && ci === 0 && freezeRow) && 'z-40',
                  )}
                  style={{
                    width: colWidths[col.id] ?? 160,
                    minWidth: colWidths[col.id] ?? 160,
                    left: freezeCol && ci === 0 ? rowNumberColWidth : undefined,
                    backgroundColor: freezeCol && ci === 0 ? 'rgb(249 250 251)' : undefined,
                  }}
                >
                  <div className="" style={{ backgroundColor: freezeCol && ci === 0 ? undefined : undefined }}>
                    {/* Column header content */}
                    <div
                      ref={(el) => { colMenuBtnRefs.current[col.id] = el; }}
                      className={cn(
                        'flex items-center gap-1 px-2 h-9 text-xs font-medium text-surface-600 cursor-pointer',
                        freezeCol && ci === 0 && 'bg-surface-50',
                      )}
                      onClick={(e) => { e.stopPropagation(); if (canEdit) setColMenuOpen(colMenuOpen === col.id ? null : col.id); }}
                      draggable={canEdit}
                      onDragStart={(e) => { if (canEdit) { dragRef.current = { type: 'col', id: col.id, startIndex: ci }; e.dataTransfer.effectAllowed = 'move'; } }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragRef.current?.type === 'col' && dragRef.current.id !== col.id) {
                          const newCols = [...sortedCols];
                          const [moved] = newCols.splice(dragRef.current.startIndex, 1);
                          newCols.splice(ci, 0, moved);
                          newCols.forEach((c, i) => updateColumn(c.id, { order: i }));
setColumns(newCols.map((c, i) => ({ ...c, order: i })));
                          dragRef.current = null;
                        }
                      }}
                    >
                      {(() => { const Icon = COLUMN_TYPES.find((t) => t.type === col.type)?.icon ?? Type; return <Icon className="w-3.5 h-3.5 shrink-0" />; })()}
                      <span className="truncate flex-1">{col.name}</span>
                      {canEdit && <MoreVertical className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0" />}
                    </div>
                    {/* Resize handle */}
                    {canEdit && (
                      <div
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary-400/50 transition-colors"
                        onMouseDown={(e) => startColResize(col.id, e)}
                      />
                    )}
                  </div>

                  {/* Column menu */}
                  {colMenuOpen === col.id && canEdit && (
                    <FloatingMenu anchorRef={{ current: colMenuBtnRefs.current[col.id] ?? null }} onClose={() => setColMenuOpen(null)} className="w-64 p-3 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-surface-500 mb-1 block">ชื่อคอลัมน์</label>
                        <input
                          value={col.name}
                          onChange={(e) => { const newName = e.target.value; updateColumn(col.id, { name: newName }); const newCols = columns.map((c) => c.id === col.id ? { ...c, name: newName } : c); setColumns(newCols); }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-50 border border-surface-200 text-sm text-surface-900 outline-none focus:border-primary-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-surface-500 mb-1 block">ประเภท</label>
                        <select
                          value={col.type}
                          onChange={(e) => { const newType = e.target.value as ColumnType; updateColumn(col.id, { type: newType }); const newCols = columns.map((c) => c.id === col.id ? { ...c, type: newType } : c); setColumns(newCols); }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-50 border border-surface-200 text-sm text-surface-900 outline-none focus:border-primary-400 cursor-pointer"
                        >
                          {COLUMN_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                        </select>
                      </div>
                      {col.type === 'select' && (
                        <div>
                          <label className="text-xs font-medium text-surface-500 mb-1 block">ตัวเลือก (คั่นด้วยจุลภาค)</label>
                          <input
                            value={col.options.join(', ')}
                            onChange={(e) => { const opts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); updateColumn(col.id, { options: opts }); const newCols = columns.map((c) => c.id === col.id ? { ...c, options: opts } : c); setColumns(newCols); }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-surface-50 border border-surface-200 text-sm text-surface-900 outline-none focus:border-primary-400"
                            placeholder="รอดำเนินการ, กำลังทำ, เสร็จแล้ว"
                          />
                        </div>
                      )}
                      {col.type === 'formula' && (
                        <div>
                          <label className="text-xs font-medium text-surface-500 mb-1 block">สูตร</label>
                          <input
                            value={col.formula ?? ''}
                            onChange={(e) => { const f = e.target.value; updateColumn(col.id, { formula: f }); const newCols = columns.map((c) => c.id === col.id ? { ...c, formula: f } : c); setColumns(newCols); }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-surface-50 border border-surface-200 text-sm text-surface-900 outline-none focus:border-primary-400 font-mono"
                            placeholder="{ราคา} * {จำนวน}"
                          />
                          <p className="text-[10px] text-surface-400 mt-1">ใช้ {'{ชื่อคอลัมน์}'} อ้างอิง รองรับ + − × ÷ SUM{'{ชื่อ}'} AVERAGE{'{ชื่อ}'}</p>
                        </div>
                      )}
                      <button onClick={() => deleteColumn(col.id)} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-error-600 hover:bg-error-50 rounded-lg">
                        <Trash2 className="w-4 h-4" /> ลบคอลัมน์
                      </button>
                    </FloatingMenu>
                  )}
                </th>
              ))}
              {canEdit && (
                <th className="border-b border-surface-200" style={{ width: 48, minWidth: 48 }}>
                  <button onClick={addColumn} className="flex items-center justify-center w-full h-9 text-surface-400 hover:text-primary-600 hover:bg-primary-50">
                    <Plus className="w-4 h-4" />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const isHighlighted = searchResults.length > 0 && searchResults[searchIdx]?.rowIdx === ri;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'group',
                    isHighlighted && 'ring-2 ring-primary-400 ring-inset',
                  )}
                  draggable={canEdit}
                  onDragStart={(e) => { if (canEdit) { dragRef.current = { type: 'row', id: row.id, startIndex: ri }; e.dataTransfer.effectAllowed = 'move'; } }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(row.id); }}
                  onDrop={(e) => { e.preventDefault(); if (dragRef.current?.type === 'row' && dragRef.current.id !== row.id) { reorderRows(dragRef.current.id, row.id); } setDragOverId(null); dragRef.current = null; }}
                  onDragEnd={() => setDragOverId(null)}
                >
                  {/* Row number / drag handle / menu */}
                  <td
                    className={cn(
                      'sticky left-0 z-20 border-b border-r border-surface-200 relative',
                      freezeRow && ri === 0 && 'sticky top-0',
                      'bg-surface-50',
                      dragOverId === row.id && 'bg-primary-50',
                    )}
                    style={{ height: rowHeights[row.id] ?? 48, width: rowNumberColWidth, minWidth: rowNumberColWidth }}
                  >
                    <div className="flex items-center justify-center h-full text-xs text-surface-400">
                      {canEdit && (
                        <div className="relative">
                          <button
                            ref={(el) => { rowMenuBtnRefs.current[row.id] = el; }}
                            onClick={(e) => { e.stopPropagation(); setRowMenuOpen(rowMenuOpen === row.id ? null : row.id); }}
                            className="p-0.5 rounded hover:bg-surface-200 opacity-0 group-hover:opacity-100"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </button>
                          {rowMenuOpen === row.id && (
                            <FloatingMenu anchorRef={{ current: rowMenuBtnRefs.current[row.id] ?? null }} onClose={() => setRowMenuOpen(null)} className="w-40 py-1.5">
                              <button onClick={() => { setColorPicker({ type: 'row', rowId: row.id }); setRowMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-surface-700 hover:bg-surface-100">
                                <Highlighter className="w-3.5 h-3.5" /> สีแถว
                              </button>
                              <button onClick={() => deleteRow(row.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-error-600 hover:bg-error-50">
                                <Trash2 className="w-3.5 h-3.5" /> ลบแถว
                              </button>
                            </FloatingMenu>
                          )}
                        </div>
                      )}
                      {!canEdit && ri + 1}
                    </div>
                  </td>

                  {sortedCols.map((col, ci) => {
                    const cellData = cells[row.id]?.[col.id];
                    const cellColor = cellData?.cell_color;
                    const isSearchHit = searchResults.length > 0 && searchResults[searchIdx]?.rowIdx === ri && searchResults[searchIdx]?.colIdx === ci;
                    const rowBg = row.row_color || '';
                    const cellBg = cellColor || (freezeCol && ci === 0 ? (rowBg || '') : rowBg) || '';

                    return (
                      <td
                        key={col.id}
                        className={cn(
                          'border-b border-r border-surface-200 relative',
                          freezeCol && ci === 0 && 'sticky z-10',
                          isSearchHit && 'ring-2 ring-primary-400 ring-inset',
                        )}
                        style={{
                          height: rowHeights[row.id] ?? 48,
                          width: colWidths[col.id] ?? 160,
                          minWidth: colWidths[col.id] ?? 160,
                          left: freezeCol && ci === 0 ? rowNumberColWidth : undefined,
                          backgroundColor: cellBg || (freezeCol && ci === 0 ? 'rgb(255 255 255)' : undefined),
                        }}
                        onClick={() => { if (canEdit && col.type !== 'formula' && col.type !== 'checkbox') setEditingCell({ rowId: row.id, colId: col.id }); }}
                      >
                        {/* Cell content */}
                        {editingCell?.rowId === row.id && editingCell?.colId === col.id ? (
                          <CellEditor
                            col={col}
                            value={cellData?.value ?? ''}
                            profiles={profiles}
                            onSave={async (val) => { await updateCell(row.id, col.id, val); setEditingCell(null); }}
                            onCancel={() => setEditingCell(null)}
                          />
                        ) : (
                          <CellDisplay
                            col={col}
                            value={getDisplayValue(col, row.id)}
                            rowId={row.id}
                            onToggle={canEdit ? () => toggleCheckbox(row.id, col.id) : undefined}
                            onColorPick={canEdit ? () => setColorPicker({ type: 'cell', rowId: row.id, colId: col.id }) : undefined}
                          />
                        )}

                        {/* Row resize handle */}
                        {canEdit && ci === sortedCols.length - 1 && (
                          <div
                            className="absolute bottom-0 left-0 w-full h-1 cursor-row-resize hover:bg-primary-400/50"
                            onMouseDown={(e) => startRowResize(row.id, e)}
                          />
                        )}
                      </td>
                    );
                  })}
                  {canEdit && <td className="border-b border-surface-200 bg-white" />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom bar — tappable on mobile, wraps if needed */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="secondary" size="sm" onClick={addRow} className="min-h-9">
            <Plus className="w-3.5 h-3.5" /> เพิ่มแถว
          </Button>
          <Button variant="ghost" size="sm" onClick={addColumn} className="min-h-9">
            <Plus className="w-3.5 h-3.5" /> เพิ่มคอลัมน์
          </Button>
        </div>
      )}

      {/* Color picker modal */}
      {colorPicker && (
        <Modal open onClose={() => setColorPicker(null)} title={colorPicker.type === 'row' ? 'เลือกสีแถว' : 'เลือกสีช่อง'} size="sm">
          <div className="grid grid-cols-4 gap-2">
            {(colorPicker.type === 'row' ? ROW_COLORS : CELL_COLORS).map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  if (colorPicker.type === 'row') updateRowColor(colorPicker.rowId, c.value || null);
                  else if (colorPicker.colId) updateCellColor(colorPicker.rowId, colorPicker.colId, c.value || null);
                  setColorPicker(null);
                }}
                className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all hover:scale-105', c.value ? 'border-surface-200' : 'border-surface-300 border-dashed')}
                style={{ backgroundColor: c.value || 'transparent' }}
              >
                <span className={c.value ? 'text-surface-700' : 'text-surface-400'}>{c.label}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ===================== CELL DISPLAY =====================
// ===================== FLOATING MENU (portal-style, viewport-aware flip) =====================
function FloatingMenu({ anchorRef, children, className, align = 'left', onClose }: {
  anchorRef: { current: HTMLElement | null };
  children: ReactNode;
  className?: string;
  align?: 'left' | 'right';
  onClose: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean } | null>(null);

  useEffect(() => {
    function compute() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const menuH = 220; // estimated max height
      const menuW = 256; // estimated width
      const padding = 4;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const flipUp = spaceBelow < menuH && spaceAbove > spaceBelow;
      const top = flipUp ? Math.max(8, rect.top - menuH - padding) : rect.bottom + padding;
      let left = align === 'left' ? rect.left : rect.right - menuW;
      left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
      setPos({ top, left, flipUp });
    }
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => { window.removeEventListener('scroll', compute, true); window.removeEventListener('resize', compute); };
  }, [anchorRef, align]);

  if (!pos) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div
        className={cn('fixed z-50 bg-white rounded-xl shadow-xl border border-surface-200', className)}
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}

// ===================== CELL DISPLAY =====================
function CellDisplay({ col, value, onToggle, onColorPick }: { col: Column; value: string; rowId: string; onToggle?: () => void; onColorPick?: () => void }) {
  if (col.type === 'checkbox') {
    return (
      <div className="flex items-center justify-center h-full px-2">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          className={cn(
            'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
            value === '✓'
              ? 'bg-primary-600 border-primary-600 text-white'
              : 'bg-transparent border-surface-300 hover:border-primary-400'
          )}
        >
          {value === '✓' && <Check className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }

  if (col.type === 'select') {
    return (
      <div className="h-full px-2 py-1.5 flex items-center">
        {value && (
          <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-primary-100 text-primary-700">
            {value}
          </span>
        )}
      </div>
    );
  }

  if (col.type === 'formula') {
    return (
      <div className="h-full px-2 py-1.5 text-sm font-medium text-surface-700 text-right tabular-nums">
        {value && value !== '#ERROR' ? value : <span className="text-error-400">{value === '#ERROR' ? '#ERROR' : ''}</span>}
      </div>
    );
  }

  if (col.type === 'number') {
    return <div className="h-full px-2 py-1.5 text-sm text-surface-900 text-right tabular-nums truncate">{value}</div>;
  }

  if (col.type === 'person') {
    return (
      <div className="h-full px-2 py-1.5 flex items-center">
        {value && (
          <span className="inline-flex items-center gap-1 text-xs text-surface-700">
            <UserIcon className="w-3 h-3" /> {value}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="h-full px-2 py-1.5 text-sm text-surface-900 truncate relative group/cell">
      {value}
      {onColorPick && (
        <button
          onClick={(e) => { e.stopPropagation(); onColorPick(); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover/cell:opacity-100 hover:bg-surface-200"
        >
          <Highlighter className="w-3 h-3 text-surface-400" />
        </button>
      )}
    </div>
  );
}

// ===================== CELL EDITOR =====================
function CellEditor({ col, value, profiles, onSave, onCancel }: {
  col: Column;
  value: string;
  profiles: ProfileOption[];
  onSave: (val: string) => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); onSave(local); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  }

  if (col.type === 'select') {
    return (
      <select
        ref={(el) => { inputRef.current = el; }}
        value={local}
        onChange={(e) => { setLocal(e.target.value); onSave(e.target.value); }}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(local)}
        className="w-full h-full px-2 py-1.5 bg-white text-sm text-surface-900 outline-none border-2 border-primary-400 rounded-sm cursor-pointer"
      >
        <option value="">—</option>
        {col.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }

  if (col.type === 'person') {
    return (
      <select
        ref={(el) => { inputRef.current = el; }}
        value={local}
        onChange={(e) => { setLocal(e.target.value); onSave(e.target.value); }}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(local)}
        className="w-full h-full px-2 py-1.5 bg-white text-sm text-surface-900 outline-none border-2 border-primary-400 rounded-sm cursor-pointer"
      >
        <option value="">—</option>
        {profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name ?? p.email}</option>)}
      </select>
    );
  }

  if (col.type === 'date') {
    return (
      <input
        ref={(el) => { inputRef.current = el; }}
        type="date"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(local)}
        className="w-full h-full px-2 py-1.5 bg-white text-sm text-surface-900 outline-none border-2 border-primary-400 rounded-sm"
      />
    );
  }

  if (col.type === 'number') {
    return (
      <input
        ref={(el) => { inputRef.current = el; }}
        type="number"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(local)}
        className="w-full h-full px-2 py-1.5 bg-white text-sm text-surface-900 outline-none border-2 border-primary-400 rounded-sm text-right tabular-nums"
      />
    );
  }

  return (
    <input
      ref={(el) => { inputRef.current = el; }}
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSave(local)}
      className="w-full h-full px-2 py-1.5 bg-white text-sm text-surface-900 outline-none border-2 border-primary-400 rounded-sm"
    />
  );
}
