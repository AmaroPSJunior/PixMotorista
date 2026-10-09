import type { PassengerSession } from '../types';

const sessionTime = (session: PassengerSession): number => {
  const value = session.status === 'active'
    ? session.lastActiveAt || session.createdAt
    : session.closedAt || session.updatedAt || session.lastActiveAt || session.createdAt;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

export function visibleDriverSession(sessions: PassengerSession[]): PassengerSession | null {
  const named = sessions.filter((session) =>
    Boolean(session.passengerName?.trim()) &&
    session.passengerName.trim().toLowerCase() !== 'passageiro'
  );
  const active = named.filter((session) => session.status === 'active');
  const candidates = active.length > 0 ? active : named.filter((session) =>
    session.status === 'closed' || session.status === 'expired'
  );
  return [...candidates].sort((a, b) =>
    sessionTime(b) - sessionTime(a) ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
    b.id.localeCompare(a.id)
  )[0] || null;
}
