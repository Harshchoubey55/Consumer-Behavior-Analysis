'use client';

import { useEffect } from 'react';
import { tracker } from '../../lib/tracking/tracker';

type Props = {
  productId: string;
  productTitle: string;
  productPrice: number;
  category?: string;
};

/**
 * Fires a product_view event when mounted on a product detail page.
 */
export default function ProductViewTracker({
  productId,
  productTitle,
  productPrice,
  category,
}: Props) {
  useEffect(() => {
    tracker.productView({
      id: productId,
      title: productTitle,
      price: productPrice,
      category,
    });
  }, [productId, productTitle, productPrice, category]);

  return null;
}
