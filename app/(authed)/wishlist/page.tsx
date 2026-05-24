import { requireUser } from '@/lib/auth';
import { getAllWishlist } from '@/lib/db/queries';
import { PageHeader } from '@/components/ui';
import { WishlistTable } from './table';

export const dynamic = 'force-dynamic';

export default async function WishlistPage() {
  const user = await requireUser();
  const items = await getAllWishlist();
  return (
    <>
      <PageHeader
        title="Wishlist"
        subtitle="Quick boxes of ideas. Add what you want, supplier fills in price + lead time."
      />
      <WishlistTable items={items as any} readOnly={user.role !== 'owner' && user.role !== 'supplier'} />
    </>
  );
}
