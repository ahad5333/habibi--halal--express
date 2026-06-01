import api from './api';

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  category: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  is_active: boolean;
}

export const menuAPI = {
  getAll: async () => {
    const res = await api.get('/api/admin/menus');
    return res.data as MenuItem[];
  },

  toggleAvailability: async (ids: number[], is_available: boolean) => {
    const res = await api.patch('/api/admin/menus/availability', { ids, is_available });
    return res.data;
  },

  toggleCategoryAvailability: async (category: string, is_available: boolean) => {
    const res = await api.patch('/api/admin/menus/availability', { category, is_available });
    return res.data;
  },
};
