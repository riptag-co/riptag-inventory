'use client';

import { SpreadsheetTable, ColumnDef } from '@/components/spreadsheet-table';
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
      width: '260px',
      type: 'select',
      options: products,
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-accent text-[12px]">{row.sku}</span>
          <span className="text-text-secondary truncate text-[12px]">{row.productName}</span>
        </div>
      ),
    },
    {
      key: 'qtyOrdered',
      header: 'Quantity',
      width: '110px',
      type: 'number',
      align: 'right',
      format: (v) => formatNum(Number(v)),
    },
    {
      key: 'unitPrice',
      header: 'Unit $',
      width: '110px',
      type: 'currency',
      align: 'right',
      format: (v) => formatUsd(Number(v)),
    },
    {
      key: 'lineTotal',
      header: 'Line $',
      width: '130px',
      type: 'readonly',
      align: 'right',
      format: (v) => formatUsd(Number(v)),
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
