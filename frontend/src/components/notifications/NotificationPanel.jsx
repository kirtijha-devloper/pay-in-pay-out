import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { X, CheckCircle2, Info, AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';
import './NotificationPanel.css';

const ICON_MAP = {
  INFO: <Info size={16} className="text-blue-500" />,
  SUCCESS: <CheckCircle2 size={16} className="text-emerald-500" />,
  WARNING: <AlertTriangle size={16} className="text-orange-500" />,
  ERROR: <AlertCircle size={16} className="text-red-500" />,
};

const getNotificationLink = (title = '', type = '') => {
  const t = title.toLowerCase();
  if (t.includes('fund request')) return '/funds';
  if (t.includes('payout')) return '/reports?type=PAYOUT';
  if (t.includes('wallet')) return '/wallet';
  if (t.includes('kyc')) return '/reports?type=KYC';
  if (t.includes('user')) return '/users';
  return null;
};

export default function NotificationPanel({ onClose, onReadUpdate }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      if (data.success) {
        setNotifications(data.notifications);
        onReadUpdate(data.unreadCount);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    
    const handleClickOutside = (e) => {
      if (!e.target.closest('.notification-panel') && !e.target.closest('button')) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
      const unread = notifications.filter(n => !n.isRead && n.id !== id).length;
      onReadUpdate(unread);
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      onReadUpdate(0);
    } catch (err) {
      console.error(err);
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all notifications?')) return;
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
      onReadUpdate(0);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      const newNotifications = notifications.filter(n => n.id !== id);
      setNotifications(newNotifications);
      const unread = newNotifications.filter(n => !n.isRead).length;
      onReadUpdate(unread);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="notification-panel animate-fade-in shadow-2xl border border-gray-100 rounded-2xl bg-white">
      <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-white rounded-t-2xl">
        <h3 className="font-bold text-gray-900">Notifications</h3>
        <div className="flex gap-4">
          <button 
            onClick={markAllAsRead}
            className="text-[10px] uppercase font-black text-blue-600 hover:text-blue-700 transition-colors tracking-widest"
          >
            Mark Read
          </button>
          <button 
            onClick={clearAll}
            className="text-[10px] uppercase font-black text-red-600 hover:text-red-700 transition-colors tracking-widest"
          >
            Clear All
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No notifications yet</div>
        ) : (
          notifications.map((n) => (
            <div 
              key={n.id} 
              className={`p-4 border-b border-gray-50 flex gap-3 hover:bg-gray-50 transition-colors cursor-pointer relative group ${!n.isRead ? 'bg-blue-50/20' : ''}`}
              onClick={() => {
                markAsRead(n.id);
                const link = getNotificationLink(n.title);
                if (link) {
                   navigate(link);
                   onClose();
                }
              }}
            >
              <div className="mt-0.5">{ICON_MAP[n.type] || ICON_MAP.INFO}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <h4 className={`text-sm font-semibold truncate ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                    {n.title}
                  </h4>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {n.message}
                </p>
              </div>
              {!n.isRead && (
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>
              )}
              <button 
                onClick={(e) => deleteNotification(e, n.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all absolute right-2 bottom-2"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
      
      <div className="p-3 border-t border-gray-50 text-center bg-gray-50/50 rounded-b-2xl">
        <span className="text-[10px] text-gray-400 font-medium">End of notifications</span>
      </div>
    </div>
  );
}
