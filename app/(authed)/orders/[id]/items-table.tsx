'use client';

import { SpreadsheetTable, ColumnDef } from '@/components/spreadsheet-table';
import { StatusPill } from '@/components/ui';
import { formatUsd, formatNum } from '@/lib/utils';
import { updateOrderItem, createOrderItem, deleteOrderItem } from '@/app/actions';
import { OrderItemFull } from '@/lib/db/queries';

export function OrderItemsTable({
  orderId,
  items,
  products,
}: {
  orderId: string;
  items: OrderItemFull[];
  products: { value: string; label: string }[];
}) {
  const columns: ColumnDef<OrderItemFull>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: '230px',
      type: 'select',
      options: products,
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-text-primary text-[12px]">{row.sku}</span>
          <span className="text-text-tertiary truncate text-[12px]">{row.productName}</span>
        </div>
      ),
    },
    {
      key: 'qtyOrdered',
      header: 'Ordered',
      width: '90px',
      type: 'number',
      align: 'right',
      format: (v) => formatNum(Number(v)),
    },
    {
      key: 'unitPrice',
      header: 'Unit $',
      width: '90px',
      type: 'currency',
      align: 'right',
      format: (v) => formatUsd(Number(v)),
    },
    {
      key: 'lineTotal',
      header: 'Line $',
      width: '110px',
      type: 'readonly',
      align: 'right',
      format: (v) => formatUsd(Number(v)),
    },
    {
      key: 'qtyShipped',
      header: 'Shipped',
      width: '90px',
      type: 'readonly',
      align: 'right',
      format: (v) => formatNum(Number(v)),
    },
    {
      key: 'qtyRemaining',
      header: 'Owed',
      width: '90px',
      type: 'readonly',
      align: 'right',
      render: (row) => (
        <span className={`num-display font-medium ${row.qtyRemaining > 0 ? 'text-bad' : 'text-ok'}`}>
          {formatNum(row.qtyRemaining)}
        </span>
      ),
    },
    {
      key: 'fulfillmentStatus',
      header: 'Status',
      width: '120px',
      type: 'readonly',
      render: (row) => <StatusPill status={row.fulfillmentStatus} />,
    },
    { key: 'notes', header: 'Notes', type: 'text' },
  ];

  return (
    <SpreadsheetTable
      columns={columns}
      rows={items}
      onUpdate={updateOrderItem}
      onCreate={() => createOrderItem(orderId)}
      onDelete={deleteOrderItem}
      emptyMessage="No line items yet. Click 'Add row' to start building this PO."
    />
  );
}
