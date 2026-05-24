import { requireUser } from '@/lib/auth';
import { getAllProducts } from '@/lib/db/queries';
import { PageHeader } from '@/components/ui';
import { CatalogTable } from './table';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const user = await requireUser();
  const products = await getAllProducts();
  return (
    <>
      <PageHeader
        title="Catalog"
        subtitle="Master list of every product. SKU is the key referenced everywhere else."
      />
      <CatalogTable products={products as any} readOnly={user.role !== 'owner'} />
    </>
  );
}
