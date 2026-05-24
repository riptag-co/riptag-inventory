'use client';

import { SpreadsheetTable, ColumnDef } from '@/components/spreadsheet-table';
import { formatUsd } from '@/lib/utils';
import { updateWishlist, createWishlistItem, deleteWishlistItem } from '@/app/actions';

type WishlistRow = {
  id: string;
  description: string;
  imageUrl: string | null;
  targetQty: number | null;
  supplierPrice: string | number | null;
  leadTimeDays: number | null;
  inStock: string | null;
  notes: string | null;
  status: 'open' | 'promoted' | 'rejected';
};

export function WishlistTable({ items }: { items: WishlistRow[] }) {
  const columns: ColumnDef<WishlistRow>[] = [
    { key: 'description', header: 'Product description', type: 'text' },
    {
      key: 'targetQty',
      header: 'Target qty',
      width: '110px',
      type: 'number',
      align: 'right',
    },
    {
      key: 'supplierPrice',
      header: 'Price ($)',
      width: '110px',
      type: 'currency',
      align: 'right',
      format: (v) => (v == null ? '—' : formatUsd(Number(v))),
    },
    {
      key: 'leadTimeDays',
      header: 'Lead (days)',
      width: '110px',
      type: 'number',
      align: 'right',
    },
    {
      key: 'inStock',
      header: 'In stock?',
      width: '110px',
      type: 'select',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'partial', label: 'Partial' },
        { value: 'unknown', label: 'Unknown' },
      ],
    },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      type: 'select',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'promoted', label: 'Promoted' },
        { value: 'rejected', label: 'Rejected' },
      ],
    },
    { key: 'notes', header: 'Notes', type: 'text' },
  ];

  return (
    <SpreadsheetTable
      columns={columns}
      rows={items}
      onUpdate={updateWishlist}
      onCreate={createWishlistItem}
      onDelete={deleteWishlistItem}
      emptyMessage="No wishlist items. Click 'Add row' to suggest something."
    />
  );
}
