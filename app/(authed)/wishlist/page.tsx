import { getAllWishlist } from '@/lib/db/queries';
import { PageHeader } from '@/components/ui';
import { WishlistTable } from './table';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const items = await getAllWishlist();
  return (
    <>
      <PageHeader
        title="Wishlist"
        subtitle="Products being considered. Supplier fills in price and lead time."
      />
      <WishlistTable items={items as any} />
    </>
  );
}
