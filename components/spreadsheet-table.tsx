'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { IconPlus, IconTrash, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

export type ColumnDef<T> = {
  key: keyof T & string;
  header: string;
  width?: string;
  type?: 'text' | 'number' | 'select' | 'date' | 'readonly' | 'currency' | 'image';
  options?: { value: string; label: string }[];
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
  format?: (value: any) => string;
};

export type SpreadsheetTableProps<T extends { id?: string }> = {
  columns: ColumnDef<T>[];
  rows: T[];
  onUpdate?: (id: string, field: string, value: any) => Promise<void>;
  onCreate?: (row: Partial<T>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  newRowTemplate?: Partial<T>;
  readOnly?: boolean;
  emptyMessage?: string;
  rowClassName?: (row: T) => string | undefined;
};

export function SpreadsheetTable<T extends { id?: string }>({
  columns,
  rows,
  onUpdate,
  onCreate,
  onDelete,
  newRowTemplate,
  readOnly,
  emptyMessage = 'No rows yet.',
  rowClassName,
}: SpreadsheetTableProps<T>) {
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) inputRef.current.select();
    }
  }, [editing]);

  const commit = (id: string, key: string, value: any) => {
    setEditing(null);
    if (!onUpdate) return;
    startTransition(async () => {
      await onUpdate(id, key, value);
      setSavedFlash(`${id}-${key}`);
      setTimeout(() => setSavedFlash(null), 1500);
    });
  };

  const handleAddRow = () => {
    if (!onCreate) return;
    startTransition(async () => {
      await onCreate(newRowTemplate ?? {});
    });
  };

  return (
    <div className="glass overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.key as string}
                  className={cn(
                    'sheet-cell text-[10px] uppercase tracking-[0.08em] text-text-tertiary font-medium px-3 py-2.5 bg-white/[0.015]',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.align !== 'right' && c.align !== 'center' && 'text-left',
                    i === 0 && 'rounded-tl-[14px]'
                  )}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.header}
                </th>
              ))}
              {!readOnly && onDelete && (
                <th className="sheet-cell w-10 bg-white/[0.015]"></th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (onDelete && !readOnly ? 1 : 0)}
                  className="text-center py-10 text-text-tertiary text-[13px]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={cn('sheet-row group', rowClassName?.(row))}>
                  {columns.map((c) => {
                    const value = row[c.key as keyof T];
                    const isEditing = editing?.id === row.id && editing?.key === c.key;
                    const isReadonly = readOnly || c.type === 'readonly' || !onUpdate;
                    const flashing = savedFlash === `${row.id}-${c.key}`;
                    const alignClass =
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';

                    return (
                      <td key={c.key as string} className={cn('sheet-cell', alignClass)}>
                        <div
                          className={cn(
                            'relative px-3 py-2 transition-colors',
                            flashing && 'bg-ok/10'
                          )}
                          onClick={() => {
                            if (!isReadonly && !isEditing && row.id) {
                              setEditing({ id: row.id, key: c.key });
                            }
                          }}
                        >
                          {c.render ? (
                            c.render(row)
                          ) : isEditing && row.id ? (
                            c.type === 'select' && c.options ? (
                              <select
                                ref={inputRef as any}
                                defaultValue={String(value ?? '')}
                                onBlur={(e) => commit(row.id!, c.key, e.target.value)}
                                onChange={(e) => commit(row.id!, c.key, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setEditing(null);
                                }}
                                className="sheet-input"
                              >
                                {c.options.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                ref={inputRef as any}
                                type={c.type === 'number' || c.type === 'currency' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                                step={c.type === 'currency' ? '0.01' : undefined}
                                defaultValue={value == null ? '' : String(value)}
                                onBlur={(e) => commit(row.id!, c.key, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                  if (e.key === 'Escape') setEditing(null);
                                }}
                                className="sheet-input"
                              />
                            )
                          ) : (
                            <div
                              className={cn(
                                'sheet-input min-h-[26px] flex items-center',
                                alignClass === 'text-right' && 'justify-end',
                                alignClass === 'text-center' && 'justify-center',
                                isReadonly && 'cursor-default hover:bg-transparent hover:border-transparent',
                                value == null || value === '' ? 'text-text-tertiary italic' : 'text-text-primary'
                              )}
                            >
                              {value == null || value === ''
                                ? '—'
                                : c.format
                                ? c.format(value)
                                : c.type === 'currency'
                                ? `$${Number(value).toFixed(2)}`
                                : String(value)}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {!readOnly && onDelete && row.id && (
                    <td className="sheet-cell">
                      <button
                        onClick={() => onDelete(row.id!)}
                        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-bad transition p-2"
                        aria-label="Delete row"
                      >
                        <IconTrash size={13} stroke={1.75} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && onCreate && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.05] bg-white/[0.01]">
          <button
            onClick={handleAddRow}
            disabled={pending}
            className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-accent transition-colors px-2 py-1 rounded-md disabled:opacity-50"
          >
            {pending ? <IconLoader2 size={12} className="animate-spin" /> : <IconPlus size={12} stroke={2} />}
            Add row
          </button>
          {pending && (
            <span className="text-[11px] text-text-tertiary flex items-center gap-1">
              <IconLoader2 size={11} className="animate-spin" /> Saving
            </span>
          )}
        </div>
      )}
    </div>
  );
}
