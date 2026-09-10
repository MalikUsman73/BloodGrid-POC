/**
 * Blood bank overview.
 *
 * Its job is to answer one question: what is our stock position right now, and
 * is anything about to go wrong. Detailed analysis belongs on the demand
 * screen, and the actions belong on the planning screen, so neither is repeated
 * here.
 */

import { Link } from 'react-router-dom';
import {
  Bar, Button, Figure, FigureRow, Page, PageTitle, Status,
  Surface, SurfaceHeader, Table, Td, Th,
} from '../../components/ui';
import { SimulatedMark } from '../../components/PrototypeLabels';
import { OWN_BANK, inventory, totalCapacity, totalUnitsHeld } from '../../mock/banks';
import { buildPlanningItems } from '../../engines/forecast';
import { FORECAST_GROUPS } from '../../mock/demand';
import { stockTone } from '../../lib/status';

export default function BankOverview() {
  const planningItems = buildPlanningItems();
  const urgentItems = planningItems.filter((item) => item.priority === 'high');
  const filledShare = Math.round((totalUnitsHeld / totalCapacity) * 100);
  const lowGroups = inventory.filter(
    (item) => item.status === 'Low' || item.status === 'Critical',
  );

  return (
    <Page>
      <PageTitle
        title="Inventory"
        description={`${OWN_BANK.name}, Sector ${OWN_BANK.sector}. ${totalUnitsHeld} units held across all groups, ${filledShare} percent of capacity.`}
        actions={<Button to="/bank/demand">View demand and forecast</Button>}
      />

      <Surface className="mb-5">
        <FigureRow columns={4}>
          <Figure label="Units held" value={totalUnitsHeld} note={`${filledShare} percent of capacity`} />
          <Figure
            label="Groups below target" value={lowGroups.length}
            tone={lowGroups.length > 0 ? 'attention' : 'good'}
            note={lowGroups.map((item) => item.bloodGroup).join(', ') || 'All groups healthy'}
          />
          <Figure
            label="Flagged by forecast" value={planningItems.length}
            tone={planningItems.length > 0 ? 'attention' : 'good'}
            note="Elevated demand or shortage risk"
          />
          <Figure
            label="Projected shortfall" value={urgentItems.length}
            tone={urgentItems.length > 0 ? 'urgent' : 'good'}
            note={urgentItems.length > 0 ? urgentItems.map((item) => item.bloodGroup).join(', ') : 'Cover is sufficient'}
          />
        </FigureRow>
      </Surface>

      {urgentItems.length > 0 && (
        <div className="mb-5 border border-red-200 rounded-lg bg-red-50 px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-red-900">
              {urgentItems.map((item) => item.bloodGroup).join(' and ')} may fall short in the next
              two weeks
            </p>
            <p className="mt-1 text-[12.5px] leading-[1.55] text-red-800">
              {urgentItems[0].reason}
            </p>
          </div>
          <Button variant="primary" to="/bank/planning">Review planning</Button>
        </div>
      )}

      <Surface>
        <SurfaceHeader
          title="Stock by blood group"
          description="Simulated inventory. Four groups carry a prototype demand series; the rest are shown for stock context."
          actions={<SimulatedMark />}
        />
        <Table minWidth={640}>
          <thead>
            <tr>
              <Th>Group</Th>
              <Th align="right">Units held</Th>
              <Th>Level</Th>
              <Th align="right">Days of cover</Th>
              <Th>Status</Th>
              <Th>Forecast</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.map((item) => {
              const modelled = FORECAST_GROUPS.includes(item.bloodGroup);
              return (
                <tr key={item.bloodGroup} className="hover:bg-slate-50">
                  <Td><span className="font-medium text-slate-900 tabular-nums">{item.bloodGroup}</span></Td>
                  <Td align="right">
                    <span className="tabular-nums font-medium text-slate-900">{item.units}</span>
                    <span className="tabular-nums text-slate-400"> / {item.capacity}</span>
                  </Td>
                  <Td className="w-[140px]">
                    <Bar value={item.units / item.capacity} tone={stockTone(item.status)} />
                  </Td>
                  <Td align="right" className="tabular-nums text-slate-600">{item.daysOfCover}</Td>
                  <Td><Status tone={stockTone(item.status)}>{item.status}</Status></Td>
                  <Td>
                    {modelled ? (
                      <Link
                        to={`/bank/demand?group=${encodeURIComponent(item.bloodGroup)}`}
                        className="text-[12.5px] text-crimson-800 hover:underline"
                      >
                        View
                      </Link>
                    ) : (
                      <span className="text-[12px] text-slate-400">Not modelled</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Surface>
    </Page>
  );
}
