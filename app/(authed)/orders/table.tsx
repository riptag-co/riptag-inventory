'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SpreadsheetTable, ColumnDef } from '@/components/spreadsheet-table';
import { formatUsd, formatDate } from '@/lib/utils';
import { updateOrder, createOrder, deleteOrder, promoteDraftOrder } from '@/app/actions';
import { OrderFull } from '@/lib/db/queries';
import { IconExternalLink, IconSend, IconLoader2, IconAlertCircle, IconFilePencil } from '@tabler/icons-react';
import { useState } from 'react';

export function OrdersTable({
  orders,
  mode = 'active',
}: {
  orders: OrderFull[];
  mode?: 'active' | 'draft';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<{ id: string; msg: string } | null>(null);

  const handlePromote = (id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await promoteDraftOrder(id);
        router.refresh();
      } catch (e: any) {
        setError({ id, msg: e?.message ?? 'Could not promote' });
      }
    });
  };

  const baseColumns: ColumnDef<OrderFull>[] = [
    {
      key: 'id',
      header: mode === 'draft' ? 'Draft' : 'PO#',
      width: mode === 'draft' ? '140px' : '110px',
      type: 'readonly',
      render: (row) => (
        <Link
          href={`/orders/${row.id}`}
          className="px-3 py-1 -mx-3 -my-1 flex items-center justify-between gap-2 group rounded-md hover:bg-white/[0.02]"
        >
          {mode === 'draft' ? (
            <span className="inline-flex items-center gap-1.5 text-text-secondary">
              <IconFilePencil size={12} className="text-text-tertiary" />
              <span className="text-[12px] font-medium">Draft</span>
            </span>
          ) : (
            <span className="font-medium text-text-primary">{row.id}</span>
          )}
          <IconExternalLink size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
        </Link>
      ),
    },
    { key: 'orderDate', header: 'Date', width: '120px', type: 'date', format: formatDate },
    {
      key: 'lineCount',
      header: 'Items',
      width: '70px',
      type: 'readonly',
      align: 'right',
    },
    {
      key: 'total',
      header: mode === 'draft' ? 'Quote' : 'Total',
      width: '120px',
      type: 'readonly',
      align: 'right',
      render: (row) =>
        row.total > 0 ? (
          <span className="font-semibold text-accent num-display">{formatUsd(row.total)}</span>
        ) : (
          <span className="text-text-tertiary italic text-[11px]">awaiting price</span>
        ),
    },
  ];

  if (mode === 'active') {
    baseColumns.push(
      {
        key: 'paid',
        header: 'Paid',
        width: '100px',
        type: 'select',
        options: [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' },
        ],
        align: 'center',
        render: (row) => (
          <span className={row.paid ? 'text-ok font-medium' : 'text-warn font-medium'}>
            {row.paid ? '✓ Paid' : '— Unpaid'}
          </span>
        ),
      },
      { key: 'paymentDate', header: 'Paid on', width: '120px', type: 'date', format: formatDate },
    );
  } else {
    baseColumns.push({
      key: 'notes' as any,
      header: 'Promote',
      width: '160px',
      type: 'readonly',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => handlePromote(row.id)}
            disabled={pending || row.total <= 0 || row.lineCount === 0}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent hover:underline disabled:text-text-tertiary disabled:no-underline disabled:cursor-not-allowed"
            title={
              row.lineCount === 0
                ? 'Add items first'
                : row.total <= 0
                ? 'Supplier must set prices first'
                : 'Move to Orders for payment'
            }
          >
            {pending && error?.id !== row.id ? (
              <IconLoader2 size={11} className="animate-spin" />
            ) : (
              <IconSend size={11} />
            )}
            Send to Orders
          </button>
          {error?.id === row.id && (
            <span className="text-[10px] text-bad inline-flex items-center gap-1">
              <IconAlertCircle size={10} /> {error.msg}
            </span>
          )}
        </div>
      ),
    });
  }

  baseColumns.push({ key: 'notes', header: 'Notes', type: 'text' });

  return (
    <SpreadsheetTable
      columns={baseColumns}
      rows={orders}
      onUpdate={async (id, field, value) => {
        if (field === 'paid') value = value === 'true';
        await updateOrder(id, field, value);
      }}
      onCreate={async () => {
        await createOrder({ status: mode === 'draft' ? 'draft' : 'pending_payment' });
        router.refresh();
      }}
      onDelete={deleteOrder}
      rowClassName={(row) =>
        mode === 'draft'
          ? '[&>td]:!bg-white/[0.015] [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-text-tertiary/40'
          : row.paid
          ? '[&>td]:!bg-ok/[0.025] [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-ok/40'
          : '[&>td]:!bg-warn/[0.04] [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-warn/50'
      }
      emptyMessage={
        mode === 'draft'
          ? 'No drafts yet. Click "Add row" to start a new order.'
          : 'No orders yet. Click "Add row" to create your first PO.'
      }
    />
  );
}
