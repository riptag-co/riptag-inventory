'use client';

import { useState, useTransition } from 'react';
import { SpreadsheetTable, ColumnDef } from '@/components/spreadsheet-table';
import { StatusPill } from '@/components/ui';
import { formatDate, SHIPMENT_STATUS_LABELS } from '@/lib/utils';
import {
  updateShipment,
  createShipment,
  deleteShipment,
  createShipmentItem,
  updateShipmentItem,
  deleteShipmentItem,
} from '@/app/actions';
import { Shipment } from '@/lib/db/schema';
import { IconChevronDown, IconChevronRight, IconLoader2, IconPlus } from '@tabler/icons-react';

const STATUS_OPTIONS = Object.entries(SHIPMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const CARRIER_OPTIONS = ['UPS', 'DHL', 'FedEx', 'USPS', 'SF Express', 'Other'].map((c) => ({ value: c, label: c }));

export function ShipmentsTable({
  shipments,
  productOptions,
  orderOptions,
}: {
  shipments: Shipment[];
  productOptions: { value: string; label: string }[];
  orderOptions: { value: string; label: string }[];
}) {
  const columns: ColumnDef<Shipment>[] = [
    {
      key: 'id',
      header: 'ID',
      width: '90px',
      type: 'readonly',
      render: (row) => <span className="font-medium text-text-primary">{row.id}</span>,
    },
    { key: 'shipDate', header: 'Ship date', width: '120px', type: 'date', format: formatDate as any },
    {
      key: 'carrier',
      header: 'Carrier',
      width: '110px',
      type: 'select',
      options: CARRIER_OPTIONS,
    },
    {
      key: 'trackingNumber',
      header: 'Tracking #',
      width: '200px',
      type: 'text',
      render: (row) => (
        <span className="font-mono text-[12px] text-text-secondary">{row.trackingNumber ?? '—'}</span>
      ),
    },
    {
      key: 'boxWeightKg',
      header: 'Weight (kg)',
      width: '110px',
      type: 'number',
      align: 'right',
      format: (v) => (v == null ? '—' : Number(v).toFixed(1)),
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      type: 'select',
      options: STATUS_OPTIONS,
      render: (row) => <StatusPill status={row.status} label={SHIPMENT_STATUS_LABELS[row.status]} />,
    },
    { key: 'eta', header: 'ETA', width: '110px', type: 'date', format: formatDate as any },
    { key: 'actualDelivery', header: 'Delivered', width: '110px', type: 'date', format: formatDate as any },
    { key: 'notes', header: 'Notes', type: 'text' },
  ];

  return (
    <SpreadsheetTable
      columns={columns}
      rows={shipments as any}
      onUpdate={updateShipment}
      onCreate={async () => { await createShipment({}); }}
      onDelete={deleteShipment}
      emptyMessage="No shipments yet."
    />
  );
}
