import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';

export interface OnboardingStep {
  id: number;
  phase: string;
  targetId: string;
  position: 'center' | 'bottom' | 'top' | 'left' | 'right';
  title: string;
  microcopy: string;
  actionType: 'click-next' | 'click-target' | 'type-input' | 'finish';
  nextLabel?: string;
  path: string; // URL path for this step
  badge?: string;
  roleSpecific?: 'all' | 'admin_tech';
}

// Complete comprehensive steps covering all areas and technical actions
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    phase: '1. Benvenuto & Panoramica',
    targetId: 'welcome-center',
    position: 'center',
    title: 'Benvenuto nel Centro di Gestione IT & Ufficio',
    microcopy: 'Hub completo per la gestione del parco macchine aziendale, magazzino cancelleria e materiali di consumo, prestiti temporanei e ticket di assistenza tecnica.',
    actionType: 'click-next',
    nextLabel: 'Inizia il Tour Completo',
    path: '/dashboard',
    badge: 'Panoramica Generale'
  },
  {
    id: 2,
    phase: '2. Cruscotto & KPI in Tempo Reale',
    targetId: 'onboarding-kpi-grid',
    position: 'bottom',
    title: 'Cruscotto Scorte & Indicatori Operativi',
    microcopy: 'Monitora istantaneamente dispositivi pronti all\'uso, materiali con scorte in esaurimento e ticket di supporto aperti per intervenire tempestivamente.',
    actionType: 'click-next',
    nextLabel: 'Passa alla Scansione',
    path: '/dashboard',
    badge: 'Dashboard'
  },
  {
    id: 3,
    phase: '3. Scansione Barcode & Seriale',
    targetId: 'onboarding-header-scanner',
    position: 'bottom',
    title: 'Ricerca Rapida Universale & Pistola Barcode',
    microcopy: 'Digita una matricola o spara un codice a barre con il lettore ottico per aprire all\'istante la scheda tecnica del dispositivo o del consumabile.',
    actionType: 'click-next',
    nextLabel: 'Vai ai Dispositivi',
    path: '/dashboard',
    badge: 'Header Rapido'
  },
  {
    id: 4,
    phase: '4. Parco Dispositivi & Asset IT',
    targetId: 'onboarding-devices-actions',
    position: 'bottom',
    title: 'Gestione Hardware & Registro Macchine',
    microcopy: 'Visualizza PC, monitor e telefoni. Da qui puoi aggiungere nuovi asset, generare etichette QR adesive per il magazzino ed esportare i registri in PDF o CSV.',
    actionType: 'click-next',
    nextLabel: 'Vai ai Consumabili',
    path: '/devices',
    badge: 'Dispositivi Hardware'
  },
  {
    id: 5,
    phase: '5. Materiale Consumabile & Rifornimenti',
    targetId: 'onboarding-consumables-actions',
    position: 'bottom',
    title: 'Cancelleria, Toner & Scorte Magazzino',
    microcopy: 'Tieni traccia delle scorte residue. Come tecnico puoi eseguire rifornimenti rapidi (+ Restock), impostare le soglie minime di allarme e importare articoli da file CSV.',
    actionType: 'click-next',
    nextLabel: 'Vai ai Prestiti',
    path: '/consumables',
    badge: 'Materiali & Scorte'
  },
  {
    id: 6,
    phase: '6. Moduli & Prestiti Temporanei',
    targetId: 'onboarding-loans-actions',
    position: 'bottom',
    title: 'Comodati d\'Uso & Rientri Scaduti',
    microcopy: 'Gestisci le assegnazioni temporanee di laptop e dotazioni. Traccia le date di rientro previste, invia solleciti e chiudi il prestito reinserendo l\'asset in disponibilità.',
    actionType: 'click-next',
    nextLabel: 'Vai ai Ticket & Assistenza',
    path: '/loans',
    badge: 'Moduli Prestiti'
  },
  {
    id: 7,
    phase: '7. Richieste & Ticket di Assistenza',
    targetId: 'onboarding-tickets-actions',
    position: 'bottom',
    title: 'Gestione Ticket, Guasti & Forniture',
    microcopy: 'Ricevi e gestisci le segnalazioni degli utenti. Prendi in carico i ticket con un clic ("In Carico"), associa dispositivi sostitutivi e segna come "Risolto".',
    actionType: 'click-next',
    nextLabel: 'Vai a Il Mio Inventario',
    path: '/tickets',
    badge: 'Helpdesk & Ticket'
  },
  {
    id: 8,
    phase: '8. Il Mio Inventario & Dotazioni',
    targetId: 'onboarding-myinventory-profile',
    position: 'bottom',
    title: 'Dotazioni Personali & Storico Asset',
    microcopy: 'Ogni utente e tecnico può consultare le apparecchiature attualmente in suo possesso, verificare lo storico delle assegnazioni e richiedere una riparazione rapida.',
    actionType: 'click-next',
    nextLabel: 'Concludi Guida',
    path: '/my-inventory',
    badge: 'Inventario Personale'
  },
  {
    id: 9,
    phase: '9. Pronto all\'Uso & Assistenza Continua',
    targetId: 'welcome-center',
    position: 'center',
    title: 'Tutto Pronto! Sei Operativo al 100%',
    microcopy: 'Ora conosci tutte le funzionalità del portale. Puoi riavviare questo tour in qualsiasi momento cliccando sul pulsante "Rifai Tutorial" in alto a destra.',
    actionType: 'finish',
    nextLabel: 'Inizia a Lavorare',
    path: '/dashboard',
    badge: 'Completato'
  }
];

interface OnboardingContextType {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: OnboardingStep | null;
  totalSteps: number;
  startOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  goToStep: (index: number) => void;
  isCompleted: boolean;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, userData } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(true);

  // Storage key per specific user
  const storageKey = currentUser ? `om_onboarding_completed_${currentUser.uid}` : 'om_onboarding_completed_guest';

  // Filter steps if needed, or provide all full-spectrum steps
  const steps = useMemo(() => {
    const role = userData?.role;
    // Gli utenti base non hanno accesso a prestiti/moduli: saltiamo quello step
    return role === 'admin' || role === 'tecnico' ? ONBOARDING_STEPS : ONBOARDING_STEPS.filter(s => s.path !== '/loans');
  }, [userData?.role]);

  useEffect(() => {
    if (!currentUser) return;
    const completed = localStorage.getItem(storageKey) === 'true';
    setIsCompleted(completed);
    
    // Auto-trigger on first login if not completed yet
    if (!completed) {
      const timer = setTimeout(() => {
        setIsActive(true);
        setCurrentStepIndex(0);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [currentUser, storageKey]);

  const startOnboarding = () => {
    setCurrentStepIndex(0);
    setIsActive(true);
    setIsCompleted(false);
    if (currentUser) {
      localStorage.removeItem(storageKey);
    }
  };

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      skipOnboarding();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const goToStep = (index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStepIndex(index);
    }
  };

  const skipOnboarding = () => {
    setIsActive(false);
    setIsCompleted(true);
    if (currentUser) {
      localStorage.setItem(storageKey, 'true');
    }
  };

  const currentStep = isActive && currentStepIndex < steps.length ? steps[currentStepIndex] : null;

  return (
    <OnboardingContext.Provider value={{
      isActive,
      currentStepIndex,
      currentStep,
      totalSteps: steps.length,
      startOnboarding,
      nextStep,
      prevStep,
      skipOnboarding,
      goToStep,
      isCompleted
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
