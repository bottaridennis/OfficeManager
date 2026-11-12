export type Role = 'admin' | 'tecnico' | 'utente';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'inactive';

export interface User {
  id: string; // from uid
  email: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  role: Role;
  status: UserStatus;
  mustChangePassword?: boolean;
  createdAt: any; // Timestamp
}

export interface SystemLog {
  id: string;
  action: 'create' | 'update' | 'delete' | 'assign' | 'withdraw' | 'maintenance' | 'login';
  collection: 'devices' | 'consumables' | 'tickets' | 'users' | 'system' | 'qa_testing';
  targetId?: string;
  description: string;
  userId: string;
  userEmail: string;
  createdAt: any;
}

export interface DeviceHistoryEntry {
  date: any;
  action: string;
  userId?: string | null;
  userEmail?: string | null;
  notes?: string;
}

export interface Device {
  id: string;
  category: string;
  photoUrl?: string;
  serialNumber: string;
  dynamicFields: Record<string, string>;
  assignedToUserId?: string | null;
  assignedToUserEmail?: string | null;
  isUnderMaintenance?: boolean;
  history?: DeviceHistoryEntry[];
  createdAt: any;
  updatedAt: any;
  addedBy: string;
}

export interface Consumable {
  id: string;
  name: string;
  category: string;
  totalQuantity: number;
  consumedQuantity: number;
  unit: string;
  price?: number; // Optional price per unit
  createdAt: any;
  updatedAt: any;
}

export type TicketType = 'support' | 'request';
export type TicketStatus = 'open' | 'in-progress' | 'closed' | 'archived';
export type TicketPriority = 'bassa' | 'media' | 'alta';

export type LicenseStatus = 'active' | 'available' | 'expired' | 'revoked';

export interface License {
  id: string;
  softwareName: string;
  licenseKey: string;
  status: LicenseStatus;
  issueDate?: string; // Stored as ISO string or Timestamp
  expiryDate?: string; // Stored as ISO string or Timestamp
  assignedToUserId?: string | null;
  assignedToUserEmail?: string | null;
  assignedToDeviceId?: string | null;
  assignedToDeviceName?: string | null;
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

export type LoanType = 'checkout' | 'return' | 'temporary_loan';
export type LoanStatus = 'active' | 'expiring' | 'expired' | 'returned' | 'early_returned' | 'manual_close';

export interface Loan {
  id: string;
  type: LoanType;
  targetType?: 'device' | 'consumable';
  targetDocId: string; // Device ID or Consumable ID
  targetDocName?: string;
  quantity?: number;
  userId: string;
  userEmail?: string;
  checkoutDate: any; // ISO or Timestamp
  expectedReturnDate?: any; // ISO string or Timestamp
  actualReturnDate?: any; // Timestamp
  status: LoanStatus;
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Ticket {
  id: string;
  type: TicketType;
  description: string;
  deviceId?: string;
  consumableId?: string;
  consumableQuantity?: number;
  deviceCategory?: string; // Generic request type
  priority?: TicketPriority;
  userId: string;
  assignedTo?: string;
  assignedBy?: string;
  resolvedBy?: string;
  status: TicketStatus;
  createdAt: any;
  updatedAt: any;
}
