'use client';

import Link from 'next/link';
import { SpreadsheetTable, ColumnDef } from '@/components/spreadsheet-table';
import { StatusPill } from '@/components/ui';
import { formatUsd, formatDate, ORDER_STATUS_LABELS } from '@/lib/utils';
import { updateOrder, createOrder, deleteOrder } from '@/app/actions';
import { OrderFull } from '@/lib/db/queries';
import { IconExternalLink } from '@tabler/icons-react';

const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));

export function OrdersTable({ orders }: { orders: OrderFull[] }) {
  const columns: ColumnDef<OrderFull>[] = [
    {
      key: 'id',
      header: 'PO#',
      width: '110px',
      type: 'readonly',
      render: (row) => (
        <Link
          href={`/orders/${row.id}`}
          className="px-3 py-1 -mx-3 -my-1 flex items-center justify-between gap-2 group rounded-md hover:bg-white/[0.02]"
        >
          <span className="font-medium text-text-primary">{row.id}</span>
          <IconExternalLink size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
        </Link>
      ),
    },
    { key: 'orderDate', header: 'Date', width: '120px', type: 'date', format: formatDate },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      type: 'select',
      options: ORDER_STATUS_OPTIONS,
      render: (row) => <StatusPill status={row.status} label={ORDER_STATUS_LABELS[row.status]} />,
    },
    {
      key: 'lineCount',
      header: 'Lines',
      width: '60px',
      type: 'readonly',
      align: 'right',
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      width: '110px',
      type: 'readonly',
      align: 'right',
      format: (v) => formatUsd(Number(v)),
    },
    {
      key: 'shippingCost',
      header: 'Shipping',
      width: '100px',
      type: 'currency',
      align: 'right',
      format: (v) => formatUsd(Number(v)),
    },
    {
      key: 'total',
      header: 'Total',
      width: '120px',
      type: 'readonly',
      align: 'right',
      format: (v) => formatUsd(Number(v)),
    },
    {
      key: 'paid',
      header: 'Paid',
      width: '70px',
      type: 'select',
      options: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ],
      align: 'center',
      render: (row) => (
        <span className={row.paid ? 'text-ok' : 'text-bad'}>{row.paid ? '✓' : '—'}</span>
      ),
    },
    { key: 'paymentDate', header: 'Paid date', width: '120px', type: 'date', format: formatDate },
    { key: 'notes', header: 'Notes', type: 'text' },
  ];

  return (
    <SpreadsheetTable
      columns={columns}
      rows={orders}
      onUpdate={async (id, field, value) => {
        if (field === 'paid') value = value === 'true';
        await updateOrder(id, field, value);
      }}
      onCreate={async () => { await createOrder({}); }}
      onDelete={deleteOrder}
      emptyMessage="No orders yet. Click 'Add row' to create your first PO."
    />
  );
}
