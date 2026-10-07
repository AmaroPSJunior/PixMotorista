import React from 'react';
import { CalendarDays, CircleDollarSign, Gift, ReceiptText } from 'lucide-react';
import { PassengerSession } from '../types';

interface DriverHistorySummaryProps {
  sessions: PassengerSession[];
}

const money = (value: number) =>
  `R$ ${value.toFixed(2).replace('.', ',')}`;

export const DriverHistorySummary: React.FC<DriverHistorySummaryProps> = ({ sessions }) => {
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(
    (session) => new Date(session.createdAt).toDateString() === today
  );

  const completedToday = todaySessions.filter(
    (session) => session.status === 'closed' || session.status === 'expired'
  );
  const receivedToday = todaySessions.reduce(
    (sum, session) =>
      sum +
      Number(session.paidRideAmount || 0) +
      Number(session.paidAmount || 0),
    0
  );
  const paidRides = todaySessions.filter((session) => session.isRidePaid).length;
  const extraItems = todaySessions.reduce((sum, session) => {
    const products = (Object.values(session.purchasedProducts || {}) as number[]).reduce(
      (subtotal, quantity) => subtotal + Number(quantity || 0),
      0
    );
    return sum + products + (session.unlockedServices?.length || 0);
  }, 0);

  const recent = [...sessions]
    .sort(
      (a, b) =>
        new Date(b.lastActiveAt || b.createdAt).getTime() -
        new Date(a.lastActiveAt || a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-slate-700" />
        <div>
          <h2 className="font-black text-sm text-slate-900">Resumo de hoje</h2>
          <p className="text-xs text-slate-500">Visão rápida da operação</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
          <CircleDollarSign className="w-4 h-4 text-emerald-600" />
          <div className="mt-2 text-lg font-black text-slate-900">
            {money(receivedToday)}
          </div>
          <div className="text-[11px] font-bold text-slate-500">Recebido hoje</div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
          <ReceiptText className="w-4 h-4 text-slate-600" />
          <div className="mt-2 text-lg font-black text-slate-900">
            {completedToday.length}
          </div>
          <div className="text-[11px] font-bold text-slate-500">Corridas encerradas</div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
          <ReceiptText className="w-4 h-4 text-slate-600" />
          <div className="mt-2 text-lg font-black text-slate-900">{paidRides}</div>
          <div className="text-[11px] font-bold text-slate-500">Corridas pagas</div>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
          <Gift className="w-4 h-4 text-amber-600" />
          <div className="mt-2 text-lg font-black text-slate-900">{extraItems}</div>
          <div className="text-[11px] font-bold text-slate-500">Extras utilizados</div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wide font-black text-slate-400">
            Últimas corridas
          </div>
          {recent.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 truncate">
                  {session.passengerName || 'Passageiro'}
                </div>
                <div className="text-[10px] text-slate-500">
                  {new Date(session.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black text-slate-900">
                  {money(Number(session.paidRideAmount || session.ridePrice || 0))}
                </div>
                <div className="text-[10px] font-bold text-slate-500">
                  {session.status === 'active'
                    ? 'Em andamento'
                    : session.isRidePaid
                    ? 'Pago'
                    : 'Encerrado'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
