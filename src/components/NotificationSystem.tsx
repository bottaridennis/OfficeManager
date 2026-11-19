import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Ticket } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotificationSystem() {
  const { userData, currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Ticket[]>([]);
  const isAdminOrTech = userData?.role === 'admin' || userData?.role === 'tecnico';

  useEffect(() => {
    if (!currentUser || !isAdminOrTech) return;

    // We only want to notify about tickets created AFTER this component mounted
    const mountTime = new Date();

    const q = query(
      collection(db, 'tickets'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const ticket = { id: change.doc.id, ...change.doc.data() } as Ticket;
          
          // Check if it's really new and not just initial load
          const createdAt = ticket.createdAt?.toDate();
          if (createdAt && createdAt > mountTime && ticket.userId !== currentUser.uid) {
            
            // Add notification
            setNotifications(prev => {
              // Avoid duplicates
              if (prev.some(n => n.id === ticket.id)) return prev;
              return [ticket, ...prev];
            });

            // Auto-remove after 8 seconds
            setTimeout(() => {
              removeNotification(ticket.id);
            }, 8000);

            // EMAIL NOTIFICATION TRIGGER
            // In a real production app, this would ideally be a Cloud Function
            // But since we want to show Option A, we call our server endpoint
            sendEmailNotification(ticket);
          }
        }
      });
    }, (error) => {
      // Slient fail for notifications to avoid spamming errors
      console.warn("Notification listener error:", error);
    });

    return () => unsubscribe();
  }, [currentUser, isAdminOrTech]);

  const sendEmailNotification = async (ticket: Ticket) => {
    // Le email richiedono il backend (server.ts): su hosting statico (GitHub Pages)
    // VITE_NOTIFY_API_URL è vuota e l'invio viene saltato.
    const notifyUrl = import.meta.env.VITE_NOTIFY_API_URL ?? '/api/notify-email';
    if (!notifyUrl) return;
    try {
      await fetch(notifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          description: ticket.description,
          userEmail: currentUser?.email,
          userRole: userData?.role
        }),
      });
    } catch (err) {
      console.error("Failed to send email trigger:", err);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (!isAdminOrTech) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 pointer-events-none sm:w-full sm:max-w-sm">
      <AnimatePresence>
        {notifications.map((ticket) => (
          <motion.div
            key={ticket.id}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.97 }}
            className="bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 pointer-events-auto flex gap-3 items-start"
            role="status"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-slate-900">Nuova richiesta</span>
                <button
                  onClick={() => removeNotification(ticket.id)}
                  className="icon-btn w-6 h-6 -mr-1"
                  aria-label="Chiudi notifica"
                >
                  <X className="!w-3.5 !h-3.5" />
                </button>
              </div>
              <p className="text-[13px] text-slate-600 line-clamp-2 mt-0.5">{ticket.description}</p>
              <Link
                to="/tickets"
                onClick={() => removeNotification(ticket.id)}
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Apri ticket
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
