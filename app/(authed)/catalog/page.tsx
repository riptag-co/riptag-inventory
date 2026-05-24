import { requireUser } from '@/lib/auth';
import { getAllProducts } from '@/lib/db/queries';
import { PageHeader } from '@/components/ui';
import { CatalogGrid } from './grid';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const user = await requireUser();
  const products = await getAllProducts();
  const cards = products.map((p: any) => ({
    sku: p.sku,
    name: p.name,
    imageUrl: p.imageUrl ?? null,
  }));
  return (
    <>
      <PageHeader
        title="Catalog"
        subtitle="Visual reference. Tap a product to see what it looks like."
      />
      <CatalogGrid products={cards} readOnly={user.role !== 'owner'} />
    </>
  );
}
