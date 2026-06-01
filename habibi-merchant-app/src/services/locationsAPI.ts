import api from './api';

export interface Location {
  id: number;
  title: string;
  brief_address: string;
  phone_number: string;
  is_active: boolean;
  accepting_orders: boolean;
}

export const locationsAPI = {
  getAll: async (): Promise<Location[]> => {
    const res = await api.get('/api/admin/locations');
    return res.data;
  },

  toggle: async (id: number, field: 'is_active' | 'accepting_orders'): Promise<Location> => {
    const res = await api.patch(`/api/admin/locations/${id}/toggle`, { field });
    return res.data;
  },
};
