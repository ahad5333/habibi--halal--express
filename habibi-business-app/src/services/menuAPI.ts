import request from './api';

export interface BusinessMenuItem {
  id: number;
  name: string;
  description?: string;
  price: number;       // price_2 for this business tier (set by admin)
  price_2?: number;
  price_3?: number;
  category?: string;
  image_url?: string;
  is_active: boolean;
  is_available: boolean;
  notes?: string;
}

export const menuAPI = {
  // Wholesale / business menu catalog
  getCatalog: (): Promise<BusinessMenuItem[]> =>
    request('/api/admin/business-menus'),
};
