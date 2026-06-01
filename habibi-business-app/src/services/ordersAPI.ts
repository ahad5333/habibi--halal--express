import request from './api';

export type OrderStatus =
  | 'created'
  | 'processed'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled'
  | 'paid'
  | 'unpaid'
  | 'delivered_unpaid';

export interface BusinessOrderItem {
  menu_item_id: number;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface BusinessOrder {
  id: number;
  order_number: string;
  status: OrderStatus;
  payment_status: 'paid' | 'unpaid' | 'partial';
  payment_method?: string;
  items: BusinessOrderItem[];
  sub_total: number;
  delivery_fee: number;
  service_fee: number;
  credit_applied: number;
  total: number;
  delivery_address?: string;
  notes?: string;
  placed_at: string;
  updated_at: string;
}

export interface PlaceOrderPayload {
  items: BusinessOrderItem[];
  delivery_address: string;
  notes?: string;
  payment_method: string;
  pay_now: boolean;
}

export const ordersAPI = {
  getAll: (): Promise<BusinessOrder[]> =>
    request('/api/partner/orders'),

  getById: (id: number): Promise<BusinessOrder> =>
    request(`/api/partner/orders/${id}`),

  place: (payload: PlaceOrderPayload): Promise<{ order_number: string; id: number }> =>
    request('/api/partner/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancel: (id: number, reason: string): Promise<void> =>
    request(`/api/partner/orders/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  updatePaymentMethod: (id: number, payment_method: string): Promise<void> =>
    request(`/api/partner/orders/${id}/payment-method`, {
      method: 'PATCH',
      body: JSON.stringify({ payment_method }),
    }),

  payNow: (id: number, payment_method: string): Promise<void> =>
    request(`/api/partner/orders/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment_method }),
    }),
};
