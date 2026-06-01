import api from './api';

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  delivery_method: 'delivery' | 'pickup' | 'dine_in';
  delivery_address?: string;
  table_number?: string;
  payment_method: string;
  sub_total: number;
  tax: number;
  service_fee: number;
  delivery_fee: number;
  tip: number;
  discount: number;
  total: number;
  order_status: string;
  items: OrderItem[];
  placed_at: string;
  updated_at?: string;
  notes?: string;
  coupon_code?: string;
}

export interface OrderItem {
  id?: number;
  name: string;
  quantity: number;
  price: number;
  choices?: string;
  addons?: string;
  special_instructions?: string;
}

export interface CreateOrderPayload {
  customer_name:   string;
  delivery_method: 'dine_in' | 'pickup' | 'delivery';
  table_number?:   string;
  payment_method:  string;
  sub_total:       number;
  tax:             number;
  service_fee:     number;
  delivery_fee:    number;
  tip:             number;
  discount:        number;
  total:           number;
  notes?:          string;
  items: {
    name:                  string;
    qty:                   number;
    price:                 number;
    special_instructions?: string;
  }[];
}

export const ordersAPI = {
  create: async (payload: CreateOrderPayload) => {
    const res = await api.post('/api/orders/guest', payload);
    return res.data as Order;
  },

  getAll: async (params?: { status?: string; limit?: number }) => {
    const res = await api.get('/api/admin/orders', { params });
    return res.data as Order[];
  },

  updateStatus: async (orderNumber: string, status: string) => {
    const res = await api.patch(`/api/admin/orders/${orderNumber}/status`, { status });
    return res.data;
  },

  getStats: async () => {
    const res = await api.get('/api/admin/stats');
    return res.data;
  },

  getTodayOrders: async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await api.get('/api/admin/orders', { params: { date: today } });
    return res.data as Order[];
  },
};
