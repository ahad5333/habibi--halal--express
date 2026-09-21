import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Live "orders changed" nudges for the order screens (/kitchen and /staff).
//
// The screen joins the backend's 'kitchen' room (socket/index.js, join_kitchen)
// and refetches the moment a new order arrives or any order changes status --
// in the kitchen, from a driver, or in CPanel. So a new order rings at once
// instead of up to 15 s later, and an order accepted on another device stops
// the alarm everywhere at once.
//
// The events carry nothing the screen displays; they only trigger the normal
// authorised REST fetch. The 15 s poll stays as the fallback, so if the socket
// drops nothing is missed -- it is just slower until it reconnects.
//
// /staff passes its PIN session; /kitchen passes nothing and is admitted on the
// admin login cookie that travels with the connection.
export default function useKitchenSocket({ base, staffId, token, onChange, enabled = true }) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    // Several events can land together (a new order, then its first status
    // change); one refetch covers them all.
    const nudge = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current?.(), 250);
    };
    const socket = io(base, { transports: ['websocket'], withCredentials: true });
    socket.on('connect', () => {
      // Fires on every reconnect too: re-join, and refetch to catch anything
      // that happened while the connection was down.
      socket.emit('join_kitchen', staffId ? { staff_id: staffId, token } : {});
      nudge();
    });
    socket.on('new_order', nudge);
    socket.on('order_status_updated', nudge);
    return () => {
      clearTimeout(timer);
      socket.disconnect();
    };
  }, [base, staffId, token, enabled]);
}
