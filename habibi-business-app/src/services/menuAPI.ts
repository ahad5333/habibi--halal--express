import request from './api';

export interface BusinessMenuItem {
  id: number;
  name: string;
  description?: string;
  price: number;
  category?: string;
  image_url?: string;
  is_active: boolean;
  is_available: boolean;
  notes?: string;
  source?: 'regular' | 'wholesale';
}

interface CatalogResponse {
  price_tier: string;
  regular_menu: any[];
  wholesale_catalog: any[];
}

export const menuAPI = {
  getCatalog: async (): Promise<BusinessMenuItem[]> => {
    const res = await request<CatalogResponse>('/api/partner/catalog');
    const wholesale = (res.wholesale_catalog || []).map((i: any): BusinessMenuItem => ({
      id:           i.id,
      name:         i.name,
      description:  i.description,
      price:        Number(i.display_price ?? i.price ?? 0),
      category:     i.category,
      image_url:    i.image_url,
      is_active:    true,
      is_available: true,
      notes:        i.min_quantity && i.unit ? `Min. ${i.min_quantity} ${i.unit}` : undefined,
      source:       'wholesale',
    }));
    const regular = (res.regular_menu || []).map((i: any): BusinessMenuItem => ({
      id:           i.id,
      name:         i.name,
      description:  i.description,
      price:        Number(i.display_price ?? i.partner_price ?? i.price ?? 0),
      category:     i.category,
      image_url:    i.image_url,
      is_active:    true,
      is_available: i.is_available !== false,
      source:       'regular',
    }));
    return [...wholesale, ...regular];
  },
};
