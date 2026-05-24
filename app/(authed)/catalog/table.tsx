'use client';

import { SpreadsheetTable, ColumnDef } from '@/components/spreadsheet-table';
import { formatUsd } from '@/lib/utils';
import { updateProduct, createProduct, deleteProduct } from '@/app/actions';

type ProductRow = {
  id?: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  unitCost: string | number;
  unitWeightKg: string | number;
  variationNotes: string | null;
  status: 'active' | 'discontinued';
};

export function CatalogTable({ products, readOnly }: { products: ProductRow[]; readOnly: boolean }) {
  const rows = products.map((p) => ({ ...p, id: p.sku }));

  const columns: ColumnDef<ProductRow>[] = [
    {
      key: 'imageUrl',
      header: '',
      width: '60px',
      type: 'text',
      render: (row) =>
        row.imageUrl ? (
          <img src={row.imageUrl} alt="" className="w-9 h-9 rounded-md object-cover border border-white/[0.06]" />
        ) : (
          <div className="w-9 h-9 rounded-md bg-white/[0.04] border border-white/[0.04]" />
        ),
    },
    {
      key: 'sku',
      header: 'SKU',
      width: '110px',
      type: 'readonly',
      render: (row) => <span className="font-mono font-medium text-text-primary">{row.sku}</span>,
    },
    { key: 'name', header: 'Product name', type: 'text' },
    {
      key: 'unitCost',
      header: 'Unit $',
      width: '100px',
      type: 'currency',
      align: 'right',
      format: (v) => formatUsd(Number(v)),
    },
    {
      key: 'unitWeightKg',
      header: 'Weight (kg)',
      width: '110px',
      type: 'number',
      align: 'right',
      format: (v) => Number(v).toFixed(3),
    },
    { key: 'variationNotes', header: 'Variation notes', type: 'text' },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      type: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'discontinued', label: 'Discontinued' },
      ],
    },
  ];

  return (
    <SpreadsheetTable
      columns={columns}
      rows={rows as any}
      onUpdate={!readOnly ? async (id, field, value) => updateProduct(id, field, value) : undefined}
      onCreate={!readOnly ? createProduct : undefined}
      onDelete={!readOnly ? deleteProduct : undefined}
      readOnly={readOnly}
      emptyMessage="Catalog is empty. Click 'Add row' to add your first SKU."
    />
  );
}
